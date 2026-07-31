import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { getStreak, getUserBadges } from '../../services/gamification';
import { getMyActivities } from '../../services/activities';
import { getEquipment } from '../../services/equipment';
import { getFollowerCount, getFollowingCount } from '../../services/social';
import { useWeeklySummary, useMonthlyStats, useProfileStats } from '../../hooks/useProfileStats';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { StreakBadge } from '../../components/profile/StreakBadge';
import { WeeklySummary } from '../../components/profile/WeeklySummary';
import { MonthlyChart } from '../../components/profile/MonthlyChart';
import { StatsGrid } from '../../components/profile/StatsGrid';
import { EquipmentSection } from '../../components/profile/EquipmentSection';
import { TrophyCase } from '../../components/profile/TrophyCase';
import { RoutesSection } from '../../components/profile/RoutesSection';
import { PersonalRecords } from '../../components/profile/PersonalRecords';
import { HealthMetrics } from '../../components/profile/HealthMetrics';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import type { Activity } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuthStore();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const userId = profile?.id;

  const { data: streak } = useQuery({
    queryKey: ['streak', userId],
    queryFn: () => getStreak(userId!),
    enabled: !!userId,
  });

  const { data: badges } = useQuery({
    queryKey: ['badges', userId],
    queryFn: () => getUserBadges(userId!),
    enabled: !!userId,
  });

  const { data: activities } = useQuery({
    queryKey: ['myActivities', userId],
    queryFn: () => getMyActivities(userId!, 0, 20),
    enabled: !!userId,
  });

  const { data: equipment } = useQuery({
    queryKey: ['equipment', userId],
    queryFn: () => getEquipment(userId!),
    enabled: !!userId,
  });

  const { data: weeklySummary, isLoading: weeklyLoading, isError: weeklyError } = useWeeklySummary(userId);
  const { data: monthlyStats, isLoading: monthlyLoading, isError: monthlyError } = useMonthlyStats(userId);
  const { data: profileStats, isLoading: statsLoading, isError: statsError } = useProfileStats(userId);

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['followerCount', userId],
    queryFn: () => getFollowerCount(userId!),
    enabled: !!userId,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ['followingCount', userId],
    queryFn: () => getFollowingCount(userId!),
    enabled: !!userId,
  });

  const handleLogout = () => {
    Alert.alert('Sair', 'Tens a certeza que queres sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) return null;

  const runCount = profileStats?.activity_count ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* 1. ProfileHeader - redesigned */}
        <ProfileHeader profile={profile} isOwnProfile />

      {/* 2. Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{runCount}</Text>
          <Text style={styles.statLabel}>Atividades</Text>
        </View>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push(`/profile/${userId}/follow-list?type=followers`)}
        >
          <Text style={styles.statValue}>{followerCount}</Text>
          <Text style={styles.statLabel}>Seguidores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push(`/profile/${userId}/follow-list?type=following`)}
        >
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>Seguindo</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Personal Records */}
      <PersonalRecords userId={userId} />

      {/* 4. Health Metrics */}
      <HealthMetrics />

      {/* 5. StreakBadge */}
      {streak && (
        <View style={styles.streakWrapper}>
          <StreakBadge
            currentStreak={streak.current_streak}
            longestStreak={streak.longest_streak}
            isActive
          />
        </View>
      )}

      {/* 6. WeeklySummary */}
      <WeeklySummary data={weeklySummary} isLoading={weeklyLoading} isError={weeklyError} />

      {/* 7. MonthlyChart */}
      <MonthlyChart data={monthlyStats} isLoading={monthlyLoading} isError={monthlyError} />

      {/* 8. StatsGrid */}
      <StatsGrid data={profileStats} isLoading={statsLoading} isError={statsError} />

      {/* 9. Activities */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCardTitle}>{t('completed_activities')}</Text>
        {activities && activities.length > 0 ? (
          activities.map((activity: Activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityItem}
              onPress={() => router.push(`/activity/${activity.id}`)}
            >
              <ActivityIcon activityKey={activity.type} size={24} tintColor={colors.primary} style={styles.activityIcon} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityType}>
                  {activity.type === 'run' ? 'Corrida' :
                   activity.type === 'cycle' ? 'Ciclismo' : 'Caminhada'}
                </Text>
                <Text style={styles.activityMeta}>
                  {formatDistance(activity.distance, unitSystem)} · {formatDuration(activity.duration)} · {formatRelativeTime(activity.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Ainda sem atividades. Grava a tua primeira!</Text>
        )}
      </View>

      {/* 10. RoutesSection */}
      <RoutesSection activities={activities} isLoading={false} />

      {/* 11. EquipmentSection */}
      <EquipmentSection
        equipment={equipment}
        isLoading={false}
        isError={false}
        isOwnProfile
      />

      {/* 12. TrophyCase */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCardTitle}>{t('badges_title')}</Text>
        <TrophyCase badges={badges ?? []} />
      </View>

      {/* 13. Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 24,
    color: colors.foreground,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  streakWrapper: { marginHorizontal: 20, marginTop: 16 },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  sectionCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionCardTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', padding: 20 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 12, padding: 14, marginBottom: 8 },
  activityIcon: { fontSize: 24, marginRight: 12 },
  activityInfo: { flex: 1 },
  activityType: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  activityMeta: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  logoutButton: { marginHorizontal: 20, marginTop: 24, padding: 14, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center' },
  logoutText: { ...typography.bodyBold, color: colors.destructive },
});
