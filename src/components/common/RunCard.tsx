import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import type { Activity } from '../../lib/types';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, typography, runTypeColors } from '../../lib/theme';
import { getActivityByKey } from '../../lib/constants';
import { useTranslation } from 'react-i18next';

function deriveIntensity(activity: Activity): string {
  const paceMinPerKm = activity.avg_pace ? activity.avg_pace / 60 : 0;
  if (paceMinPerKm > 0 && paceMinPerKm < 4.5) return 'Intenso';
  if (activity.distance > 10000) return 'Longo';
  return 'Leve';
}

interface RunCardProps {
  run: Activity;
}

export function RunCard({ run }: RunCardProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const intensity = deriveIntensity(run);
  const typeColor = runTypeColors[intensity] ?? colors.mutedForeground;
  const activityDef = getActivityByKey(run.type);
  const activityLabel = activityDef ? t(activityDef.i18n_key as any) : run.type;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${run.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title} numberOfLines={1}>
            {run.title || activityLabel}
          </Text>
          <Text style={styles.date}>{formatRelativeTime(run.created_at)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: typeColor + '20' }]}>
          <Text style={[styles.badgeText, { color: typeColor }]}>{intensity}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDistance(run.distance, unitSystem)}</Text>
          <Text style={styles.statLabel}>{t('stat_distance_lower')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(run.duration)}</Text>
          <Text style={styles.statLabel}>{t('stat_time_lower')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.pace]}>{formatPace(run.avg_pace, unitSystem)}</Text>
          <Text style={styles.statLabel}>{t('stat_pace_lower')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleGroup: { flex: 1, marginRight: 12 },
  title: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 22,
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  date: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 22,
    color: colors.foreground,
  },
  pace: { color: colors.primary },
  statLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
