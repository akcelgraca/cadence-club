import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
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
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;

/**
 * Chaves, não texto. Estava meio migrado: as seis primeiras já eram chaves e as
 * seis últimas tinham ficado em português — e nenhuma delas passava pelo `t()`,
 * portanto os meses de janeiro a junho apareciam no ecrã como `month_jan`.
 */
const MONTH_KEYS = [
  'month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun',
  'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec',
];

/** tipo de atividade → categoria, construído uma vez. */
const TYPE_TO_CATEGORY: Record<string, ActivityCategory> = {};
for (const cat of ACTIVITY_CATEGORIES) {
  for (const a of cat.activities) {
    TYPE_TO_CATEGORY[a.key] = cat.key as ActivityCategory;
  }
}

interface MonthSection {
  monthI18nKey: string;
  /** Null no ano corrente — nesse caso o título é só o mês. */
  year: number | null;
  monthKey: string;
  distance: number;
  count: number;
  data: Activity[];
}

export default function HistoryScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
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
          // Só a chave e o ano; o `t()` fica para o momento de desenhar, que é
          // o que permite trocar de idioma sem reconstruir as secções.
          monthI18nKey: MONTH_KEYS[date.getMonth()],
          year: isThisYear ? null : year,
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
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.center}>
        <EmptyState title={t('error_loading')} subtitle={t('error_try_later')} />
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
            <Text style={styles.monthTitle}>
              {t(section.monthI18nKey as any)}{section.year ? ` ${section.year}` : ''}
            </Text>
            <Text style={styles.monthTotals}>
              {formatDistance(section.distance, unitSystem)} · {section.count}{' '}
              {t(section.count === 1 ? 'history_activity_one' : 'history_activity_other')}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.headerArea}>
              <Text style={styles.pageTitle}>{t('tab_history')}</Text>
              <Text style={styles.yearLine}>
                {new Date().getFullYear()} · {formatDistance(yearSummary.distance, unitSystem)}{' '}
                {t('history_year_in')} {yearSummary.count}{' '}
                {t(yearSummary.count === 1 ? 'history_activity_one' : 'history_activity_other')}
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
                <Ionicons name="calendar-outline" size={40} color={c.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('history_empty_title')}</Text>
              <Text style={styles.emptyBody}>
                {t('history_empty_body')}
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/record')}>
                <Ionicons name="play" size={14} color={c.primaryForeground} />
                <Text style={styles.emptyBtnText}>{t('history_record_activity')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('history_empty_filter')}</Text>
              <Text style={styles.emptyBody}>{t('history_empty_filter_body')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={c.primary} />
            </View>
          ) : sections.length > 0 && !hasNextPage ? (
            <Text style={styles.endText}>{t('history_end')}</Text>
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

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: c.background,
  },
  listContent: { paddingBottom: 32, flexGrow: 1 },

  headerArea: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 28,
    lineHeight: 30,
    color: c.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yearLine: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 3,
  },

  // Cabeçalho de mês — a estrutura do ecrã é a cronologia
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: c.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  monthTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 15,
    letterSpacing: 1.2,
    color: c.foreground,
    textTransform: 'uppercase',
  },
  monthTotals: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: c.mutedForeground,
  },

  cardWrap: { paddingHorizontal: 20, paddingTop: 12 },

  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  endText: {
    ...typography.body,
    fontSize: 11,
    letterSpacing: 1.5,
    color: c.mutedForeground,
    textAlign: 'center',
    paddingVertical: 24,
  },

  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: c.foreground, textAlign: 'center' },
  emptyBody: {
    ...typography.body, fontSize: 14, color: c.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 22, backgroundColor: c.primary,
  },
  emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: c.primaryForeground },
});
