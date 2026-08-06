import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useWeeklyDailyBreakdown, useWeeklySummary } from '../../hooks/useProfileStats';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, withAlpha } from '../../lib/theme';
import { formatDuration } from '../../utils/dateHelpers';
import type { WeeklyDaySummary } from '../../lib/types';
import { useTranslation } from 'react-i18next';

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

function getTodayIndex(): number {
  // JS getDay(): 0=Sun…6=Sat → map to 0=Mon…6=Sun
  return (new Date().getDay() + 6) % 7;
}

function buildChartData(rows: WeeklyDaySummary[]) {
  // Build a map from day_of_week → full summary
  const dayMap: Record<number, WeeklyDaySummary> = {};
  for (const r of rows) {
    dayMap[r.day_of_week] = r;
  }

  return DAY_LABELS.map((label, i) => ({
    value: (dayMap[i]?.total_distance ?? 0) / 1000,
    label,
    dayOfWeek: i,
    totalDuration: dayMap[i]?.total_duration ?? 0,
    activityCount: dayMap[i]?.activity_count ?? 0,
  }));
}

/** Tempo total da semana em "1h 20" / "45". */
function formatWeeklyTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${mins}` : `${mins}`;
}

/** Ritmo médio da semana em min:seg por km. */
function formatWeeklyPace(distanceMeters: number, durationSeconds: number): string {
  if (!distanceMeters || !durationSeconds) return '--';
  const secPerKm = durationSeconds / (distanceMeters / 1000);
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface WeeklyChartCardProps {
  userId: string | undefined;
}

export function WeeklyChartCard({ userId }: WeeklyChartCardProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWeeklyDailyBreakdown(userId);
  const { data: weekly } = useWeeklySummary(userId);
  const weightKg = useAuthStore((s) => s.profile?.weight_kg) ?? 70;

  // Estimativa MET simples — sem frequência cardíaca não dá para ser exato
  const estCalories = Math.round(weightKg * ((weekly?.total_duration ?? 0) / 3600) * 7);

  const footerStats = [
    {
      icon: 'time-outline' as const,
      value: weekly?.total_duration ? formatWeeklyTime(weekly.total_duration) : '--',
      unit: 'min',
      label: 'Tempo',
    },
    {
      icon: 'flash-outline' as const,
      value: formatWeeklyPace(weekly?.total_distance ?? 0, weekly?.total_duration ?? 0),
      unit: '/km',
      label: t('avg_pace'),
    },
    {
      icon: 'flame-outline' as const,
      value: estCalories > 0 ? estCalories.toLocaleString('pt-PT') : '--',
      unit: 'kcal',
      label: t('calories_estimated'),
    },
  ];
  const chartData = buildChartData(data ?? []);
  const totalKm = chartData.reduce((sum, d) => sum + d.value, 0);
  const todayIndex = getTodayIndex();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64; // 32 padding each side
  const chartSpacing = (chartWidth - 20) / 7; // (width - initialSpacing*2) / 7 days

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('this_week')}</Text>
        <Text style={styles.total}>{totalKm.toFixed(1).replace('.', ',')} km</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>{t('error_loading_data')}</Text>
        </View>
      ) : (
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={140}
            spacing={chartSpacing}
            initialSpacing={20}
            endSpacing={20}
            color={colors.primary}
            thickness={2}
            curved
            curvature={0}
            strokeLinecap="round"
            startFillColor={colors.primary + '30'}
            endFillColor={colors.primary + '00'}
            startOpacity={0.3}
            endOpacity={0}
            hideDataPoints
            hideYAxisText
            hideAxesAndRules
            xAxisLabelTextStyle={{
              fontFamily: 'DMMono_400Regular',
              fontSize: 9,
              color: colors.mutedForeground,
            }}
            yAxisTextStyle={{ color: 'transparent' }}
            pointerConfig={{
              pointerStripHeight: 80,
              pointerStripColor: colors.mutedForeground,
              pointerStripWidth: 1,
              strokeDashArray: [2, 5],
              pointerColor: colors.primary,
              radius: 5,
              pointerLabelWidth: 80,
              pointerLabelHeight: 60,
              autoAdjustPointerLabelPosition: false,
              shiftPointerLabelX: -25,
              pointerLabelComponent: (
                items: { dayOfWeek?: number; totalDuration?: number; activityCount?: number; value?: number }[],
              ) => {
                const item = items[0];
                const dayLabel = DAY_LABELS[item?.dayOfWeek ?? 0];
                const distance = item?.value ?? 0;
                const hasActivities = distance > 0;

                return (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipDay}>{dayLabel}</Text>
                    {hasActivities ? (
                      <View style={styles.tooltipMetrics}>
                        <Text style={styles.tooltipDistance}>
                          {distance.toFixed(1).replace('.', ',')} km
                        </Text>
                        {(item?.totalDuration ?? 0) > 0 && (
                          <Text style={styles.tooltipDuration}>
                            {'\u23F1'} {formatDuration(item?.totalDuration ?? 0)}
                          </Text>
                        )}
                        {(item?.activityCount ?? 0) > 1 && (
                          <Text style={styles.tooltipCount}>{item?.activityCount} atividades</Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.tooltipEmpty}>{t('club_no_activities')}</Text>
                    )}
                  </View>
                );
              },
            }}
          />
          <View style={styles.dotsRow}>
            {chartData.map((d, i) => {
              const dotSize = i === todayIndex ? 10 : 6;
              const left = 30 + i * chartSpacing - dotSize / 2;
              return (
                <View
                  key={DAY_LABELS[i]}
                  style={[
                    styles.dot,
                    { position: 'absolute', left },
                    i === todayIndex
                      ? styles.dotToday
                      : d.value > 0
                        ? styles.dotActive
                        : styles.dotMuted,
                  ]}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Tempo · ritmo · calorias da semana — antes eram três cartões soltos
          sem indicação de período, o que os fazia parecer dados de hoje. */}
      <View style={styles.footer}>
        {footerStats.map((stat, i) => (
          <View key={stat.label} style={styles.footerItem}>
            {i > 0 && <View style={styles.footerDivider} />}
            <View style={styles.footerValueRow}>
              <Text style={styles.footerValue}>{stat.value}</Text>
              <Text style={styles.footerUnit}>{stat.unit}</Text>
            </View>
            <Text style={styles.footerLabel} numberOfLines={1}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.foreground, 0.08),
  },
  footerItem: { flex: 1, alignItems: 'center' },
  footerDivider: {
    position: 'absolute',
    left: 0, top: 2, bottom: 2,
    width: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.foreground, 0.08),
  },
  footerValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  footerValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 20,
    lineHeight: 22,
    color: colors.foreground,
  },
  footerUnit: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 11,
    color: colors.mutedForeground,
  },
  footerLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 18,
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  total: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    color: colors.primary,
  },
  chartWrapper: { alignSelf: 'stretch', marginBottom: 8 },
  loadingContainer: { height: 108, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
  },
  tooltip: {
    backgroundColor: colors.card,
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
  },
  tooltipDay: {
    ...typography.statNumber,
    fontSize: 16,
    color: colors.primary,
    marginBottom: 4,
  },
  tooltipMetrics: {
    alignItems: 'center',
    gap: 2,
  },
  tooltipDistance: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.foreground,
  },
  tooltipDuration: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.mutedForeground,
  },
  tooltipCount: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tooltipEmpty: {
    ...typography.body,
    fontSize: 8,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  dotsRow: { height: 12, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotToday: {
    backgroundColor: colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.background,
  },
  dotActive: { backgroundColor: colors.primary },
  dotMuted: { backgroundColor: colors.border },
});
