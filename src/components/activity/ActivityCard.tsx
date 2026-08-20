import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import type { Activity } from '../../lib/types';
import { ActivityIcon } from '../common/ActivityIcon';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRelativeTime } from '../../utils/dateHelpers';
import { Avatar } from '../common/Avatar';
import { typography, type Colors } from '../../lib/theme';

interface ActivityCardProps {
  activity: Activity;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${activity.id}`)}
    >
      <View style={styles.header}>
        <View style={styles.userRow}>
          <Avatar
            uri={activity.profile?.avatar_url}
            name={activity.profile?.full_name}
            size={40}
            radius={10}
          />
          <View>
            <Text style={styles.userName}>{activity.profile?.full_name ?? 'User'}</Text>
            <Text style={styles.timeAgo}>{formatRelativeTime(activity.created_at)}</Text>
          </View>
        </View>
        <ActivityIcon activityKey={activity.type} size={24} tintColor={c.primary} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDistance(activity.distance, unitSystem)}</Text>
          <Text style={styles.statLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatPace(activity.avg_pace, unitSystem)}</Text>
          <Text style={styles.statLabel}>{t('pace')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(activity.duration / 60)}min</Text>
          <Text style={styles.statLabel}>{t('duration')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {activity.kudos_count ?? 0} {t('kudos')} · {activity.comments_count ?? 0} {t('comments')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userName: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  timeAgo: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 1 },
  typeIcon: { fontSize: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: c.inputBackground, borderRadius: 12, marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { ...typography.statNumber, fontSize: 18, color: c.foreground },
  statLabel: { ...typography.mono, fontSize: 12, color: c.mutedForeground, marginTop: 2, textTransform: 'uppercase' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { ...typography.body, fontSize: 13, color: c.mutedForeground },
});
