import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAndSavePlan, updateTrainingPlanDay, generateWeeklyPlan, generatePersonalizedPlan } from '../services/trainingPlan';
import { useWeeklyDailyBreakdown } from './useProfileStats';
import type { ActivityGoal, TrainingPlanDay, QuestionnairePreferences } from '../lib/types';

function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function useWeeklyPlan(
  userId: string | undefined,
  goal: ActivityGoal | null | undefined,
  preferences?: QuestionnairePreferences | null,
  weeklyKmTarget?: number | null,
) {
  const queryClient = useQueryClient();

  // Fetch the training plan (or generate if not exists)
  const planQuery = useQuery({
    queryKey: ['weeklyPlan', userId, goal],
    queryFn: async () => {
      if (!userId) return [];
      try {
        return await generateAndSavePlan(userId, goal ?? null, preferences ?? null, weeklyKmTarget);
      } catch (err) {
        console.warn('[useWeeklyPlan] DB error, falling back to local plan:', err);
        // Fall back to a locally generated plan (not persisted) so the UI still shows goals
        const localPlan = (preferences && preferences.available_days.length > 0)
          ? generatePersonalizedPlan(preferences)
          : generateWeeklyPlan(goal ?? null, weeklyKmTarget);
        return localPlan.map((day, i) => ({
          ...day,
          id: `local-${i}`,
          user_id: userId,
          week_start: '',
          is_completed: false,
        })) as TrainingPlanDay[];
      }
    },
    enabled: !!userId && !!goal,
    staleTime: 1000 * 60 * 30, // 30 min
  });

  // Fetch daily breakdown to get actual distances
  const breakdownQuery = useWeeklyDailyBreakdown(userId);

  // Merge plan with actual data
  const todayIndex = getTodayDayOfWeek();
  const enrichedPlan = (planQuery.data ?? []).map((day) => {
    const actual = (breakdownQuery.data ?? []).find(
      (b) => b.day_of_week === day.day_of_week
    );
    return {
      ...day,
      today: day.day_of_week === todayIndex,
      actual_distance: actual?.total_distance ?? 0,
    };
  });

  // Find today's plan entry
  const todayPlan = enrichedPlan.find((d) => d.today) ?? null;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<TrainingPlanDay, 'activity_type' | 'label' | 'target_distance' | 'target_duration'>> }) =>
      updateTrainingPlanDay(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyPlan', userId] });
    },
  });

  return {
    plan: enrichedPlan,
    todayPlan,
    isLoading: planQuery.isLoading,
    isError: planQuery.isError,
    updateDay: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
