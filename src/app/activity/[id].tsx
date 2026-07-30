import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getActivity, getActivityPoints } from '../../services/activities';
import { hasKudosed } from '../../services/social';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { formatDuration, formatDate } from '../../utils/dateHelpers';
import { Avatar } from '../../components/common/Avatar';
import { BoostButton } from '../../components/social/BoostButton';
import { CommentThread } from '../../components/social/CommentThread';
import { ActivityMap } from '../../components/activity/ActivityMap';
import { ElevationProfile } from '../../components/activity/ElevationProfile';
import { ACTIVITY_TYPES } from '../../lib/constants';
import { colors, typography } from '../../lib/theme';

const MOOD_IMAGES: Record<number, any> = {
  1: require('../../../assets/images/moods/mood_1.png'),
  2: require('../../../assets/images/moods/mood_2.png'),
  3: require('../../../assets/images/moods/mood_3.png'),
  4: require('../../../assets/images/moods/mood_4.png'),
  5: require('../../../assets/images/moods/mood_5.png'),
};

export default function ActivityDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
  });

  const { data: kudosed = false } = useQuery({
    queryKey: ['hasKudosed', id],
    queryFn: () => hasKudosed(id),
    enabled: !!id,
  });

  const { data: activityPoints = [] } = useQuery({
    queryKey: ['activityPoints', id],
    queryFn: () => getActivityPoints(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('activity_not_found')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userRow}>
          <Avatar
            uri={activity.profile?.avatar_url}
            name={activity.profile?.full_name}
            size={48}
          />
          <View>
            <Text style={styles.userName}>{activity.profile?.full_name ?? 'User'}</Text>
            <Text style={styles.date}>{formatDate(activity.start_time)}</Text>
          </View>
        </View>
        <Text style={styles.typeIcon}>
          <Ionicons name={(ACTIVITY_TYPES.find(t => t.key === activity.type)?.icon ?? 'footsteps') as any} size={32} color={colors.primary} />
        </Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatDistance(activity.distance, unitSystem)}</Text>
          <Text style={styles.metricLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatDuration(activity.duration)}</Text>
          <Text style={styles.metricLabel}>{t('duration')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatPace(activity.avg_pace, unitSystem)}</Text>
          <Text style={styles.metricLabel}>{t('avg_pace')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{Math.round(activity.elevation_gain)}m</Text>
          <Text style={styles.metricLabel}>{t('elevation')}</Text>
        </View>
      </View>

      {/* Mood */}
      {activity.mood && (
        <View style={styles.moodSection}>
          <Text style={styles.moodLabel}>{t('activity_how_was_it')}</Text>
          <Image source={MOOD_IMAGES[activity.mood]} style={styles.moodImage} />
        </View>
      )}

      {/* Title / Description */}
      {activity.title && <Text style={styles.title}>{activity.title}</Text>}
      {activity.description && <Text style={styles.description}>{activity.description}</Text>}

      {/* Map */}
      {activity.route_summary && (
        <View style={{ marginBottom: 16 }}>
          <ActivityMap
            points={activity.route_summary.map((p) => ({ lat: p[0], lng: p[1] }))}
            height={200}
            terrain={true}
            hillshade={true}
            showContours={true}
          />
        </View>
      )}

      {/* Elevation Profile */}
      {activityPoints.length >= 2 && (
        <ElevationProfile
          points={activityPoints
            .filter((p) => p.elevation != null)
            .map((p) => ({ lat: p.lat, lng: p.lng, elevation: p.elevation! }))}
          height={160}
        />
      )}

      {/* Social row */}
      <View style={styles.socialRow}>
        <BoostButton
          activityId={activity.id}
          initialBoosted={kudosed}
          initialCount={activity.kudos_count ?? 0}
        />
      </View>

      {/* Comments */}
      <CommentThread activityId={activity.id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, fontSize: 16, color: colors.destructive },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userName: { ...typography.bodyBold, fontSize: 16, color: colors.foreground },
  date: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  typeIcon: { fontSize: 32 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  metricItem: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: { ...typography.statNumber, fontSize: 22, color: colors.foreground },
  metricLabel: { ...typography.mono, fontSize: 12, color: colors.mutedForeground, marginTop: 4, textTransform: 'uppercase' },
  moodSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  moodLabel: { ...typography.body, fontSize: 14, color: colors.mutedForeground },
  moodImage: { width: 32, height: 32, borderRadius: 16 },
  title: { ...typography.bodyBold, fontSize: 20, marginBottom: 8, color: colors.foreground },
  description: { ...typography.body, fontSize: 15, color: colors.mutedForeground, marginBottom: 16, lineHeight: 22 },
  socialRow: { paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border },
});
