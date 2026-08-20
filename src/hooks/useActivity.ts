import { startOfWeek } from '../utils/dateHelpers';
import { useQuery } from '@tanstack/react-query';
import { getActivity, getActivityPoints, getActivitiesSince } from '../services/activities';

export function useActivity(activityId: string | undefined) {
  const activity = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => getActivity(activityId!),
    enabled: !!activityId,
  });

  const points = useQuery({
    queryKey: ['activityPoints', activityId],
    queryFn: () => getActivityPoints(activityId!),
    enabled: !!activityId,
  });

  return {
    activity: activity.data ?? null,
    points: points.data ?? [],
    isLoading: activity.isLoading,
    isError: activity.isError,
    refetch: activity.refetch,
  };
}

/** Atividades da semana corrente — o que alimenta as calorias do resumo. */
export function useWeekActivities(userId: string | undefined) {
  const inicio = startOfWeek();
  return useQuery({
    queryKey: ['weekActivities', userId, inicio.toISOString()],
    queryFn: () => getActivitiesSince(userId!, inicio),
    enabled: !!userId,
  });
}
