import { supabase } from './supabase';
import type {
  ActivitySegment, SegmentDetail, SegmentEffort, NearbySegment,
} from '../lib/types';

// Schema e funções: supabase/migrations/039_segments.sql
//
// Troços são cooperativos: mostram o histórico do próprio e a média da
// comunidade. Não há classificações — por isso não existe nenhuma função que
// devolva tempos de outras pessoas identificadas.

/**
 * Procura troços percorridos numa atividade e regista as passagens.
 * Chamado depois de guardar; falhar aqui não deve impedir nada.
 */
export async function detectSegmentEfforts(activityId: string): Promise<number> {
  const { data, error } = await supabase.rpc('detect_segment_efforts', {
    p_activity_id: activityId,
  });
  if (error) return 0;
  return data ?? 0;
}

export async function getActivitySegments(activityId: string): Promise<ActivitySegment[]> {
  const { data, error } = await supabase.rpc('get_activity_segments', {
    p_activity_id: activityId,
  });
  if (error) return [];
  return (data ?? []) as ActivitySegment[];
}

export async function getSegmentDetail(segmentId: string): Promise<SegmentDetail | null> {
  const { data, error } = await supabase.rpc('get_segment_detail', {
    p_segment_id: segmentId,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as SegmentDetail | null;
}

export async function getMySegmentEfforts(segmentId: string, limit = 20): Promise<SegmentEffort[]> {
  const { data, error } = await supabase.rpc('get_my_segment_efforts', {
    p_segment_id: segmentId,
    p_limit: limit,
  });
  if (error) return [];
  return (data ?? []) as SegmentEffort[];
}

export async function getNearbySegments(
  lat: number,
  lng: number,
  radius = 15000,
): Promise<NearbySegment[]> {
  const { data, error } = await supabase.rpc('get_nearby_segments', {
    p_lat: lat,
    p_lng: lng,
    p_radius: radius,
  });
  if (error) return [];
  return (data ?? []) as NearbySegment[];
}

/** Cria um troço a partir de um intervalo (em metros) de uma atividade minha. */
export async function createSegmentFromActivity(params: {
  activityId: string;
  name: string;
  startMeters: number;
  endMeters: number;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_segment_from_activity', {
    p_activity_id: params.activityId,
    p_name: params.name,
    p_start_m: params.startMeters,
    p_end_m: params.endMeters,
    p_description: params.description ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteSegment(segmentId: string): Promise<void> {
  const { error } = await supabase.from('segments').delete().eq('id', segmentId);
  if (error) throw error;
}

/** Diferença percentual face a uma referência. Positivo = mais rápido. */
export function percentFaster(duration: number, reference: number | null): number | null {
  if (!reference || reference <= 0 || duration <= 0) return null;
  return ((reference - duration) / reference) * 100;
}
