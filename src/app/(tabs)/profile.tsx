import { useState, useRef, useCallback, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Animated, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getStreak, getUserBadges } from '../../services/gamification';
import { getMyActivities } from '../../services/activities';
import { getEquipment } from '../../services/equipment';
import { getFollowerCount, getFollowingCount } from '../../services/social';
import { useWeeklySummary, useMonthlyStats, useProfileStats } from '../../hooks/useProfileStats';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { ProfileHero } from '../../components/profile/ProfileHero';
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
import { getActivityByKey } from '../../lib/constants';
import type { Activity } from '../../lib/types';
import { typography, withAlpha, type Colors } from '../../lib/theme';

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'atividades', label: 'Atividades' },
  { key: 'conquistas', label: 'Conquistas' },
] as const;

const RECENT_LIMIT = 6;

export default function ProfileScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { profile, signOut } = useAuthStore();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const userId = profile?.id;
  const { width } = useWindowDimensions();

  const pagerRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  const goToTab = useCallback((index: number) => {
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  }, [width]);

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
    Alert.alert(t('profile_logout'), t('profile_logout_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) return null;

  const recent = (activities ?? []).slice(0, RECENT_LIMIT) as Activity[];

  const ready = tabLayouts.length === TABS.length && tabLayouts.every(Boolean);
  const indicatorLeft = ready
    ? scrollX.interpolate({
        inputRange: TABS.map((_, i) => i * width),
        outputRange: tabLayouts.map((l) => l.x),
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);
  const indicatorWidth = ready
    ? scrollX.interpolate({
        inputRange: TABS.map((_, i) => i * width),
        outputRange: tabLayouts.map((l) => l.width),
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);

  const renderActivityRow = (activity: Activity) => {
    const def = getActivityByKey(activity.type);
    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.activityItem}
        onPress={() => router.push(`/activity/${activity.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.activityIconWrap}>
          <ActivityIcon activityKey={activity.type} size={18} tintColor={c.primary} />
        </View>
        <View style={styles.activityInfo}>
          <Text style={styles.activityType} numberOfLines={1}>
            {activity.title || (def ? t(def.i18n_key as any) : activity.type)}
          </Text>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {formatDistance(activity.distance, unitSystem)} · {formatDuration(activity.duration)} · {formatRelativeTime(activity.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProfileHero
        profile={profile}
        isOwnProfile
        streakDays={streak?.current_streak ?? 0}
        activityCount={profileStats?.activity_count ?? 0}
        followerCount={followerCount}
        followingCount={followingCount}
      />

      {/* Abas */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => goToTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setTabLayouts((prev) => {
                  const next = [...prev];
                  next[i] = { x, width: w };
                  return next;
                });
              }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
        {ready && (
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, width: indicatorWidth }]} />
        )}
      </View>

      {/* Pager */}
      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {/* ── Resumo ── */}
        <View style={{ width }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
            <WeeklySummary data={weeklySummary} isLoading={weeklyLoading} isError={weeklyError} />
            <MonthlyChart data={monthlyStats} isLoading={monthlyLoading} isError={monthlyError} />
            <StatsGrid data={profileStats} isLoading={statsLoading} isError={statsError} />
            <HealthMetrics stats={profileStats} />
            <EquipmentSection
              equipment={equipment}
              isLoading={false}
              isError={false}
              isOwnProfile
            />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={17} color={c.destructive} />
              <Text style={styles.logoutText}>{t('profile_sign_out')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Atividades ── */}
        <View style={{ width }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionCardTitle}>{t('profile_recent')}</Text>
                <TouchableOpacity
                  style={styles.viewAll}
                  onPress={() => router.push('/(tabs)/history')}
                >
                  <Text style={styles.viewAllText}>{t('home_view_history')}</Text>
                  <Ionicons name="chevron-forward" size={12} color={c.primary} />
                </TouchableOpacity>
              </View>

              {recent.length > 0 ? (
                recent.map(renderActivityRow)
              ) : (
                <View style={styles.emptyBlock}>
                  <Ionicons name="pulse-outline" size={36} color={c.mutedForeground} />
                  <Text style={styles.emptyTitle}>{t('profile_no_activities')}</Text>
                  <Text style={styles.emptyText}>{t('profile_record_first')}</Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => router.push('/(tabs)/recordTab')}
                  >
                    <Text style={styles.emptyBtnText}>{t('history_record_activity')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <PersonalRecords userId={userId} />
            <RoutesSection activities={activities} isLoading={false} />
          </ScrollView>
        </View>

        {/* ── Conquistas ── */}
        <View style={{ width }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
            {streak && (
              <View style={styles.streakWrapper}>
                <StreakBadge
                  currentStreak={streak.current_streak}
                  longestStreak={streak.longest_streak}
                  isActive
                />
              </View>
            )}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>{t('badges_title')}</Text>
              <TrophyCase badges={badges ?? []} />
            </View>
          </ScrollView>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  pager: { flex: 1 },
  pageContent: { paddingBottom: 32 },

  // Abas
  tabs: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 13,
    letterSpacing: 0.3,
    color: c.mutedForeground,
  },
  tabTextActive: { fontFamily: 'Barlow_600SemiBold', color: c.foreground },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: c.primary,
    borderRadius: 1,
  },

  // Secções
  sectionCard: {
    backgroundColor: c.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionCardTitle: { ...typography.headline, fontSize: 18, color: c.foreground },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: c.primary },

  streakWrapper: { marginHorizontal: 16, marginTop: 16 },

  // Atividades
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  activityIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
  },
  activityInfo: { flex: 1, minWidth: 0 },
  activityType: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  activityMeta: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 2,
  },

  // Estado vazio
  emptyBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  emptyText: { ...typography.body, fontSize: 13, color: c.mutedForeground, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, backgroundColor: c.primary,
  },
  emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: c.primaryForeground },

  // Sair
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(c.destructive, 0.35),
  },
  logoutText: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: c.destructive },
});
