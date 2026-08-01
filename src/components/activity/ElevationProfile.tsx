import { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors, typography } from '../../lib/theme';
import { haversineDistance } from '../../utils/geo';

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

interface ElevationProfileProps {
  points: ElevationPoint[];
  height?: number;
  style?: any;
}

export function ElevationProfile({ points, height = 160, style }: ElevationProfileProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  // Full-width chart — uses the measured container width so the line
  // goes edge-to-edge inside the card.
  const chartWidth = containerWidth || screenWidth - 32;

  if (!points || points.length === 0) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.paddedContent}>
          <Text style={styles.title}>Perfil de Elevacao</Text>
          <View style={[styles.loadingContainer, { height }]}>
            <Text style={styles.emptyText}>Sem dados de elevacao</Text>
          </View>
        </View>
      </View>
    );
  }

  // Filter out points without elevation
  const validPoints = points.filter((p) => p.elevation != null && !isNaN(p.elevation));
  if (validPoints.length < 2) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.paddedContent}>
          <Text style={styles.title}>Perfil de Elevacao</Text>
          <View style={[styles.loadingContainer, { height }]}>
            <Text style={styles.emptyText}>Sem dados de elevacao</Text>
          </View>
        </View>
      </View>
    );
  }

  // Compute cumulative distance from start
  const distances: number[] = [0];
  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];
    const d = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    distances.push(distances[i - 1] + d);
  }

  const totalKm = distances[distances.length - 1] / 1000;
  const maxElevation = Math.max(...validPoints.map((p) => p.elevation));
  const minElevation = Math.min(...validPoints.map((p) => p.elevation));

  // Chart data: elevation values vs distance for each point
  const chartData = validPoints.map((p, i) => ({
    value: p.elevation,
    distanceKm: distances[i] / 1000,
  }));

  // Sample chart data to a reasonable number of points for display
  const maxDisplayPoints = 100;
  let displayData = chartData;
  if (chartData.length > maxDisplayPoints) {
    const step = (chartData.length - 1) / (maxDisplayPoints - 1);
    displayData = [];
    for (let i = 0; i < maxDisplayPoints; i++) {
      displayData.push(chartData[Math.round(i * step)]);
    }
  }

  const totalElevationGain = validPoints.reduce((gain, p, i) => {
    if (i === 0) return 0;
    const delta = p.elevation - validPoints[i - 1].elevation;
    return gain + (delta > 0 ? delta : 0);
  }, 0);

  const SIDE_SPACING = 10;
  const chartSpacing = chartData.length > 1
    ? (chartWidth - SIDE_SPACING * 2) / (displayData.length - 1)
    : 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil de Elevacao</Text>
        <Text style={styles.total}>
          {totalKm.toFixed(1).replace('.', ',')} km · {Math.round(totalElevationGain)}m D+
        </Text>
      </View>

      <View
        style={styles.chartWrapper}
        onLayout={(e: { nativeEvent: { layout: { width: number } } }) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <LineChart
          data={displayData}
          width={chartWidth}
          height={height}
          spacing={chartSpacing}
          initialSpacing={SIDE_SPACING}
          endSpacing={SIDE_SPACING}
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
            pointerColor: colors.primary,
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
              const elev = item?.value ?? 0;

              return (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipDistance}>
                    {dist.toFixed(1).replace('.', ',')} km
                  </Text>
                  <Text style={styles.tooltipElevation}>{Math.round(elev)} m</Text>
                </View>
              );
            },
          }}
        />

        {/* Y-axis labels (min/max elevation) */}
        <View style={[styles.yAxisLabels, { height }]}>
          <Text style={styles.yAxisLabel}>{Math.round(maxElevation)}m</Text>
          <Text style={styles.yAxisLabel}>{Math.round(minElevation)}m</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
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
  chartWrapper: {
    alignSelf: 'stretch',
    marginBottom: 4,
    overflow: 'hidden',
  },
  paddedContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
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
  tooltipElevation: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.primary,
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
