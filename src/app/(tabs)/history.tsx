import { useState, useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getMyActivities } from '../../services/activities';
import { getMonthlyStats } from '../../services/profileStats';
import { FilterPills, type CategoryFilter } from '../../components/history/FilterPills';
import { RunCard } from '../../components/common/RunCard';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDistance } from '../../utils/formatDistance';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { Activity, ActivityCategory } from '../../lib/types';
import { colors, typography, withAlpha } from '../../lib/theme';

const PAGE_SIZE = 20;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** tipo de atividade → categoria, construído uma vez. */
const TYPE_TO_CATEGORY: Record<string, ActivityCategory> = {};
for (const cat of ACTIVITY_CATEGORIES) {
  for (const a of cat.activities) {
    TYPE_TO_CATEGORY[a.key] = cat.key as ActivityCategory;
  }
}

interface MonthSection {
  title: string;
  monthKey: string;
  distance: number;
  count: number;
  data: Activity[];
}

export default function HistoryScreen() {
  const { profile } = useAuthStore();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const userId = profile?.id;
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['historyActivities', userId],
    queryFn: ({ pageParam = 0 }) => getMyActivities(userId!, pageParam as number, PAGE_SIZE),
    getNextPageParam: (lastPage, pages) =>
      (lastPage?.length ?? 0) < PAGE_SIZE ? undefined : pages.length,
    initialPageParam: 0,
    enabled: !!userId,
  });

  // Totais reais do ano (independentes da paginação)
  const { data: monthlyStats } = useQuery({
    queryKey: ['monthlyStats', userId, 12],
    queryFn: () => getMonthlyStats(userId!, 12),
    enabled: !!userId,
  });

  const activities = useMemo(
    () => (data?.pages.flat() ?? []) as Activity[],
    [data],
  );

  const availableCategories = useMemo(() => {
    const set = new Set<ActivityCategory>();
    for (const a of activities) {
      const cat = TYPE_TO_CATEGORY[a.type];
      if (cat) set.add(cat);
    }
    return set;
  }, [activities]);

  /**
   * Agrupa por mês. Os totais do cabeçalho são calculados a partir das
   * atividades mostradas — descrevem sempre exatamente as linhas por baixo.
   */
  const sections = useMemo<MonthSection[]>(() => {
    const visible = filter === 'all'
      ? activities
      : activities.filter((a) => TYPE_TO_CATEGORY[a.type] === filter);

    const map = new Map<string, MonthSection>();
    for (const activity of visible) {
      const date = new Date(activity.start_time || activity.created_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      let section = map.get(monthKey);
      if (!section) {
        const year = date.getFullYear();
        const isThisYear = year === new Date().getFullYear();
        section = {
          monthKey,
          title: isThisYear
            ? MONTH_NAMES[date.getMonth()]
            : `${MONTH_NAMES[date.getMonth()]} ${year}`,
          distance: 0,
          count: 0,
          data: [],
        };
        map.set(monthKey, section);
      }
      section.data.push(activity);
      section.distance += activity.distance ?? 0;
      section.count += 1;
    }
    return [...map.values()];
  }, [activities, filter]);

  const yearSummary = useMemo(() => {
    const year = String(new Date().getFullYear());
    const rows = (monthlyStats ?? []).filter((m) => m.month_year.startsWith(year));
    return {
      distance: rows.reduce((sum, m) => sum + m.total_distance, 0),
      count: rows.reduce((sum, m) => sum + m.activity_count, 0),
    };
  }, [monthlyStats]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RunCard run={item} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{section.title}</Text>
            <Text style={styles.monthTotals}>
              {formatDistance(section.distance, unitSystem)} · {section.count}{' '}
              {section.count === 1 ? 'atividade' : 'atividades'}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.headerArea}>
              <Text style={styles.pageTitle}>Histórico</Text>
              <Text style={styles.yearLine}>
                {new Date().getFullYear()} · {formatDistance(yearSummary.distance, unitSystem)} em{' '}
                {yearSummary.count} {yearSummary.count === 1 ? 'atividade' : 'atividades'}
              </Text>
            </View>
            <FilterPills
              selected={filter}
              onSelect={setFilter}
              availableCategories={availableCategories}
            />
          </View>
        }
        ListEmptyComponent={
          filter === 'all' ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>O teu diário começa aqui</Text>
              <Text style={styles.emptyBody}>
                Cada atividade que gravares fica registada por mês, para veres a tua evolução.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/record')}>
                <Ionicons name="play" size={14} color={colors.primaryForeground} />
                <Text style={styles.emptyBtnText}>Registar atividade</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Sem atividades nesta modalidade</Text>
              <Text style={styles.emptyBody}>Escolhe outro filtro para veres o resto.</Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : sections.length > 0 && !hasNextPage ? (
            <Text style={styles.endText}>· fim do histórico ·</Text>
          ) : null
        }
        onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        refreshing={isRefetching}
        onRefresh={refetch}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: colors.background,
  },
  listContent: { paddingBottom: 32, flexGrow: 1 },

  headerArea: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 28,
    lineHeight: 30,
    color: colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yearLine: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 3,
  },

  // Cabeçalho de mês — a estrutura do ecrã é a cronologia
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 15,
    letterSpacing: 1.2,
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  monthTotals: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: colors.mutedForeground,
  },

  cardWrap: { paddingHorizontal: 20, paddingTop: 12 },

  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  endText: {
    ...typography.body,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 24,
  },

  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: colors.foreground, textAlign: 'center' },
  emptyBody: {
    ...typography.body, fontSize: 14, color: colors.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 22, backgroundColor: colors.primary,
  },
  emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },
});
