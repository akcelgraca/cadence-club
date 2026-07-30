import { useQuery } from '@tanstack/react-query';
import { getWeeklySummary, getWeeklyDailyBreakdown, getMonthlyStats, getProfileStats } from '../services/profileStats';

export function useWeeklySummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['weeklySummary', userId],
    queryFn: () => getWeeklySummary(userId!),
    enabled: !!userId,
  });
}

export function useMonthlyStats(userId: string | undefined, months: number = 12) {
  return useQuery({
    queryKey: ['monthlyStats', userId, months],
    queryFn: () => getMonthlyStats(userId!, months),
    enabled: !!userId,
  });
}

export function useWeeklyDailyBreakdown(userId: string | undefined) {
  return useQuery({
    queryKey: ['weeklyDailyBreakdown', userId],
    queryFn: () => getWeeklyDailyBreakdown(userId!),
    enabled: !!userId,
  });
}

export function useProfileStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['profileStats', userId],
    queryFn: () => getProfileStats(userId!),
    enabled: !!userId,
  });
}
