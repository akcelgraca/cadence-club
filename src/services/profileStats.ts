import { supabase } from './supabase';
import type { WeeklySummary, WeeklyDaySummary, MonthlyStat, ProfileStats } from '../lib/types';

export async function getWeeklySummary(userId: string): Promise<WeeklySummary | null> {
  const { data, error } = await supabase
    .rpc('get_weekly_summary', { p_user_id: userId })
    .single();
  if (error) throw error;
  return data as WeeklySummary;
}

export async function getMonthlyStats(userId: string, months: number = 12): Promise<MonthlyStat[]> {
  const { data, error } = await supabase
    .rpc('get_monthly_stats', { p_user_id: userId, p_months: months });
  if (error) throw error;
  return (data ?? []) as MonthlyStat[];
}

export async function getWeeklyDailyBreakdown(userId: string): Promise<WeeklyDaySummary[]> {
  const { data, error } = await supabase
    .rpc('get_weekly_daily_breakdown', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as WeeklyDaySummary[];
}

export interface PersonalRecord {
  distance_category: string;
  best_pace: number; // seconds per km
  best_duration: number; // seconds
  activity_id: string;
  achieved_at: string;
}

export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const { data, error } = await supabase
    .rpc('get_personal_records', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as PersonalRecord[];
}

export async function getProfileStats(userId: string): Promise<ProfileStats | null> {
  const { data, error } = await supabase
    .rpc('get_profile_stats', { p_user_id: userId })
    .single();
  if (error) throw error;
  return data as ProfileStats;
}
