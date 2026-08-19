import { supabase } from './supabase';
import type {
  Activity, ActivityPoint, ActivityPhoto, ActivityType, ActivityCategory, RunType, SurfaceType,
} from '../lib/types';
import { ACTIVITY_CATEGORIES } from '../lib/constants';

export interface SaveActivityPayload {
  type: ActivityType;
  runType?: RunType;
  distance: number;
  duration: number;
  elevation_gain: number;
  avg_pace: number;
  start_time: string;
  end_time: string;
  route_summary: number[][];
  points: { lat: number; lng: number; elevation: number | null; timestamp: string }[];
  mood: number | null;
  title: string | null;
  description: string | null;
  is_public: boolean;
  surface_type?: SurfaceType | null;
  equipment_id?: string | null;
  // Fotos não entram aqui: guarda-se a atividade e depois chama-se
  // addActivityPhotos, que escreve em activity_photos (migração 037).
}

export async function uploadActivityPhoto(userId: string, uri: string, mimeType?: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fixedBlob = blob.slice(0, blob.size, mimeType || 'image/jpeg');
  const ext = mimeType ? mimeType.split('/')[1] : 'jpg';
  const filePath = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('activity-photos').upload(filePath, fixedBlob);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * Colunas pedidas sempre que se lê uma atividade para mostrar num cartão.
 * `photos` traz a galeria (migração 037) para o carrossel do feed.
 */
export const ACTIVITY_SELECT =
  '*, profile:profiles(*), kudos:kudos(count), comments:comments(count), photos:activity_photos(id, url, position)';

/** Máximo de fotos por atividade — limite da app, não da base de dados. */
export const MAX_ACTIVITY_PHOTOS = 6;

/** Galeria de uma atividade, por ordem. Schema: migração 037. */
export async function getActivityPhotos(activityId: string): Promise<ActivityPhoto[]> {
  const { data, error } = await supabase
    .from('activity_photos')
    .select('*')
    .eq('activity_id', activityId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as ActivityPhoto[];
}

/**
 * Carrega as imagens locais e associa-as à atividade. A capa
 * (activities.photo_url) é atualizada pelo trigger da migração 037.
 */
export async function addActivityPhotos(
  activityId: string,
  photos: { uri: string; mimeType?: string }[],
  startPosition = 0,
  isGenerated = false,
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user || photos.length === 0) return;

  const urls: string[] = [];
  for (const photo of photos) {
    urls.push(await uploadActivityPhoto(user.user.id, photo.uri, photo.mimeType));
  }

  const { error } = await supabase.from('activity_photos').insert(
    urls.map((url, i) => ({
      activity_id: activityId,
      url,
      position: startPosition + i,
      is_generated: isGenerated,
    })),
  );
  if (error) throw error;
}

/**
 * Grava a nova ordem da galeria. A capa (activities.photo_url) é recalculada
 * pelo trigger a cada linha atualizada.
 */
export async function reorderActivityPhotos(photoIds: string[]): Promise<void> {
  for (let i = 0; i < photoIds.length; i++) {
    const { error } = await supabase
      .from('activity_photos')
      .update({ position: i })
      .eq('id', photoIds[i]);
    if (error) throw error;
  }
}

export async function deleteActivityPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('activity_photos').delete().eq('id', photoId);
  if (error) throw error;
}

export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) throw error;
}

/**
 * Campos editáveis depois de guardar. Distância, duração e GPS ficam de fora
 * de propósito: são o registo do que aconteceu, não metadados.
 */
export interface UpdateActivityPayload {
  type?: ActivityType;
  title?: string | null;
  description?: string | null;
  is_public?: boolean;
  mood?: number | null;
  surface_type?: SurfaceType | null;
  equipment_id?: string | null;
  run_type?: RunType | null;
  // A capa (photo_url) é derivada de activity_photos pelo trigger — não se
  // escreve à mão, senão dessincroniza da galeria.
}

export async function updateActivity(
  activityId: string,
  updates: UpdateActivityPayload,
): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', activityId)
    .select(ACTIVITY_SELECT)
    .single();
  if (error) throw error;
  return mapCounts(data);
}

export async function saveActivity(payload: SaveActivityPayload): Promise<Activity> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({
      user_id: user.user.id,
      type: payload.type,
      run_type: payload.runType ?? null,
      distance: payload.distance,
      duration: payload.duration,
      elevation_gain: payload.elevation_gain,
      avg_pace: payload.avg_pace,
      start_time: payload.start_time,
      end_time: payload.end_time,
      route_summary: payload.route_summary,
      mood: payload.mood,
      title: payload.title,
      description: payload.description,
      is_public: payload.is_public,
      surface_type: payload.surface_type ?? null,
      equipment_id: payload.equipment_id ?? null,
      source: 'app',
      state: 'finished',
    })
    .select()
    .single();

  if (error) throw error;

  // Save GPS points
  if (payload.points.length > 0) {
    const points = payload.points.map((p) => ({
      activity_id: activity.id,
      lat: p.lat,
      lng: p.lng,
      elevation: p.elevation,
      timestamp: p.timestamp,
    }));

    const { error: pointsError } = await supabase.from('activity_points').insert(points);
    if (pointsError) throw pointsError;
  }

  return activity;
}

export function mapCounts(row: any): any {
  return {
    ...row,
    kudos_count: row.kudos?.[0]?.count ?? 0,
    comments_count: row.comments?.[0]?.count ?? 0,
    kudos: undefined,
    comments: undefined,
  };
}

/** Marca cada atividade com has_kudosed do utilizador atual (uma única query). */
export async function attachHasKudosed<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return rows;

  const { data: myKudos } = await supabase
    .from('kudos')
    .select('activity_id')
    .eq('user_id', user.user.id)
    .in('activity_id', rows.map((r) => r.id));

  const kudosed = new Set((myKudos ?? []).map((k: any) => k.activity_id));
  return rows.map((r) => ({ ...r, has_kudosed: kudosed.has(r.id) }));
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  const [row] = await attachHasKudosed([mapCounts(data)]);
  return row;
}

/**
 * Pontos de GPS visíveis para quem chama.
 *
 * Passa pela função get_activity_points_visible (migração 040): o dono recebe
 * o rasto completo, os outros recebem-no sem os pontos dentro das zonas de
 * privacidade. A leitura direta da tabela está reservada ao dono pela RLS.
 */
export async function getActivityPoints(activityId: string): Promise<ActivityPoint[]> {
  const { data, error } = await supabase.rpc('get_activity_points_visible', {
    p_activity_id: activityId,
  });
  if (error) return [];
  return (data ?? []).map((p: any) => ({
    activity_id: activityId,
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp,
  })) as ActivityPoint[];
}

export async function getMyActivities(userId: string, page: number = 0, limit: number = 15) {
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return attachHasKudosed(data?.map(mapCounts) ?? []);
}

export interface FeedFilter {
  category?: ActivityCategory | 'all';
  following?: boolean;
  searchQuery?: string;
}

export async function getFeed(page: number = 0, limit: number = 15, filter?: FeedFilter) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get IDs of users being followed + self
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.user.id);

  const followingIds = follows?.map((f) => f.following_id) || [];
  const visibleIds = [user.user.id, ...followingIds];

  let query = supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  // Apply category filter — resolves to specific activity types
  if (filter?.category && filter.category !== 'all') {
    const categoryTypes = ACTIVITY_CATEGORIES
      .find((c) => c.key === filter.category)
      ?.activities.map((a) => a.key) ?? [];
    if (categoryTypes.length > 0) {
      query = query.in('type', categoryTypes);
    }
  }

  // Apply following-only filter
  if (filter?.following) {
    query = query.in('user_id', followingIds.length > 0 ? followingIds : ['__none__']);
  } else {
    query = query.in('user_id', visibleIds);
  }

  // Apply search query filter (title or user profile name)
  if (filter?.searchQuery) {
    query = query.or(`title.ilike.%${filter.searchQuery}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return attachHasKudosed(data?.map(mapCounts) ?? []);
}

export interface PaceComparison {
  /** Ritmo médio das outras atividades da mesma modalidade, em seg/km. */
  averagePace: number;
  /** Nº de atividades usadas na média (exclui a atual). */
  sampleSize: number;
  /** Positivo = esta atividade foi mais rápida do que a média. */
  percentDiff: number;
}

/**
 * Compara o ritmo de uma atividade com a média do utilizador na mesma
 * modalidade. Exclui a própria atividade da média — senão comparava-se a si
 * mesma — e exige um mínimo de amostras para o número significar algo.
 */
export async function getPaceComparison(
  userId: string,
  activityId: string,
  type: string,
  activityPace: number,
  minSample = 3,
): Promise<PaceComparison | null> {
  if (!activityPace || activityPace <= 0) return null;

  const { data, error } = await supabase
    .from('activities')
    .select('distance, duration')
    .eq('user_id', userId)
    .eq('type', type)
    .neq('id', activityId)
    .gt('distance', 0)
    .gt('duration', 0)
    .limit(200);

  if (error || !data || data.length < minSample) return null;

  const totalDistance = data.reduce((sum, a: any) => sum + a.distance, 0);
  const totalDuration = data.reduce((sum, a: any) => sum + a.duration, 0);
  if (totalDistance <= 0) return null;

  const averagePace = totalDuration / (totalDistance / 1000);
  if (averagePace <= 0) return null;

  return {
    averagePace,
    sampleSize: data.length,
    // Ritmo menor = mais rápido, daí a diferença invertida
    percentDiff: ((averagePace - activityPace) / averagePace) * 100,
  };
}

/**
 * Atividades públicas recentes da comunidade, excluindo as minhas e as de quem
 * já sigo. Alimenta o estado vazio do feed — um utilizador novo não segue
 * ninguém e via o feed em branco.
 */
export async function getDiscoverActivities(limit = 10) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.user.id);

  const excluded = [user.user.id, ...(follows ?? []).map((f: any) => f.following_id)];

  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('is_public', true)
    .not('user_id', 'in', `(${excluded.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return attachHasKudosed((data ?? []).map(mapCounts));
}

/**
 * Atividades desde uma data, com só o que o cálculo de calorias precisa.
 *
 * Não usa ACTIVITY_SELECT de propósito: trazer perfis, fotos e contagens para
 * somar calorias era puxar dezenas de kB por um número. Aqui vêm cinco
 * colunas.
 */
export async function getActivitiesSince(userId: string, since: Date): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, start_time, duration, distance, avg_pace, avg_heart_rate')
    .eq('user_id', userId)
    .gte('start_time', since.toISOString())
    .order('start_time', { ascending: false });

  if (error) return [];
  return (data ?? []) as Activity[];
}
