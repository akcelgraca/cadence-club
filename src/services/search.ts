import { supabase } from './supabase';
import { parseLineString } from './routes';
import type { Profile } from '../lib/types';

export async function searchUsers(query: string, limit: number = 20): Promise<Profile[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,city.ilike.%${query}%`)
    .eq('is_public', true)
    .limit(limit);

  if (error) throw error;
  return data as Profile[];
}

export interface NearbyRouteResult {
  id: string;
  name: string;
  description?: string;
  city?: string;
  activity_type: string;
  difficulty?: string;
  distance: number;
  path: [number, number][];
  start_point: [number, number];
  user_id: string;
  creator_name?: string;
  creator_username?: string;
}

export async function searchRoutes(query: string, limit: number = 20): Promise<NearbyRouteResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc('search_routes', {
    p_query: query,
    p_user_id: null,
    p_limit: limit,
  });

  if (error) throw error;
  return (data ?? []).map(mapSearchRouteRow);
}

export async function searchRoutesForUser(query: string, userId: string, limit: number = 20): Promise<NearbyRouteResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc('search_routes', {
    p_query: query,
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) throw error;
  return (data ?? []).map(mapSearchRouteRow);
}

/** Rotas públicas da comunidade numa cidade (pesquisa por cidade). */
export async function searchRoutesByCity(city: string, limit: number = 30): Promise<NearbyRouteResult[]> {
  if (!city.trim()) return [];

  const { data, error } = await supabase
    .from('routes')
    .select('id, name, description, city, activity_type, difficulty, distance, user_id')
    .ilike('city', `%${city.trim()}%`)
    .eq('is_public', true)
    .order('usage_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((raw: any) => ({
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    city: raw.city ?? undefined,
    activity_type: raw.activity_type,
    difficulty: raw.difficulty ?? undefined,
    distance: raw.distance,
    path: [],
    start_point: [0, 0] as [number, number],
    user_id: raw.user_id,
  }));
}

function mapSearchRouteRow(raw: any): NearbyRouteResult {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    city: raw.city ?? undefined,
    activity_type: raw.activity_type,
    difficulty: raw.difficulty ?? undefined,
    distance: raw.distance,
    path: raw.path_text ? parseLineString(raw.path_text) : [],
    start_point: [raw.start_lng, raw.start_lat],
    user_id: raw.user_id,
    creator_name: raw.creator_name ?? undefined,
    creator_username: raw.creator_username ?? undefined,
  };
}
