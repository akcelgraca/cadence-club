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
