import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { saveActivity, addActivityPhotos, type SaveActivityPayload } from './activities';
import { detectSegmentEfforts } from './segments';

/**
 * Fila de atividades por enviar.
 *
 * Correr é uma atividade de túneis, trilhos e montanha: a rede falha
 * precisamente quando se termina o treino. Sem isto, uma falha ao guardar
 * perdia a atividade inteira — horas de esforço deitadas fora.
 *
 * A atividade fica guardada no telemóvel (AsyncStorage + ficheiros copiados
 * para uma pasta permanente) e é enviada assim que houver rede.
 */

const QUEUE_KEY = 'pending-activities';
const PHOTO_DIR = 'pending-activity-photos';

export interface PendingActivity {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  payload: SaveActivityPayload;
  /** Caminhos já copiados para armazenamento permanente. */
  photoUris: string[];
  generatedCardUri?: string;
}

function photosDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIR);
}

/**
 * Copia um ficheiro do cache para uma pasta permanente.
 * As URIs do seletor de imagens vivem em cache e podem desaparecer antes de
 * haver rede outra vez.
 */
async function persistFile(uri: string, name: string): Promise<string> {
  const dir = photosDirectory();
  if (!dir.exists) dir.create({ intermediates: true });

  const source = new File(uri);
  const target = new File(dir, name);
  if (target.exists) target.delete();
  source.copy(target);
  return target.uri;
}

function safeDelete(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ficheiro já desaparecido — nada a fazer
  }
}

async function readQueue(): Promise<PendingActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingActivity[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingActivity[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function getPendingActivities(): Promise<PendingActivity[]> {
  return readQueue();
}

export async function getPendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Guarda a atividade no telemóvel para enviar mais tarde. */
export async function queuePendingActivity(params: {
  payload: SaveActivityPayload;
  photos: { uri: string; mimeType?: string }[];
  generatedCardUri?: string | null;
}): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const photoUris: string[] = [];
  for (let i = 0; i < params.photos.length; i++) {
    try {
      photoUris.push(await persistFile(params.photos[i].uri, `${id}-${i}.jpg`));
    } catch {
      // Se não conseguirmos guardar a foto, a atividade vai na mesma —
      // perder uma foto é muito melhor do que perder o treino
    }
  }

  let cardUri: string | undefined;
  if (params.generatedCardUri) {
    try {
      cardUri = await persistFile(params.generatedCardUri, `${id}-card.png`);
    } catch {
      cardUri = undefined;
    }
  }

  const queue = await readQueue();
  queue.push({
    id,
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: params.payload,
    photoUris,
    generatedCardUri: cardUri,
  });
  await writeQueue(queue);
}

async function uploadOne(item: PendingActivity): Promise<void> {
  const saved = await saveActivity(item.payload);

  if (item.photoUris.length > 0) {
    await addActivityPhotos(
      saved.id,
      item.photoUris.map((uri) => ({ uri, mimeType: 'image/jpeg' })),
    );
  }

  if (item.generatedCardUri) {
    await addActivityPhotos(
      saved.id,
      [{ uri: item.generatedCardUri, mimeType: 'image/png' }],
      item.photoUris.length,
      true,
    );
  }

  detectSegmentEfforts(saved.id).catch(() => {});
}

export interface SyncResult {
  sent: number;
  failed: number;
}

/**
 * Tenta enviar tudo o que está em fila. Seguro para chamar repetidamente:
 * o que falhar fica na fila para a próxima.
 */
export async function syncPendingActivities(): Promise<SyncResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, failed: 0 };

  const remaining: PendingActivity[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      await uploadOne(item);
      item.photoUris.forEach(safeDelete);
      if (item.generatedCardUri) safeDelete(item.generatedCardUri);
      sent++;
    } catch (err: any) {
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: err?.message ?? 'erro desconhecido',
      });
    }
  }

  await writeQueue(remaining);
  return { sent, failed: remaining.length };
}

/** Remove uma atividade da fila (o utilizador desistiu de a enviar). */
export async function discardPendingActivity(id: string): Promise<void> {
  const queue = await readQueue();
  const item = queue.find((q) => q.id === id);
  if (item) {
    item.photoUris.forEach(safeDelete);
    if (item.generatedCardUri) safeDelete(item.generatedCardUri);
  }
  await writeQueue(queue.filter((q) => q.id !== id));
}
