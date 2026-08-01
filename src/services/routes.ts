import { supabase } from './supabase';
import type { Route, RouteWaypoint, NearbyRoute, RouteFilters } from '../lib/types';

// Parse PostGIS LINESTRING text → [lng, lat][]
export function parseLineString(wkt: string): [number, number][] {
  // Format: "LINESTRING(lng1 lat1, lng2 lat2, ...)"
  const match = wkt.match(/LINESTRING\s*\((.*)\)/i);
  if (!match) return [];
  return match[1].split(',').map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat] as [number, number];
  });
}

// Convert [lng, lat][] → PostGIS LINESTRING text
export function toLineString(coords: [number, number][]): string {
  const points = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `LINESTRING(${points})`;
}

// Convert raw RPC response (with path_text and start_lng/start_lat) to Route
function mapRouteRow(raw: any): Route {
  return {
    id: raw.id,
    user_id: raw.user_id,
    name: raw.name,
    description: raw.description ?? undefined,
    city: raw.city,
    country: raw.country ?? undefined,
    activity_type: raw.activity_type,
    difficulty: raw.difficulty,
    surface_type: raw.surface_type,
    distance: raw.distance,
    elevation_gain: raw.elevation_gain,
    estimated_duration: raw.estimated_duration ?? undefined,
    is_public: raw.is_public,
    usage_count: raw.usage_count,
    rating_avg: raw.rating_avg,
    path: raw.path_text ? parseLineString(raw.path_text) : [],
    start_point: [raw.start_lng, raw.start_lat],
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function mapNearbyRoute(raw: any): NearbyRoute {
  return {
    ...mapRouteRow(raw),
    distance_meters: raw.distance_meters,
  };
}

export async function fetchNearbyRoutes(
  lat: number,
  lng: number,
  filters?: RouteFilters,
  userId?: string,
): Promise<NearbyRoute[]> {
  const { data, error } = await supabase.rpc('get_nearby_routes', {
    p_lat: lat,
    p_lng: lng,
    p_radius: filters?.radius ?? 50000,
    p_activity_type: filters?.activity_type ?? null,
    p_difficulty: filters?.difficulty ?? null,
    p_user_id: userId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map(mapNearbyRoute);
}

export async function fetchRouteById(id: string): Promise<Route | null> {
  const { data, error } = await supabase.rpc('get_route_by_id', {
    p_route_id: id,
  });

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return mapRouteRow(data[0]);
}

export async function fetchRouteWaypoints(routeId: string): Promise<RouteWaypoint[]> {
  const { data, error } = await supabase.rpc('get_route_waypoints', {
    p_route_id: routeId,
  });

  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    id: w.id,
    route_id: w.route_id,
    name: w.name,
    type: w.type,
    description: w.description ?? undefined,
    location: [w.location_lng, w.location_lat],
  }));
}

export interface CreateRoutePayload {
  name: string;
  description?: string;
  city: string;
  country?: string;
  activity_type: string;
  difficulty: string;
  surface_type: string;
  distance: number;
  elevation_gain?: number;
  estimated_duration?: number;
  is_public?: boolean;
  path: [number, number][]; // [lng, lat][]
}

export async function createRoute(payload: CreateRoutePayload): Promise<Route> {
  const pathWkt = toLineString(payload.path);
  const startLng = payload.path[0][0];
  const startLat = payload.path[0][1];

  console.log('[Routes] Creating route via RPC:', {
    name: payload.name,
    city: payload.city,
    activity_type: payload.activity_type,
    distance: payload.distance,
    pathWktLength: pathWkt.length,
    startLng,
    startLat,
  });

  const { data, error } = await supabase.rpc('create_route', {
    p_name: payload.name,
    p_description: payload.description ?? null,
    p_city: payload.city,
    p_country: payload.country ?? null,
    p_activity_type: payload.activity_type,
    p_difficulty: payload.difficulty,
    p_surface_type: payload.surface_type,
    p_distance: payload.distance,
    p_elevation_gain: payload.elevation_gain ?? 0,
    p_estimated_duration: payload.estimated_duration != null ? Math.round(payload.estimated_duration) : null,
    p_is_public: payload.is_public ?? false,
    p_path_wkt: pathWkt,
    p_start_lng: startLng,
    p_start_lat: startLat,
  });

  if (error) {
    console.error('[Routes] Create route RPC error:', error);
    throw error;
  }
  if (!data || data.length === 0) {
    console.error('[Routes] Create route returned empty data');
    throw new Error('Failed to create route');
  }
  return mapRouteRow(data[0]);
}

export async function updateRoute(
  id: string,
  updates: Partial<CreateRoutePayload>,
): Promise<Route> {
  const params: Record<string, any> = {
    p_route_id: id,
  };

  if (updates.name !== undefined) params.p_name = updates.name;
  if (updates.description !== undefined) params.p_description = updates.description ?? null;
  if (updates.city !== undefined) params.p_city = updates.city;
  if (updates.country !== undefined) params.p_country = updates.country ?? null;
  if (updates.activity_type !== undefined) params.p_activity_type = updates.activity_type;
  if (updates.difficulty !== undefined) params.p_difficulty = updates.difficulty;
  if (updates.surface_type !== undefined) params.p_surface_type = updates.surface_type;
  if (updates.distance !== undefined) params.p_distance = updates.distance;
  if (updates.elevation_gain !== undefined) params.p_elevation_gain = updates.elevation_gain;
  if (updates.estimated_duration !== undefined) params.p_estimated_duration = Math.round(updates.estimated_duration);
  if (updates.is_public !== undefined) params.p_is_public = updates.is_public;
  if (updates.path) {
    params.p_path_wkt = toLineString(updates.path);
    params.p_start_lng = updates.path[0][0];
    params.p_start_lat = updates.path[0][1];
  }

  const { data, error } = await supabase.rpc('update_route', params);

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Failed to update route');
  return mapRouteRow(data[0]);
}

export async function deleteRoute(id: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Verify ownership before deleting
  const { data: route, error: fetchError } = await supabase
    .from('routes')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!route) throw new Error('Route not found');
  if (route.user_id !== user.user.id) throw new Error('Not authorized to delete this route');

  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw error;
}

export async function incrementUsageCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_route_usage', { p_route_id: id });
  if (error) {
    // Fallback: manual increment
    const { data } = await supabase.from('routes').select('usage_count').eq('id', id).single();
    if (data) {
      await supabase.from('routes').update({ usage_count: (data.usage_count ?? 0) + 1 }).eq('id', id);
    }
  }
}

// ── Rotas guardadas (favoritos) ───────────────────────────────────────────────
// Schema e RLS: supabase/migrations/030_saved_routes.sql

export async function getSavedRouteIds(): Promise<Set<string>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return new Set();

  const { data, error } = await supabase
    .from('saved_routes')
    .select('route_id')
    .eq('user_id', user.user.id);
  if (error) return new Set();
  return new Set((data ?? []).map((r: any) => r.route_id));
}

export async function saveRoute(routeId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_routes')
    .insert({ user_id: user.user.id, route_id: routeId });
  // 23505 = já guardada — não é erro para o utilizador
  if (error && error.code !== '23505') throw error;
}

export async function unsaveRoute(routeId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('user_id', user.user.id)
    .eq('route_id', routeId);
  if (error) throw error;
}

export interface CreateWaypointPayload {
  route_id: string;
  name: string;
  type: string;
  lng: number;
  lat: number;
  description?: string;
}

export async function createWaypoint(payload: CreateWaypointPayload): Promise<RouteWaypoint> {
  const { data, error } = await supabase.rpc('create_route_waypoint', {
    p_route_id: payload.route_id,
    p_name: payload.name,
    p_type: payload.type,
    p_lng: payload.lng,
    p_lat: payload.lat,
    p_description: payload.description ?? null,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Failed to create waypoint');

  const w = data[0];
  return {
    id: w.id,
    route_id: w.route_id,
    name: w.name,
    type: w.type,
    description: w.description ?? undefined,
    location: [w.location_lng, w.location_lat],
  };
}
