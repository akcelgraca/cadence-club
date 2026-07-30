import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration } from '../../utils/dateHelpers';
import { useSettingsStore } from '../../store/settingsStore';
import type { ProfileStats } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

interface StatsGridProps {
  data: ProfileStats | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function StatsGrid({ data, isLoading, isError }: StatsGridProps) {
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Total</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Total</Text>
        <Text style={styles.emptyText}>Erro ao carregar estatísticas.</Text>
      </View>
    );
  }

  if (data.activity_count === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Total</Text>
        <Text style={styles.emptyText}>Ainda sem atividades.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Total</Text>
      <View style={styles.grid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(data.total_distance, unitSystem)}</Text>
          <Text style={styles.statLabel}>Distância</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDuration(data.total_duration)}</Text>
          <Text style={styles.statLabel}>Tempo</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(data.total_elevation)} m</Text>
          <Text style={styles.statLabel}>Elevação</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.activity_count}</Text>
          <Text style={styles.statLabel}>Atividades</Text>
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
