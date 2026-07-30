import { useQuery } from '@tanstack/react-query';
import { getStreak } from '../services/gamification';

export function useStreaks(userId: string | undefined) {
  return useQuery({
    queryKey: ['streak', userId],
    queryFn: () => getStreak(userId!),
    enabled: !!userId,
  });
}
