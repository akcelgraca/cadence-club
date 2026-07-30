import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getMyActivities } from '../../services/activities';
import { getMonthlyStats } from '../../services/profileStats';
import { MonthlySummaryGrid } from '../../components/history/MonthlySummaryGrid';
import { FilterPills } from '../../components/history/FilterPills';
import type { IntensityFilter } from '../../components/history/FilterPills';
import { RunCard } from '../../components/common/RunCard';
import { EmptyState } from '../../components/common/EmptyState';
import type { Activity } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function deriveIntensity(activity: Activity): string {
  const paceMinPerKm = activity.avg_pace ? activity.avg_pace / 60 : 0;
  if (paceMinPerKm > 0 && paceMinPerKm < 4.5) return 'Intenso';
  if (activity.distance > 10000) return 'Longo';
  return 'Leve';
}

export default function HistoryScreen() {
  const { profile } = useAuthStore();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const userId = profile?.id;
  const [filter, setFilter] = useState<IntensityFilter>('Todas');

  const { data: activities, isLoading, isError } = useQuery({
    queryKey: ['myActivities', userId, 'history'],
    queryFn: () => getMyActivities(userId!, 0, 50),
    enabled: !!userId,
  });

  const { data: monthlyStats, isLoading: isMonthlyLoading } = useQuery({
    queryKey: ['monthlyStats', userId],
    queryFn: () => getMonthlyStats(userId!, 1),
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    if (!activities) return [];
    if (filter === 'Todas') return activities;
    return activities.filter((a) => deriveIntensity(a as Activity) === filter);
  }, [activities, filter]);

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.center}>
        <EmptyState title="Erro ao carregar" subtitle="Tenta novamente mais tarde." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RunCard run={item as Activity} />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerArea}>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Text style={styles.pageTitle}>Histórico</Text>
            </View>
            <MonthlySummaryGrid
              monthlyStats={monthlyStats}
              unitSystem={unitSystem}
              isLoading={isMonthlyLoading}
              activities={activities}
              weightKg={profile?.weight_kg}
            />
            <FilterPills selected={filter} onSelect={setFilter} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma atividade"
            subtitle="Começa a gravar as tuas atividades para veres o histórico."
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  listContent: { padding: 20, paddingBottom: 20 },
  headerArea: { marginBottom: 20 },
  monthLabel: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 14,
    color: colors.mutedForeground,
  },
  pageTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 48,
    color: colors.foreground,
    textTransform: 'uppercase',
    lineHeight: 48,
  },
});
