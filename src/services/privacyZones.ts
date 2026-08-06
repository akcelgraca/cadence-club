import { supabase } from './supabase';
import { haversineDistance } from '../utils/geo';

// Schema e funções: supabase/migrations/040_privacy_zones.sql
//
// As zonas são a morada de casa de alguém. Só o próprio as lê (RLS) e nunca
// são enviadas para o cliente de outra pessoa.

export interface PrivacyZone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius: number;
  created_at?: string;
}

export async function getMyPrivacyZones(): Promise<PrivacyZone[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data, error } = await supabase
    .from('privacy_zones')
    .select('id, label, radius, created_at, center')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // O PostgREST devolve geography como GeoJSON ou WKB hex conforme a versão;
  // tratamos as duas formas para não depender disso.
  return data.map((row: any) => {
    const { lat, lng } = parseCenter(row.center);
    return {
      id: row.id,
      label: row.label,
      radius: row.radius,
      created_at: row.created_at,
      lat,
      lng,
    };
  });
}

function parseCenter(center: any): { lat: number; lng: number } {
  if (center && typeof center === 'object' && Array.isArray(center.coordinates)) {
    return { lng: center.coordinates[0], lat: center.coordinates[1] };
  }
  return { lat: 0, lng: 0 };
}

export async function createPrivacyZone(params: {
  label: string;
  lat: number;
  lng: number;
  radius: number;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('privacy_zones').insert({
    user_id: user.user.id,
    label: params.label,
    radius: params.radius,
    center: `SRID=4326;POINT(${params.lng} ${params.lat})`,
  });
  if (error) throw error;
}

export async function updatePrivacyZoneRadius(zoneId: string, radius: number): Promise<void> {
  const { error } = await supabase
    .from('privacy_zones')
    .update({ radius })
    .eq('id', zoneId);
  if (error) throw error;
}

export async function deletePrivacyZone(zoneId: string): Promise<void> {
  const { error } = await supabase.from('privacy_zones').delete().eq('id', zoneId);
  if (error) throw error;
}

/**
 * Reaplica as zonas a todas as minhas atividades já guardadas.
 * Sem isto, criar uma zona só protegeria os treinos futuros.
 */
export async function applyZonesToAllActivities(): Promise<number> {
  const { data, error } = await supabase.rpc('apply_privacy_zones_to_all');
  if (error) return 0;
  return data ?? 0;
}

/**
 * Remove do traçado os pontos que caem dentro de alguma zona.
 *
 * Corre no telemóvel antes de gravar, para o resumo público da atividade
 * (activities.route_summary, que qualquer pessoa lê) nunca chegar ao servidor
 * com a morada de casa.
 */
export function trimRouteForZones<T extends { lat: number; lng: number }>(
  points: T[],
  zones: PrivacyZone[],
): T[] {
  if (zones.length === 0) return points;
  return points.filter((p) =>
    !zones.some((z) => haversineDistance(p.lat, p.lng, z.lat, z.lng) <= z.radius),
  );
}
