jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from './supabase';
import type { SupabaseMock } from '../test-utils/supabaseMock';
import {
  percentFaster,
  detectSegmentEfforts,
  getActivitySegments,
  getSegmentDetail,
  getNearbySegments,
  createSegmentFromActivity,
  deleteSegment,
} from './segments';

const mockSupabase = supabase as unknown as SupabaseMock;

describe('percentFaster', () => {
  it('é positivo quando a passagem foi mais rápida do que a referência', () => {
    expect(percentFaster(90, 100)).toBeCloseTo(10, 9);
    expect(percentFaster(50, 100)).toBeCloseTo(50, 9);
  });

  it('é negativo quando a passagem foi mais lenta', () => {
    expect(percentFaster(110, 100)).toBeCloseTo(-10, 9);
  });

  it('é zero quando iguala a referência', () => {
    expect(percentFaster(100, 100)).toBe(0);
  });

  it('devolve null sem referência utilizável', () => {
    expect(percentFaster(100, null)).toBeNull();
    expect(percentFaster(100, 0)).toBeNull();
    expect(percentFaster(100, -30)).toBeNull();
  });

  it('devolve null para uma duração inválida', () => {
    expect(percentFaster(0, 100)).toBeNull();
    expect(percentFaster(-10, 100)).toBeNull();
  });
});

describe('detectSegmentEfforts', () => {
  it('devolve o número de troços detetados', async () => {
    mockSupabase.setRpc('detect_segment_efforts', { data: 3 });
    await expect(detectSegmentEfforts('activity-1')).resolves.toBe(3);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('detect_segment_efforts', {
      p_activity_id: 'activity-1',
    });
  });

  it('devolve 0 em erro — falhar aqui não pode impedir de guardar o treino', async () => {
    mockSupabase.setRpc('detect_segment_efforts', { error: { message: 'PostGIS timeout' } });
    await expect(detectSegmentEfforts('activity-1')).resolves.toBe(0);
  });

  it('devolve 0 quando não vem contagem', async () => {
    mockSupabase.setRpc('detect_segment_efforts', { data: null });
    await expect(detectSegmentEfforts('activity-1')).resolves.toBe(0);
  });
});

describe('leituras que degradam para lista vazia', () => {
  it('getActivitySegments devolve os troços', async () => {
    mockSupabase.setRpc('get_activity_segments', {
      data: [{ segment_id: 's1', name: 'Subida da Graça' }],
    });
    await expect(getActivitySegments('a1')).resolves.toHaveLength(1);
  });

  it('getActivitySegments devolve vazio em erro', async () => {
    mockSupabase.setRpc('get_activity_segments', { error: { message: 'nope' } });
    await expect(getActivitySegments('a1')).resolves.toEqual([]);
  });

  it('getNearbySegments passa lat, lng e raio', async () => {
    mockSupabase.setRpc('get_nearby_segments', { data: [] });
    await getNearbySegments(38.7223, -9.1393);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_segments', {
      p_lat: 38.7223,
      p_lng: -9.1393,
      p_radius: 15000,
    });
  });

  it('getNearbySegments devolve vazio em erro', async () => {
    mockSupabase.setRpc('get_nearby_segments', { error: { message: 'nope' } });
    await expect(getNearbySegments(0, 0)).resolves.toEqual([]);
  });
});

describe('getSegmentDetail', () => {
  it('desembrulha a linha quando a função devolve um array', async () => {
    mockSupabase.setRpc('get_segment_detail', { data: [{ id: 's1', name: 'Subida' }] });
    await expect(getSegmentDetail('s1')).resolves.toEqual({ id: 's1', name: 'Subida' });
  });

  it('aceita a linha solta', async () => {
    mockSupabase.setRpc('get_segment_detail', { data: { id: 's1', name: 'Subida' } });
    await expect(getSegmentDetail('s1')).resolves.toEqual({ id: 's1', name: 'Subida' });
  });

  it('devolve null para um array vazio', async () => {
    mockSupabase.setRpc('get_segment_detail', { data: [] });
    await expect(getSegmentDetail('s1')).resolves.toBeNull();
  });

  it('devolve null em erro', async () => {
    mockSupabase.setRpc('get_segment_detail', { error: { message: 'nope' } });
    await expect(getSegmentDetail('s1')).resolves.toBeNull();
  });
});

describe('createSegmentFromActivity', () => {
  it('envia o intervalo em metros e devolve o id do troço', async () => {
    mockSupabase.setRpc('create_segment_from_activity', { data: 'segment-9' });

    const id = await createSegmentFromActivity({
      activityId: 'a1',
      name: 'Subida da Graça',
      startMeters: 1200,
      endMeters: 2400,
      description: 'a sério',
    });

    expect(id).toBe('segment-9');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_segment_from_activity', {
      p_activity_id: 'a1',
      p_name: 'Subida da Graça',
      p_start_m: 1200,
      p_end_m: 2400,
      p_description: 'a sério',
    });
  });

  it('envia null quando não há descrição', async () => {
    mockSupabase.setRpc('create_segment_from_activity', { data: 'segment-9' });

    await createSegmentFromActivity({
      activityId: 'a1', name: 'Subida', startMeters: 0, endMeters: 500,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_segment_from_activity',
      expect.objectContaining({ p_description: null }),
    );
  });

  it('propaga o erro — criar um troço é uma escrita, não pode falhar em silêncio', async () => {
    mockSupabase.setRpc('create_segment_from_activity', { error: { message: 'demasiado curto' } });

    await expect(
      createSegmentFromActivity({ activityId: 'a1', name: 'x', startMeters: 0, endMeters: 5 }),
    ).rejects.toEqual({ message: 'demasiado curto' });
  });
});

describe('deleteSegment', () => {
  it('apaga pelo id', async () => {
    const query = mockSupabase.setTable('segments', {});
    await deleteSegment('segment-9');

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', 'segment-9');
  });

  it('propaga o erro', async () => {
    mockSupabase.setTable('segments', { error: { message: 'RLS' } });
    await expect(deleteSegment('segment-9')).rejects.toEqual({ message: 'RLS' });
  });
});
