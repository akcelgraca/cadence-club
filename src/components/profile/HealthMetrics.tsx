import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPace } from '../../utils/formatPace';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration } from '../../utils/dateHelpers';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { ProfileStats } from '../../lib/types';
import { useTranslation } from 'react-i18next';

/**
 * Médias calculadas a partir das atividades reais do utilizador.
 *
 * Frequência cardíaca e VO₂ máx. não aparecem porque a app ainda não lê dados
 * de wearables — mostrar valores aqui seria inventá-los.
 */

interface HealthMetricsProps {
  stats: ProfileStats | null | undefined;
}

export function HealthMetrics({ stats }: HealthMetricsProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  if (!stats || stats.activity_count === 0) return null;

  const avgPaceSecPerKm = stats.total_distance > 0
    ? stats.total_duration / (stats.total_distance / 1000)
    : 0;

  const rows = [
    {
      icon: 'speedometer-outline' as const,
      label: t('health_avg_pace'),
      value: avgPaceSecPerKm > 0 ? formatPace(avgPaceSecPerKm, unitSystem) : '—',
    },
    {
      icon: 'resize-outline' as const,
      label: t('health_avg_distance'),
      value: formatDistance(stats.total_distance / stats.activity_count, unitSystem),
    },
    {
      icon: 'time-outline' as const,
      label: t('health_avg_duration'),
      value: formatDuration(stats.total_duration / stats.activity_count),
    },
    {
      icon: 'trending-up-outline' as const,
      label: t('health_total_elevation'),
      value: `${Math.round(stats.total_elevation)} m`,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('health_averages')}</Text>
      <View style={styles.list}>
        {rows.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.iconGroup}>
              <Ionicons name={item.icon} size={15} color={colors.mutedForeground} />
              <Text style={styles.label}>{item.label}</Text>
            </View>
            <Text style={styles.value}>{item.value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {t('health_watch_hint')}
      </Text>
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
  sectionTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  list: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: 'Barlow_500Medium', fontSize: 14, color: colors.mutedForeground },
  value: { fontFamily: 'DMMono_400Regular', fontSize: 14, color: colors.foreground },
  note: {
    ...typography.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mutedForeground,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.foreground, 0.08),
  },
});
