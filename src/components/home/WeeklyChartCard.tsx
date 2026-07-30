import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useWeeklyDailyBreakdown } from '../../hooks/useProfileStats';
import { colors, typography } from '../../lib/theme';
import { formatDuration } from '../../utils/dateHelpers';
import type { WeeklyDaySummary } from '../../lib/types';

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

interface WeeklyChartCardProps {
  userId: string | undefined;
}

export function WeeklyChartCard({ userId }: WeeklyChartCardProps) {
  const { data, isLoading, isError } = useWeeklyDailyBreakdown(userId);
  const chartData = buildChartData(data ?? []);
  const totalKm = chartData.reduce((sum, d) => sum + d.value, 0);
  const todayIndex = getTodayIndex();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64; // 32 padding each side
  const chartSpacing = (chartWidth - 20) / 7; // (width - initialSpacing*2) / 7 days

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Esta semana</Text>
        <Text style={styles.total}>{totalKm.toFixed(1).replace('.', ',')} km</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Erro ao carregar dados</Text>
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
                      <Text style={styles.tooltipEmpty}>Sem atividades</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
