import { useCallback, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
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
import { WeeklyChartCard } from '../../components/home/WeeklyChartCard';
import { TrainingPlanCard } from '../../components/home/TrainingPlanCard';
import { ChallengesCard } from '../../components/home/ChallengesCard';
import { UpcomingEventsCard } from '../../components/home/UpcomingEventsCard';
import { RunCard } from '../../components/common/RunCard';
import type { Activity } from '../../lib/types';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
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
      queryClient.invalidateQueries({ queryKey: ['activeChallenges'] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
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
        <WeeklyChartCard userId={userId} />
        <TrainingPlanCard
          plan={plan}
          isLoading={isPlanLoading}
        />
        <ChallengesCard />
        <UpcomingEventsCard />

        {latestRun ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home_last_activity')}</Text>
              <TouchableOpacity
                style={styles.viewAll}
                onPress={() => router.push('/(tabs)/history')}
              >
                <Text style={styles.viewAllText}>{t('home_view_history')}</Text>
                <Ionicons name="chevron-forward" size={12} color={c.primary} />
              </TouchableOpacity>
            </View>
            <RunCard run={latestRun as Activity} />
          </View>
        ) : (
          // Conta nova: o ecrã não pode acabar em nada — aponta o caminho
          <TouchableOpacity
            style={styles.firstRun}
            onPress={() => router.push('/record')}
            activeOpacity={0.85}
          >
            <View style={styles.firstRunIcon}>
              <Ionicons name="pulse-outline" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.firstRunTitle}>{t('home_first_activity')}</Text>
              <Text style={styles.firstRunSub}>
                {t('home_first_activity_body')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingTop: 0 },
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
    color: c.foreground,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: c.primary,
  },
  firstRun: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  firstRunIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
  },
  firstRunTitle: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  firstRunSub: {
    ...typography.body, fontSize: 12,
    color: c.mutedForeground, marginTop: 2, lineHeight: 16,
  },
});
