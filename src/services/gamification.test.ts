jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from './supabase';
import type { SupabaseMock } from '../test-utils/supabaseMock';
import { getAllBadges, getStreak, getUserBadges } from './gamification';

const mockSupabase = supabase as unknown as SupabaseMock;

describe('getAllBadges', () => {
  it('ordena por escalão lógico, não alfabético', () => {
    // Por ordem alfabética viria bronze, gold, platinum, silver — o "gold"
    // antes do "silver" é exatamente o erro que esta ordenação evita.
    mockSupabase.setTable('badges', {
      data: [
        { id: '1', tier: 'gold' },
        { id: '2', tier: 'bronze' },
        { id: '3', tier: 'platinum' },
        { id: '4', tier: 'silver' },
      ],
    });

    return getAllBadges().then((badges) => {
      expect(badges.map((b) => b.tier)).toEqual(['bronze', 'silver', 'gold', 'platinum']);
    });
  });

  it('devolve vazio quando não há emblemas', async () => {
    mockSupabase.setTable('badges', { data: null });
    await expect(getAllBadges()).resolves.toEqual([]);
  });

  it('propaga o erro', async () => {
    mockSupabase.setTable('badges', { error: { message: 'timeout' } });
    await expect(getAllBadges()).rejects.toEqual({ message: 'timeout' });
  });
});

describe('getStreak', () => {
  it('devolve null quando o utilizador ainda não tem sequência', async () => {
    mockSupabase.setTable('streaks', { data: null });
    await expect(getStreak('user-1')).resolves.toBeNull();
  });

  it('filtra pelo utilizador', async () => {
    const query = mockSupabase.setTable('streaks', { data: { current: 4 } });
    await getStreak('user-9');

    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-9');
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('propaga o erro', async () => {
    mockSupabase.setTable('streaks', { error: { message: 'RLS' } });
    await expect(getStreak('user-1')).rejects.toEqual({ message: 'RLS' });
  });
});

describe('getUserBadges', () => {
  it('pede os mais recentes primeiro', async () => {
    const query = mockSupabase.setTable('user_badges', { data: [] });
    await getUserBadges('user-1');

    expect(query.order).toHaveBeenCalledWith('earned_at', { ascending: false });
  });

  it('propaga o erro', async () => {
    mockSupabase.setTable('user_badges', { error: { message: 'RLS' } });
    await expect(getUserBadges('user-1')).rejects.toEqual({ message: 'RLS' });
  });
});
