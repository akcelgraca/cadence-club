jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from './supabase';
import type { SupabaseMock } from '../test-utils/supabaseMock';
import {
  mapCounts,
  attachHasKudosed,
  getPaceComparison,
  saveActivity,
  getActivityPoints,
  updateActivity,
  type SaveActivityPayload,
} from './activities';

const mockSupabase = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mockSupabase.setUser('user-1');
});

describe('mapCounts', () => {
  it('achata as contagens agregadas do PostgREST', () => {
    const row = {
      id: 'a1',
      title: 'Corrida',
      kudos: [{ count: 7 }],
      comments: [{ count: 2 }],
    };

    expect(mapCounts(row)).toMatchObject({
      id: 'a1',
      title: 'Corrida',
      kudos_count: 7,
      comments_count: 2,
    });
  });

  it('trata a ausência de agregados como zero', () => {
    expect(mapCounts({ id: 'a1' })).toMatchObject({ kudos_count: 0, comments_count: 0 });
    expect(mapCounts({ id: 'a1', kudos: [], comments: [] }))
      .toMatchObject({ kudos_count: 0, comments_count: 0 });
  });

  it('descarta os arrays crus para não confundirem quem consome', () => {
    const resultado = mapCounts({ id: 'a1', kudos: [{ count: 7 }], comments: [{ count: 2 }] });
    expect(resultado.kudos).toBeUndefined();
    expect(resultado.comments).toBeUndefined();
  });
});

describe('attachHasKudosed', () => {
  it('marca só as atividades a que o utilizador deu boost', async () => {
    mockSupabase.setTable('kudos', { data: [{ activity_id: 'a2' }] });

    const resultado = await attachHasKudosed([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);

    expect(resultado).toEqual([
      { id: 'a1', has_kudosed: false },
      { id: 'a2', has_kudosed: true },
      { id: 'a3', has_kudosed: false },
    ]);
  });

  it('resolve tudo numa única query', async () => {
    const query = mockSupabase.setTable('kudos', { data: [] });

    await attachHasKudosed([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);

    // Uma chamada com `in`, não uma por atividade.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(query.in).toHaveBeenCalledWith('activity_id', ['a1', 'a2', 'a3']);
  });

  it('não vai à base de dados com a lista vazia', async () => {
    await expect(attachHasKudosed([])).resolves.toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('devolve as linhas inalteradas sem sessão iniciada', async () => {
    mockSupabase.setUser(null);
    const rows = [{ id: 'a1' }];
    await expect(attachHasKudosed(rows)).resolves.toEqual(rows);
  });
});

describe('getPaceComparison', () => {
  /** N atividades de 5 km cada, com a duração indicada. */
  function historico(n: number, duracao: number) {
    return Array.from({ length: n }, () => ({ distance: 5000, duration: duracao }));
  }

  it('devolve null sem ritmo na atividade atual', async () => {
    await expect(getPaceComparison('u1', 'a1', 'run', 0)).resolves.toBeNull();
    await expect(getPaceComparison('u1', 'a1', 'run', -5)).resolves.toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('exige um mínimo de atividades para a média significar alguma coisa', async () => {
    mockSupabase.setTable('activities', { data: historico(2, 1500) });
    await expect(getPaceComparison('u1', 'a1', 'run', 300)).resolves.toBeNull();
  });

  it('exclui a própria atividade da média', async () => {
    const query = mockSupabase.setTable('activities', { data: historico(5, 1500) });

    await getPaceComparison('u1', 'a1', 'run', 300);

    expect(query.neq).toHaveBeenCalledWith('id', 'a1');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(query.eq).toHaveBeenCalledWith('type', 'run');
  });

  it('calcula a média sobre o total, não a média das médias', async () => {
    // 4 × 5 km em 1500 s + 1 × 5 km em 2000 s = 25 km em 8000 s → 320 s/km
    mockSupabase.setTable('activities', {
      data: [...historico(4, 1500), { distance: 5000, duration: 2000 }],
    });

    const resultado = await getPaceComparison('u1', 'a1', 'run', 300);

    expect(resultado).not.toBeNull();
    expect(resultado!.averagePace).toBeCloseTo(320, 6);
    expect(resultado!.sampleSize).toBe(5);
  });

  it('dá diferença positiva quando a atividade foi mais rápida do que o costume', async () => {
    mockSupabase.setTable('activities', { data: historico(5, 1500) }); // 300 s/km
    const resultado = await getPaceComparison('u1', 'a1', 'run', 270);

    expect(resultado!.percentDiff).toBeCloseTo(10, 6);
  });

  it('dá diferença negativa quando a atividade foi mais lenta', async () => {
    mockSupabase.setTable('activities', { data: historico(5, 1500) }); // 300 s/km
    const resultado = await getPaceComparison('u1', 'a1', 'run', 330);

    expect(resultado!.percentDiff).toBeCloseTo(-10, 6);
  });

  it('devolve null em erro de leitura', async () => {
    mockSupabase.setTable('activities', { error: { message: 'timeout' } });
    await expect(getPaceComparison('u1', 'a1', 'run', 300)).resolves.toBeNull();
  });

  it('devolve null quando o histórico não tem distância', async () => {
    mockSupabase.setTable('activities', {
      data: [
        { distance: 0, duration: 1500 },
        { distance: 0, duration: 1500 },
        { distance: 0, duration: 1500 },
      ],
    });
    await expect(getPaceComparison('u1', 'a1', 'run', 300)).resolves.toBeNull();
  });

  it('respeita um mínimo de amostras personalizado', async () => {
    mockSupabase.setTable('activities', { data: historico(2, 1500) });
    const resultado = await getPaceComparison('u1', 'a1', 'run', 300, 2);
    expect(resultado).not.toBeNull();
  });
});

describe('saveActivity', () => {
  const payload: SaveActivityPayload = {
    type: 'run',
    distance: 5000,
    duration: 1500,
    elevation_gain: 30,
    avg_pace: 300,
    start_time: '2026-07-15T08:00:00.000Z',
    end_time: '2026-07-15T08:25:00.000Z',
    route_summary: [[38.72, -9.13]],
    points: [
      { lat: 38.72, lng: -9.13, elevation: 10, timestamp: '2026-07-15T08:00:00.000Z' },
      { lat: 38.73, lng: -9.13, elevation: 12, timestamp: '2026-07-15T08:00:05.000Z' },
    ],
    mood: 4,
    title: 'Corrida matinal',
    description: null,
    is_public: true,
  };

  it('recusa sem sessão iniciada', async () => {
    mockSupabase.setUser(null);
    await expect(saveActivity(payload)).rejects.toThrow('Not authenticated');
  });

  it('guarda a atividade marcada como vinda da app e terminada', async () => {
    const atividades = mockSupabase.setTable('activities', { data: { id: 'a1' } });
    mockSupabase.setTable('activity_points', {});

    await saveActivity(payload);

    expect(atividades.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'run',
        distance: 5000,
        source: 'app',
        state: 'finished',
      }),
    );
  });

  it('associa cada ponto de GPS à atividade criada', async () => {
    mockSupabase.setTable('activities', { data: { id: 'a1' } });
    const pontos = mockSupabase.setTable('activity_points', {});

    await saveActivity(payload);

    expect(pontos.insert).toHaveBeenCalledWith([
      { activity_id: 'a1', lat: 38.72, lng: -9.13, elevation: 10, timestamp: '2026-07-15T08:00:00.000Z' },
      { activity_id: 'a1', lat: 38.73, lng: -9.13, elevation: 12, timestamp: '2026-07-15T08:00:05.000Z' },
    ]);
  });

  it('não escreve pontos quando não há GPS (modalidade sem distância)', async () => {
    mockSupabase.setTable('activities', { data: { id: 'a1' } });
    const pontos = mockSupabase.setTable('activity_points', {});

    await saveActivity({ ...payload, points: [] });

    expect(pontos.insert).not.toHaveBeenCalled();
  });

  it('propaga um erro ao gravar a atividade', async () => {
    mockSupabase.setTable('activities', { error: { message: 'RLS' } });
    await expect(saveActivity(payload)).rejects.toEqual({ message: 'RLS' });
  });

  it('propaga um erro ao gravar os pontos', async () => {
    mockSupabase.setTable('activities', { data: { id: 'a1' } });
    mockSupabase.setTable('activity_points', { error: { message: 'demasiados pontos' } });

    await expect(saveActivity(payload)).rejects.toEqual({ message: 'demasiados pontos' });
  });
});

describe('getActivityPoints', () => {
  it('passa pela função que respeita as zonas de privacidade', async () => {
    mockSupabase.setRpc('get_activity_points_visible', { data: [] });

    await getActivityPoints('a1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_activity_points_visible', {
      p_activity_id: 'a1',
    });
    // Ler a tabela diretamente devolveria o rasto completo a quem não é dono.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('reata o id da atividade a cada ponto', async () => {
    mockSupabase.setRpc('get_activity_points_visible', {
      data: [{ lat: 38.72, lng: -9.13, elevation: 10, timestamp: '2026-07-15T08:00:00.000Z' }],
    });

    await expect(getActivityPoints('a1')).resolves.toEqual([
      { activity_id: 'a1', lat: 38.72, lng: -9.13, elevation: 10, timestamp: '2026-07-15T08:00:00.000Z' },
    ]);
  });

  it('devolve vazio em erro — um mapa vazio é melhor do que um ecrã em branco', async () => {
    mockSupabase.setRpc('get_activity_points_visible', { error: { message: 'nope' } });
    await expect(getActivityPoints('a1')).resolves.toEqual([]);
  });
});

describe('updateActivity', () => {
  it('escreve só os campos editáveis e devolve a atividade com contagens', async () => {
    const query = mockSupabase.setTable('activities', {
      data: { id: 'a1', title: 'Novo título', kudos: [{ count: 3 }], comments: [] },
    });

    const resultado = await updateActivity('a1', { title: 'Novo título', is_public: false });

    expect(query.update).toHaveBeenCalledWith({ title: 'Novo título', is_public: false });
    expect(query.eq).toHaveBeenCalledWith('id', 'a1');
    expect(resultado).toMatchObject({ title: 'Novo título', kudos_count: 3, comments_count: 0 });
  });

  it('propaga o erro', async () => {
    mockSupabase.setTable('activities', { error: { message: 'RLS' } });
    await expect(updateActivity('a1', { title: 'x' })).rejects.toEqual({ message: 'RLS' });
  });
});
