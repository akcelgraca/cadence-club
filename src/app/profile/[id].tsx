import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getProfile } from '../../services/auth';
import { useSettingsStore } from '../../store/settingsStore';
import { getStreak, getUserBadges } from '../../services/gamification';
import { getMyActivities } from '../../services/activities';
import { isFollowing, getFollowerCount, getFollowingCount } from '../../services/social';
import { useProfileStats } from '../../hooks/useProfileStats';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { ProfileHero } from '../../components/profile/ProfileHero';
import { StreakBadge } from '../../components/profile/StreakBadge';
import { StatsGrid } from '../../components/profile/StatsGrid';
import { PersonalRecords } from '../../components/profile/PersonalRecords';
import { BadgeCollection } from '../../components/profile/BadgeCollection';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import { getActivityByKey } from '../../lib/constants';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { Activity } from '../../lib/types';

const TABS = [
  { key: 'atividades', label: 'Atividades' },
  { key: 'conquistas', label: 'Conquistas' },
] as const;

export default function UserProfileScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { width } = useWindowDimensions();

  const pagerRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  const goToTab = useCallback((index: number) => {
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  }, [width]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id),
    enabled: !!id,
  });

  const { data: streak } = useQuery({
    queryKey: ['streak', id],
    queryFn: () => getStreak(id),
    enabled: !!id,
  });

  const { data: badges } = useQuery({
    queryKey: ['badges', id],
    queryFn: () => getUserBadges(id),
    enabled: !!id,
  });

  const { data: activities } = useQuery({
    queryKey: ['userActivities', id],
    queryFn: () => getMyActivities(id, 0, 20),
    enabled: !!id,
  });

  const { data: following } = useQuery({
    queryKey: ['isFollowing', id],
    queryFn: () => isFollowing(id),
    enabled: !!id,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['followerCount', id],
    queryFn: () => getFollowerCount(id),
    enabled: !!id,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ['followingCount', id],
    queryFn: () => getFollowingCount(id),
    enabled: !!id,
  });

  const { data: profileStats, isLoading: statsLoading, isError: statsError } = useProfileStats(id);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Utilizador não encontrado.</Text>
      </View>
    );
  }

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
          <ActivityIcon activityKey={activity.type} size={18} tintColor={colors.primary} />
        </View>
        <View style={styles.activityInfo}>
          <Text style={styles.activityType} numberOfLines={1}>
            {activity.title || (def ? t(def.i18n_key as any) : activity.type)}
          </Text>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {formatDistance(activity.distance, unitSystem)} · {formatDuration(activity.duration)} · {formatRelativeTime(activity.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* O título da barra mostra quem estamos a ver, não um "Perfil" genérico */}
      <Stack.Screen options={{ title: profile.full_name || `@${profile.username}` }} />

      <ProfileHero
        profile={profile}
        streakDays={streak?.current_streak ?? 0}
        activityCount={profileStats?.activity_count ?? 0}
        followerCount={followerCount}
        followingCount={followingCount}
        isFollowing={following ?? false}
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
        {/* ── Atividades ── */}
        <View style={{ width }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
            <StatsGrid data={profileStats} isLoading={statsLoading} isError={statsError} />
            <PersonalRecords userId={id} />

            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Recentes</Text>
              {activities && activities.length > 0 ? (
                (activities as Activity[]).map(renderActivityRow)
              ) : (
                <View style={styles.emptyBlock}>
                  <Ionicons name="pulse-outline" size={36} color={colors.mutedForeground} />
                  <Text style={styles.emptyTitle}>Ainda sem atividades</Text>
                  <Text style={styles.emptyText}>
                    Quando {profile.full_name?.split(' ')[0] ?? 'este atleta'} registar atividades, aparecem aqui.
                  </Text>
                </View>
              )}
            </View>
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
                />
              </View>
            )}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Medalhas</Text>
              <BadgeCollection badges={badges ?? []} />
            </View>
          </ScrollView>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, fontSize: 16, color: colors.destructive },
  pager: { flex: 1 },
  pageContent: { paddingBottom: 40 },

  // Abas
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 13,
    letterSpacing: 0.3,
    color: colors.mutedForeground,
  },
  tabTextActive: { fontFamily: 'Barlow_600SemiBold', color: colors.foreground },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },

  // Secções
  sectionCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionCardTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  streakWrapper: { marginHorizontal: 16, marginTop: 16 },

  // Atividades
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activityIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
  },
  activityInfo: { flex: 1, minWidth: 0 },
  activityType: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  activityMeta: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Vazio
  emptyBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  emptyText: {
    ...typography.body, fontSize: 13, color: colors.mutedForeground,
    textAlign: 'center', lineHeight: 18,
  },
});
