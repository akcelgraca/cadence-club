import { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useAuthStore } from '../../store/authStore';
import { getMyActivities } from '../../services/activities';
import { useWeeklyPlan } from '../../hooks/useTrainingPlan';
import type { QuestionnairePreferences } from '../../lib/types';
import { HomeHeader } from '../../components/home/HomeHeader';
import { TodayGoalCard } from '../../components/home/TodayGoalCard';
import { StatsRow } from '../../components/home/StatsRow';
import { WeeklyChartCard } from '../../components/home/WeeklyChartCard';
import { TrainingPlanCard } from '../../components/home/TrainingPlanCard';
import { RunCard } from '../../components/common/RunCard';
import type { Activity } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  // Refetch when tab gains focus (e.g., after recording activity)
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['myActivities'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySummary'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyDailyBreakdown'] });
    }, [queryClient, userId]),
  );

  const { data: activities } = useQuery({
    queryKey: ['myActivities', userId, 'recent'],
    queryFn: () => getMyActivities(userId!, 0, 3),
    enabled: !!userId,
  });

  const questionnairePrefs = useMemo<QuestionnairePreferences | null>(() => {
    if (!profile?.available_days?.length || !profile?.preferred_activities?.length) return null;
    return {
      available_days: profile.available_days,
      preferred_activities: profile.preferred_activities,
      session_duration: profile.session_duration ?? 'medium',
      fitness_level: profile.fitness_level ?? 'intermediate',
      weekly_frequency: profile.weekly_frequency ?? undefined,
      preferred_time: profile.preferred_time ?? undefined,
      training_focus: profile.training_focus ?? undefined,
    };
  }, [profile?.available_days, profile?.preferred_activities, profile?.session_duration, profile?.fitness_level, profile?.weekly_frequency, profile?.preferred_time, profile?.training_focus]);

  const { plan, todayPlan, isLoading: isPlanLoading } = useWeeklyPlan(userId, profile?.goal, questionnairePrefs, profile?.weekly_km_target);

  const latestRun = activities?.[0] ?? null;

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeHeader profile={profile} />
        <TodayGoalCard todayPlan={todayPlan} isLoading={isPlanLoading} />
        <StatsRow />
        <WeeklyChartCard userId={userId} />
        <TrainingPlanCard
          plan={plan}
          isLoading={isPlanLoading}
        />

        {latestRun && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Última atividade</Text>
              <TouchableOpacity
                style={styles.viewAll}
                onPress={() => router.push('/(tabs)/history')}
              >
                <Text style={styles.viewAllText}>Ver tudo</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <RunCard run={latestRun as Activity} />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 0 },
  content: { padding: 20, paddingTop: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.headline,
    fontSize: 18,
    color: colors.foreground,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
});
