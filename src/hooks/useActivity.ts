import { useQuery } from '@tanstack/react-query';
import { getActivity, getActivityPoints } from '../services/activities';

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
