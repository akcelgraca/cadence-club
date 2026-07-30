import { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors, typography, withAlpha } from '../../lib/theme';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';

// Haversine distance between two coordinates in meters
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface PacePoint {
  lat: number;
  lng: number;
  timestamp: string;
}

interface PaceProfileProps {
  points: PacePoint[];
  height?: number;
  style?: any;
}

export function PaceProfile({ points, height = 160, style }: PaceProfileProps) {
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  // Use measured container width minus a small buffer so the curved line
  // and fill don't bleed past the card's rounded border.
  const chartWidth = containerWidth ? containerWidth - 8 : screenWidth - 72;

  if (!points || points.length < 2) {
    return (
      <View style={[styles.card, style]}>
        <Text style={styles.title}>Ritmo</Text>
        <View style={[styles.emptyContainer, { height }]}>
          <Text style={styles.emptyText}>Dados insuficientes para o grafico de ritmo</Text>
        </View>
      </View>
    );
  }

  // Compute pace for each segment (between consecutive points)
  const segments: { distanceKm: number; pace: number }[] = [];
  let cumulativeDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeSec = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;

    // Only include reasonable data points
    if (timeSec > 0 && dist > 0) {
      const pace = timeSec / (dist / 1000); // seconds per km
      // Filter outliers: pace between 1:30/km and 15:00/km
      if (pace > 90 && pace < 900) {
        cumulativeDistance += dist;
        segments.push({
          distanceKm: cumulativeDistance / 1000,
          pace,
        });
      }
    }
  }

  if (segments.length < 2) {
    return (
      <View style={[styles.card, style]}>
        <Text style={styles.title}>Ritmo</Text>
        <View style={[styles.emptyContainer, { height }]}>
          <Text style={styles.emptyText}>Dados insuficientes para o grafico de ritmo</Text>
        </View>
      </View>
    );
  }

  const paces = segments.map((s) => s.pace);
  const bestPace = Math.min(...paces);
  const worstPace = Math.max(...paces);

  // Sample for display
  const maxDisplayPoints = 100;
  let displayData = segments;
  if (segments.length > maxDisplayPoints) {
    const step = (segments.length - 1) / (maxDisplayPoints - 1);
    displayData = [];
    for (let i = 0; i < maxDisplayPoints; i++) {
      displayData.push(segments[Math.round(i * step)]);
    }
  }

  const chartData = displayData.map((s) => ({
    value: s.pace,
    distanceKm: s.distanceKm,
  }));

  const chartSpacing = chartData.length > 1 ? (chartWidth - 20) / (chartData.length - 1) : chartWidth;

  // Invert Y-axis: lower pace = faster = better, so reverse min/max display
  // Actually for pace, lower is better. Display best (lowest) at top, worst (highest) at bottom.

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Ritmo</Text>
        <Text style={styles.total}>
          {formatPace(bestPace, unitSystem)} / {formatPace(worstPace, unitSystem)}
        </Text>
      </View>

      <View
        style={styles.chartWrapper}
        onLayout={(e: { nativeEvent: { layout: { width: number } } }) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <LineChart
          data={chartData}
          width={chartWidth}
          height={height}
          spacing={chartSpacing}
          initialSpacing={10}
          endSpacing={10}
          color={colors.chartAccent}
          thickness={2}
          curved
          curvature={0}
          strokeLinecap="round"
          startFillColor={withAlpha(colors.chartAccent, 0.19)}
          endFillColor={withAlpha(colors.chartAccent, 0)}
          startOpacity={0.3}
          endOpacity={0}
          hideDataPoints
          hideAxesAndRules
          yAxisLabelWidth={0}
          yAxisThickness={0}
          yAxisTextStyle={{ color: 'transparent' }}
          xAxisLabelTextStyle={{ color: 'transparent' }}
          pointerConfig={{
            pointerStripHeight: height - 20,
            pointerStripColor: colors.mutedForeground,
            pointerStripWidth: 1,
            strokeDashArray: [2, 5],
            pointerColor: colors.chartAccent,
            radius: 5,
            pointerLabelWidth: 90,
            pointerLabelHeight: 48,
            autoAdjustPointerLabelPosition: false,
            shiftPointerLabelX: -30,
            pointerLabelComponent: (
              items: { distanceKm?: number; value?: number }[],
            ) => {
              const item = items[0];
              const dist = item?.distanceKm ?? 0;
              const pace = item?.value ?? 0;

              return (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipDistance}>
                    {dist.toFixed(1).replace('.', ',')} km
                  </Text>
                  <Text style={styles.tooltipPace}>{formatPace(pace, unitSystem)}</Text>
                </View>
              );
            },
          }}
        />

        {/* Y-axis labels (best/worst pace) */}
        <View style={[styles.yAxisLabels, { height }]}>
          <Text style={styles.yAxisLabel}>{formatPace(bestPace, unitSystem)}</Text>
          <Text style={styles.yAxisLabel}>{formatPace(worstPace, unitSystem)}</Text>
        </View>
      </View>
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
    color: colors.chartAccent,
  },
  chartWrapper: {
    alignSelf: 'stretch',
    marginBottom: 4,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
  },
  tooltip: {
    backgroundColor: colors.card,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  tooltipDistance: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.foreground,
  },
  tooltipPace: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.chartAccent,
  },
  yAxisLabels: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  yAxisLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 9,
    color: colors.mutedForeground,
  },
});
