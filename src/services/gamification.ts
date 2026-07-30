import { supabase } from './supabase';
import type { Streak, UserBadge, Badge, BadgeTier } from '../lib/types';

const BADGE_TIER_ORDER: Record<BadgeTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

export async function getStreak(userId: string): Promise<Streak | null> {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*), activity:activities(id, title, type)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase.from('badges').select('*');
  if (error) throw error;
  // Sort by logical tier order (bronze → silver → gold → platinum), not alphabetical
  return (data ?? []).sort((a, b) => BADGE_TIER_ORDER[a.tier as BadgeTier] - BADGE_TIER_ORDER[b.tier as BadgeTier]);
}
