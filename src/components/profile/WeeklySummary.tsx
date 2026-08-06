import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration } from '../../utils/dateHelpers';
import { useSettingsStore } from '../../store/settingsStore';
import type { WeeklySummary as WeeklySummaryType } from '../../lib/types';
import { colors, typography } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

interface WeeklySummaryProps {
  data: WeeklySummaryType | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function WeeklySummary({ data, isLoading, isError }: WeeklySummaryProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('this_week')}</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('this_week')}</Text>
        <Text style={styles.emptyText}>{t('error_loading_data_period')}</Text>
      </View>
    );
  }

  if (!data || data.activity_count === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('this_week')}</Text>
        <Text style={styles.emptyText}>{t('week_empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('this_week')}</Text>
      <View style={styles.grid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(data.total_distance, unitSystem)}</Text>
          <Text style={styles.statLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDuration(data.total_duration)}</Text>
          <Text style={styles.statLabel}>{t('post_stat_time')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(data.total_elevation)} m</Text>
          <Text style={styles.statLabel}>{t('elevation')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.activity_count}</Text>
          <Text style={styles.statLabel}>{t('profile_activities')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  title: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { ...typography.statNumber, fontSize: 20, color: colors.primary },
  statLabel: { ...typography.mono, fontSize: 12, color: colors.mutedForeground, marginTop: 2, textTransform: 'uppercase' },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 },
});
