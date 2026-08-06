jest.mock('expo-file-system', () => require('../test-utils/fileSystemMock'));
jest.mock('./activities', () => ({
  saveActivity: jest.fn(),
  addActivityPhotos: jest.fn(),
}));
jest.mock('./segments', () => ({
  detectSegmentEfforts: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveActivity, addActivityPhotos, type SaveActivityPayload } from './activities';
import { detectSegmentEfforts } from './segments';
import {
  seedFile, fileExists, listFiles, resetFileSystem,
} from '../test-utils/fileSystemMock';
import {
  queuePendingActivity,
  getPendingActivities,
  getPendingCount,
  syncPendingActivities,
  discardPendingActivity,
} from './pendingSync';

const mockSaveActivity = saveActivity as jest.Mock;
const mockAddActivityPhotos = addActivityPhotos as jest.Mock;
const mockDetectSegmentEfforts = detectSegmentEfforts as jest.Mock;

const QUEUE_KEY = 'pending-activities';

const payload = {
  type: 'run',
  distance: 5000,
  duration: 1500,
  elevation_gain: 30,
  avg_pace: 300,
  start_time: '2026-07-15T08:00:00.000Z',
  end_time: '2026-07-15T08:25:00.000Z',
  route_summary: [[38.72, -9.13]],
  points: [],
  mood: 4,
  title: 'Corrida matinal',
  description: null,
  is_public: true,
} as SaveActivityPayload;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFileSystem();
  mockSaveActivity.mockResolvedValue({ id: 'activity-nova' });
  mockAddActivityPhotos.mockResolvedValue(undefined);
  mockDetectSegmentEfforts.mockResolvedValue(1);
});

describe('queuePendingActivity', () => {
  it('guarda a atividade para envio posterior', async () => {
    await queuePendingActivity({ payload, photos: [] });

    const fila = await getPendingActivities();
    expect(fila).toHaveLength(1);
    expect(fila[0].payload).toEqual(payload);
    expect(fila[0].attempts).toBe(0);
    expect(fila[0].id).toEqual(expect.any(String));
    expect(Number.isFinite(Date.parse(fila[0].createdAt))).toBe(true);
  });

  it('tira as fotos da cache para uma pasta permanente', async () => {
    // As URIs do seletor de imagens vivem em cache e podem desaparecer antes
    // de haver rede outra vez.
    const cache = seedFile('file:///cache/foto-temporaria.jpg');

    await queuePendingActivity({ payload, photos: [{ uri: cache }] });

    const [item] = await getPendingActivities();
    expect(item.photoUris).toHaveLength(1);
    expect(item.photoUris[0]).toContain('/documents/pending-activity-photos/');
    expect(item.photoUris[0]).not.toBe(cache);
    expect(fileExists(item.photoUris[0])).toBe(true);
  });

  it('guarda também o cartão gerado para partilha', async () => {
    const cartao = seedFile('file:///cache/cartao.png');

    await queuePendingActivity({ payload, photos: [], generatedCardUri: cartao });

    const [item] = await getPendingActivities();
    expect(item.generatedCardUri).toContain('-card.png');
    expect(fileExists(item.generatedCardUri!)).toBe(true);
  });

  it('mantém a atividade mesmo quando a foto já não existe', async () => {
    // Perder uma foto é muito melhor do que perder o treino.
    await queuePendingActivity({
      payload,
      photos: [{ uri: 'file:///cache/ja-desapareceu.jpg' }],
    });

    const fila = await getPendingActivities();
    expect(fila).toHaveLength(1);
    expect(fila[0].photoUris).toEqual([]);
  });

  it('acumula várias atividades sem apagar as anteriores', async () => {
    await queuePendingActivity({ payload, photos: [] });
    await queuePendingActivity({ payload: { ...payload, title: 'Segunda' }, photos: [] });

    expect(await getPendingCount()).toBe(2);
    const fila = await getPendingActivities();
    expect(fila.map((f) => f.payload.title)).toEqual(['Corrida matinal', 'Segunda']);
  });

  it('dá ids distintos a atividades guardadas no mesmo instante', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T08:00:00.000Z'));
    try {
      await queuePendingActivity({ payload, photos: [] });
      await queuePendingActivity({ payload, photos: [] });
    } finally {
      jest.useRealTimers();
    }

    const [a, b] = await getPendingActivities();
    expect(a.id).not.toBe(b.id);
  });
});

describe('getPendingActivities', () => {
  it('devolve vazio quando nunca se guardou nada', async () => {
    expect(await getPendingActivities()).toEqual([]);
    expect(await getPendingCount()).toBe(0);
  });

  it('devolve vazio quando o que está guardado está corrompido', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, 'isto não é json');
    expect(await getPendingActivities()).toEqual([]);
  });
});

describe('syncPendingActivities', () => {
  it('não vai à rede com a fila vazia', async () => {
    await expect(syncPendingActivities()).resolves.toEqual({ sent: 0, failed: 0 });
    expect(mockSaveActivity).not.toHaveBeenCalled();
  });

  it('envia a atividade e esvazia a fila', async () => {
    await queuePendingActivity({ payload, photos: [] });

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 1, failed: 0 });

    expect(mockSaveActivity).toHaveBeenCalledWith(payload);
    expect(await getPendingCount()).toBe(0);
  });

  it('envia as fotos depois da atividade e limpa os ficheiros locais', async () => {
    const cache = seedFile('file:///cache/foto.jpg');
    await queuePendingActivity({ payload, photos: [{ uri: cache }] });
    const [item] = await getPendingActivities();

    await syncPendingActivities();

    expect(mockAddActivityPhotos).toHaveBeenCalledWith('activity-nova', [
      { uri: item.photoUris[0], mimeType: 'image/jpeg' },
    ]);
    // Enviada a foto, o ficheiro permanente deixa de ter razão de existir.
    expect(fileExists(item.photoUris[0])).toBe(false);
  });

  it('põe o cartão gerado depois das fotos e marca-o como gerado', async () => {
    const foto = seedFile('file:///cache/foto.jpg');
    const cartao = seedFile('file:///cache/cartao.png');
    await queuePendingActivity({ payload, photos: [{ uri: foto }], generatedCardUri: cartao });
    const [item] = await getPendingActivities();

    await syncPendingActivities();

    expect(mockAddActivityPhotos).toHaveBeenLastCalledWith(
      'activity-nova',
      [{ uri: item.generatedCardUri, mimeType: 'image/png' }],
      1,     // a seguir à única foto do utilizador
      true,  // is_generated
    );
  });

  it('procura troços na atividade enviada', async () => {
    await queuePendingActivity({ payload, photos: [] });
    await syncPendingActivities();

    expect(mockDetectSegmentEfforts).toHaveBeenCalledWith('activity-nova');
  });

  it('considera a atividade enviada mesmo que a deteção de troços falhe', async () => {
    mockDetectSegmentEfforts.mockRejectedValue(new Error('PostGIS em baixo'));
    await queuePendingActivity({ payload, photos: [] });

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 1, failed: 0 });
  });

  it('mantém na fila o que falhou e regista a tentativa', async () => {
    mockSaveActivity.mockRejectedValue(new Error('rede indisponível'));
    await queuePendingActivity({ payload, photos: [] });

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 0, failed: 1 });

    const [item] = await getPendingActivities();
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBe('rede indisponível');
    expect(item.payload).toEqual(payload);
  });

  it('conta as tentativas ao longo de várias sincronizações', async () => {
    mockSaveActivity.mockRejectedValue(new Error('rede indisponível'));
    await queuePendingActivity({ payload, photos: [] });

    await syncPendingActivities();
    await syncPendingActivities();
    await syncPendingActivities();

    expect((await getPendingActivities())[0].attempts).toBe(3);
  });

  it('não apaga os ficheiros de uma atividade que ficou por enviar', async () => {
    mockSaveActivity.mockRejectedValue(new Error('rede indisponível'));
    const cache = seedFile('file:///cache/foto.jpg');
    await queuePendingActivity({ payload, photos: [{ uri: cache }] });
    const [item] = await getPendingActivities();

    await syncPendingActivities();

    expect(fileExists(item.photoUris[0])).toBe(true);
  });

  it('envia o que consegue e guarda o resto', async () => {
    await queuePendingActivity({ payload, photos: [] });
    await queuePendingActivity({ payload: { ...payload, title: 'A que falha' }, photos: [] });

    mockSaveActivity
      .mockResolvedValueOnce({ id: 'activity-1' })
      .mockRejectedValueOnce(new Error('rede indisponível'));

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 1, failed: 1 });

    const fila = await getPendingActivities();
    expect(fila).toHaveLength(1);
    expect(fila[0].payload.title).toBe('A que falha');
  });

  it('recupera quando a rede volta', async () => {
    await queuePendingActivity({ payload, photos: [] });

    mockSaveActivity.mockRejectedValueOnce(new Error('rede indisponível'));
    await expect(syncPendingActivities()).resolves.toEqual({ sent: 0, failed: 1 });

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 1, failed: 0 });
    expect(await getPendingCount()).toBe(0);
  });

  it('descreve um erro sem mensagem', async () => {
    mockSaveActivity.mockRejectedValue({});
    await queuePendingActivity({ payload, photos: [] });

    await syncPendingActivities();

    expect((await getPendingActivities())[0].lastError).toBe('erro desconhecido');
  });

  it('é seguro chamar repetidamente sem nada para enviar', async () => {
    await queuePendingActivity({ payload, photos: [] });
    await syncPendingActivities();

    await expect(syncPendingActivities()).resolves.toEqual({ sent: 0, failed: 0 });
    expect(mockSaveActivity).toHaveBeenCalledTimes(1);
  });
});

describe('discardPendingActivity', () => {
  it('remove a atividade e apaga os ficheiros locais', async () => {
    const cache = seedFile('file:///cache/foto.jpg');
    const cartao = seedFile('file:///cache/cartao.png');
    await queuePendingActivity({
      payload, photos: [{ uri: cache }], generatedCardUri: cartao,
    });
    const [item] = await getPendingActivities();

    await discardPendingActivity(item.id);

    expect(await getPendingCount()).toBe(0);
    expect(fileExists(item.photoUris[0])).toBe(false);
    expect(fileExists(item.generatedCardUri!)).toBe(false);
    expect(mockSaveActivity).not.toHaveBeenCalled();
  });

  it('não mexe nas outras atividades da fila', async () => {
    await queuePendingActivity({ payload, photos: [] });
    await queuePendingActivity({ payload: { ...payload, title: 'Fica' }, photos: [] });
    const [primeira] = await getPendingActivities();

    await discardPendingActivity(primeira.id);

    const fila = await getPendingActivities();
    expect(fila).toHaveLength(1);
    expect(fila[0].payload.title).toBe('Fica');
  });

  it('ignora um id que já não está na fila', async () => {
    await queuePendingActivity({ payload, photos: [] });

    await expect(discardPendingActivity('id-inexistente')).resolves.toBeUndefined();
    expect(await getPendingCount()).toBe(1);
  });

  it('não deixa ficheiros órfãos na pasta permanente', async () => {
    const cache = seedFile('file:///cache/foto.jpg');
    await queuePendingActivity({ payload, photos: [{ uri: cache }] });
    const [item] = await getPendingActivities();

    await discardPendingActivity(item.id);

    // A pasta fica (é reutilizada), mas sem nada lá dentro.
    const dentroDaPasta = listFiles().filter((f) =>
      f.startsWith('file:///documents/pending-activity-photos/'),
    );
    expect(dentroDaPasta).toEqual([]);
  });
});
