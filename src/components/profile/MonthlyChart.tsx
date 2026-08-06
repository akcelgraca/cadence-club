import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MONTH_SHORT_KEYS } from '../../lib/constants';
import type { MonthlyStat } from '../../lib/types';
import { colors, typography, withAlpha } from '../../lib/theme';
import { useEffect } from 'react';
import { track } from '../../lib/analytics';

interface MonthlyChartProps {
  data: MonthlyStat[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

function fillMissingMonths(stats: MonthlyStat[], months: number = 12): MonthlyStat[] {
  const now = new Date();
  const result: MonthlyStat[] = [];
  const dataMap = new Map(stats.map((s) => [s.month_year, s]));

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = dataMap.get(key);
    result.push(existing ?? {
      month_year: key,
      total_distance: 0,
      total_duration: 0,
      total_elevation: 0,
      activity_count: 0,
    });
  }
  return result;
}

function getMonthLabel(monthYear: string, t: (k: string) => string): string {
  const month = parseInt(monthYear.split('-')[1], 10);
  const key = MONTH_SHORT_KEYS[month - 1];
  return key ? t(key) : monthYear;
}

/** Round up to a nice number for the chart max */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatKm(value: number): string {
  if (value >= 10) return Math.round(value).toString();
  return value.toFixed(1).replace('.', ',');
}

export function MonthlyChart({ data, isLoading, isError }: MonthlyChartProps) {
  const { t } = useTranslation();

  // Só conta quando há dados — abrir o perfil e ver um esqueleto não é uso.
  useEffect(() => {
    if (data && data.length > 0) track('premium_feature_used', { feature: 'trends' });
  }, [data]);
  const { width: screenWidth } = useWindowDimensions();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('monthly_last_12')}</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20, height: 180 }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('monthly_last_12')}</Text>
        <Text style={styles.emptyText}>{t('error_loading_data_period')}</Text>
      </View>
    );
  }

  const filled = fillMissingMonths(data ?? []);
  const allZero = filled.every((m) => m.total_distance === 0);

  if (allZero) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('monthly_last_12')}</Text>
        <Text style={styles.emptyText}>{t('monthly_empty')}</Text>
      </View>
    );
  }

  // Convert meters to km
  const values = filled.map((m) => Math.round(m.total_distance / 100) / 10);
  const dataMax = Math.max(...values);
  const chartMax = niceMax(dataMax);

  // Y-axis labels: 0, mid, max
  const yMid = chartMax / 2;
  const yLabels = [chartMax, yMid, 0];

  // Layout constants
  const chartHeight = 160;
  const yAxisWidth = 36;
  const paddingX = 0;
  const barsAreaWidth = screenWidth - 32 - 32 - yAxisWidth - paddingX; // 32=margin, 32=container padding
  const barCount = values.length;
  const barGap = 4;
  const barWidth = Math.max(8, (barsAreaWidth - barGap * (barCount - 1)) / barCount);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('monthly_last_12')}</Text>
      <Text style={styles.subtitle}>{t('monthly_distance_km')}</Text>

      <View style={styles.chartRow}>
        {/* Y-axis labels */}
        <View style={[styles.yAxis, { height: chartHeight }]}>
          {yLabels.map((label) => (
            <Text key={label} style={styles.yLabel}>
              {label === 0 ? '0' : formatKm(label)}
            </Text>
          ))}
        </View>

        {/* Chart area */}
        <View style={[styles.chartArea, { height: chartHeight }]}>
          {/* Grid lines */}
          {yLabels.map((label) => (
            <View
              key={`grid-${label}`}
              style={[
                styles.gridLine,
                {
                  top: label === chartMax ? 0 : label === 0 ? chartHeight - 1 : chartHeight / 2,
                },
              ]}
            />
          ))}

          {/* Bars */}
          <View style={styles.barsRow}>
            {values.map((value, i) => {
              const barHeight = chartMax > 0 ? (value / chartMax) * chartHeight : 0;
              const isCurrentMonth = i === values.length - 1;
              return (
                <View key={i} style={styles.barColumn}>
                  <View style={[styles.barWrapper, { height: chartHeight }]}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(barHeight, value > 0 ? 2 : 0),
                          width: barWidth,
                          backgroundColor: isCurrentMonth ? colors.primary : withAlpha(colors.primary, 0.5),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {getMonthLabel(filled[i].month_year, t)}
                  </Text>
                </View>
              );
            })}
          </View>
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
  title: { ...typography.headline, fontSize: 18, marginBottom: 2, color: colors.foreground },
  subtitle: { ...typography.mono, fontSize: 11, color: colors.mutedForeground, marginBottom: 16 },
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 18, // align with bottom of bars (above month labels)
  },
  yLabel: {
    ...typography.mono,
    fontSize: 10,
    color: colors.mutedForeground,
    lineHeight: 12,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    marginBottom: 18, // space for month labels
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    borderRadius: 3,
    minHeight: 0,
  },
  barLabel: {
    ...typography.mono,
    fontSize: 8,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 30 },
});
