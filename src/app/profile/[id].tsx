import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getProfile } from '../../services/auth';
import { useSettingsStore } from '../../store/settingsStore';
import { getStreak, getUserBadges } from '../../services/gamification';
import { getMyActivities } from '../../services/activities';
import { isFollowing, getFollowerCount, getFollowingCount } from '../../services/social';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { Avatar } from '../../components/common/Avatar';
import { FollowButton } from '../../components/social/FollowButton';
import { StreakBadge } from '../../components/profile/StreakBadge';
import { BadgeCollection } from '../../components/profile/BadgeCollection';
import { ACTIVITY_TYPES } from '../../lib/constants';
import { colors, typography } from '../../lib/theme';
import type { Activity } from '../../lib/types';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

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

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.full_name}
          size={80}
        />
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={{ marginTop: 12 }}>
          <FollowButton userId={id} initialFollowing={following ?? false} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push(`/profile/${id}/follow-list?type=followers`)}
          >
            <Text style={styles.statValue}>{followerCount}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push(`/profile/${id}/follow-list?type=following`)}
          >
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Seguindo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Streak Bar */}
      {streak && (
        <View style={styles.streakWrapper}>
          <StreakBadge
            currentStreak={streak.current_streak}
            longestStreak={streak.longest_streak}
          />
        </View>
      )}

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medalhas</Text>
        <BadgeCollection badges={badges ?? []} />
      </View>

      {/* Activities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atividades</Text>
        {activities && activities.length > 0 ? (
          activities.map((activity: Activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityItem}
              onPress={() => router.push(`/activity/${activity.id}`)}
            >
              <Ionicons name={(ACTIVITY_TYPES.find(t => t.key === activity.type)?.icon ?? 'footsteps') as any} size={24} color={colors.primary} style={styles.activityIcon} />
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
          <Text style={styles.emptyText}>Ainda sem atividades.</Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, fontSize: 16, color: colors.destructive },
  header: { alignItems: 'center', padding: 24, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  name: { ...typography.headline, fontSize: 22, marginTop: 12, color: colors.foreground },
  username: { ...typography.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  bio: { ...typography.body, fontSize: 14, color: colors.mutedForeground, marginTop: 8, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { ...typography.bodyBold, fontSize: 16, color: colors.foreground },
  statLabel: { ...typography.mono, fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  streakWrapper: { marginHorizontal: 16, marginTop: 16 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', padding: 20 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  activityIcon: { fontSize: 24, marginRight: 12 },
  activityInfo: { flex: 1 },
  activityType: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  activityMeta: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
});
