import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFeed } from '../../hooks/useFeed';
import { getDiscoverActivities } from '../../services/activities';
import { getSuggestedProfiles } from '../../services/social';
import { Avatar } from '../common/Avatar';
import { FollowButton } from './FollowButton';
import { useFeedStore } from '../../store/feedStore';
import { useAuthStore } from '../../store/authStore';
import { SocialPostCard } from './SocialPostCard';
import { colors, typography, withAlpha } from '../../lib/theme';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { Activity, ActivityCategory } from '../../lib/types';
import { ActivityIcon } from '../common/ActivityIcon';

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORY_SAMPLE: Record<string, string> = {
  foot: 'run', cycling: 'cycle', strength: 'weight_training',
  racquet: 'tennis', water: 'swimming', winter: 'snowboard',
  team: 'football', other: 'yoga',
};

const FILTER_OPTIONS: { key: ActivityCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'feed_filter_all' },
  ...ACTIVITY_CATEGORIES.map((c) => ({ key: c.key, label: c.i18n_key })),
];

// ─── skeleton card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View style={[skeletonStyles.card, { opacity }]}>
      {/* Author row */}
      <View style={skeletonStyles.authorRow}>
        <View style={skeletonStyles.avatar} />
        <View style={skeletonStyles.authorLines}>
          <View style={[skeletonStyles.line, { width: '50%', height: 13 }]} />
          <View style={[skeletonStyles.line, { width: '35%', height: 10, marginTop: 5 }]} />
        </View>
      </View>
      {/* Map placeholder */}
      <View style={skeletonStyles.map} />
      {/* Stats row */}
      <View style={skeletonStyles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={skeletonStyles.statBox}>
            <View style={[skeletonStyles.line, { width: '60%', height: 20 }]} />
            <View style={[skeletonStyles.line, { width: '80%', height: 8, marginTop: 5 }]} />
          </View>
        ))}
      </View>
      {/* Actions */}
      <View style={skeletonStyles.actions}>
        {[1, 2, 3].map((i) => <View key={i} style={skeletonStyles.actionCircle} />)}
      </View>
      {/* Hairline */}
      <View style={skeletonStyles.hairline} />
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { backgroundColor: colors.background },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border },
  authorLines: { flex: 1, gap: 4 },
  line: { backgroundColor: colors.border, borderRadius: 4 },
  map: { width: '100%', aspectRatio: 3 / 2, backgroundColor: colors.border },
  statsRow: { flexDirection: 'row', paddingVertical: 4 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  actions: { flexDirection: 'row', gap: 8, padding: 10 },
  actionCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border },
  hairline: { height: 8, backgroundColor: withAlpha(colors.foreground, 0.04) },
});

// ─── filter chips ─────────────────────────────────────────────────────────────

function FilterBar() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const filter = useFeedStore((s) => s.filter);
  const setFilter = useFeedStore((s) => s.setFilter);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
      style={filterStyles.container}
    >
      {/* Following toggle */}
      {profile && (
        <TouchableOpacity
          style={[filterStyles.chip, filter.following && filterStyles.chipActive]}
          onPress={() => setFilter({ following: !filter.following })}
        >
          <Ionicons
            name={filter.following ? 'people' : 'people-outline'}
            size={13}
            color={filter.following ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text style={[filterStyles.chipText, filter.following && filterStyles.chipTextActive]}>
            Seguidos
          </Text>
        </TouchableOpacity>
      )}

      {/* Separator */}
      {profile && <View style={filterStyles.vertDivider} />}

      {/* Category chips */}
      {FILTER_OPTIONS.map((opt) => {
        const isActive = filter.category === opt.key;
        const sampleKey = CATEGORY_SAMPLE[opt.key];
        return (
          <TouchableOpacity
            key={opt.key}
            style={[filterStyles.chip, isActive && filterStyles.chipActive]}
            onPress={() => setFilter({ category: opt.key })}
          >
            {opt.key === 'all'
              ? <Ionicons name="apps" size={13} color={isActive ? colors.primaryForeground : colors.mutedForeground} />
              : sampleKey
                ? <ActivityIcon activityKey={sampleKey} size={13} tintColor={isActive ? colors.primaryForeground : colors.mutedForeground} />
                : <Ionicons name="ellipse-outline" size={13} color={isActive ? colors.primaryForeground : colors.mutedForeground} />
            }
            <Text style={[filterStyles.chipText, isActive && filterStyles.chipTextActive]}>
              {t(opt.label as any)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const filterStyles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.bodyMedium, fontSize: 12, color: colors.mutedForeground },
  chipTextActive: { color: colors.primaryForeground },
  vertDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
});

// ─── search bar (atalho para a pesquisa global) ──────────────────────────────
// Abre /search — pesquisa de pessoas (seguir), rotas (guardar) e cidades.

function SearchBar() {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={searchStyles.container}
      onPress={() => router.push('/search')}
      activeOpacity={0.7}
      accessibilityRole="search"
    >
      <Ionicons name="search" size={14} color={colors.mutedForeground} />
      <Text style={searchStyles.placeholder}>{t('feed_search_placeholder')}</Text>
    </TouchableOpacity>
  );
}

const searchStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginBottom: 4,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  placeholder: { flex: 1, ...typography.body, fontSize: 13, color: colors.mutedForeground },
});

// ─── empty state ─────────────────────────────────────────────────────────────

/** Sugestões de pessoas para seguir — evita o feed em branco para contas novas. */
function SuggestedPeople() {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['suggestedProfiles'],
    queryFn: () => getSuggestedProfiles(10),
  });

  if (isLoading || people.length === 0) return null;

  return (
    <View style={emptyStyles.suggestSection}>
      <Text style={emptyStyles.sectionTitle}>Pessoas para seguir</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={emptyStyles.peopleRow}>
        {people.map((p: any) => (
          <View key={p.id} style={emptyStyles.personCard}>
            <TouchableOpacity onPress={() => router.push(`/profile/${p.id}`)} activeOpacity={0.8}>
              <Avatar uri={p.avatar_url} name={p.full_name} size={56} />
            </TouchableOpacity>
            <Text style={emptyStyles.personName} numberOfLines={1}>{p.full_name ?? 'Atleta'}</Text>
            {!!p.city && <Text style={emptyStyles.personCity} numberOfLines={1}>{p.city}</Text>}
            <FollowButton userId={p.id} initialFollowing={false} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function EmptyFeed({ following }: { following: boolean }) {
  const { data: discover = [] } = useQuery({
    queryKey: ['discoverActivities'],
    queryFn: () => getDiscoverActivities(8),
  });

  return (
    <View>
      <View style={emptyStyles.container}>
        <View style={emptyStyles.iconWrap}>
          <Ionicons name={following ? 'people-outline' : 'compass-outline'} size={40} color={colors.primary} />
        </View>
        <Text style={emptyStyles.title}>
          {following ? 'Nada por aqui ainda' : 'Vamos começar'}
        </Text>
        <Text style={emptyStyles.sub}>
          {following
            ? 'As atividades das pessoas que segues vão aparecer aqui.'
            : 'Segue pessoas para encheres o teu feed — ou vê o que a comunidade anda a fazer.'}
        </Text>
      </View>

      <SuggestedPeople />

      {discover.length > 0 && (
        <View>
          <Text style={emptyStyles.sectionTitle}>Da comunidade</Text>
          {(discover as Activity[]).map((item) => (
            <SocialPostCard key={item.id} activity={item} />
          ))}
        </View>
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 32 },
  sectionTitle: {
    ...typography.headline,
    fontSize: 15,
    color: colors.foreground,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  suggestSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  peopleRow: { gap: 10, paddingHorizontal: 16, paddingBottom: 18 },
  personCard: {
    width: 124,
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  personName: { ...typography.bodyBold, fontSize: 13, color: colors.foreground, textAlign: 'center' },
  personCity: { ...typography.body, fontSize: 11, color: colors.mutedForeground, marginTop: -4 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  title: { ...typography.bodyBold, fontSize: 18, color: colors.foreground, textAlign: 'center', marginBottom: 8 },
  sub: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
});

// ─── new-activity banner ─────────────────────────────────────────────────────

function NewActivitiesBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={bannerStyles.banner} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="arrow-up-circle" size={16} color={colors.primaryForeground} />
      <Text style={bannerStyles.text}>Novas atividades disponíveis</Text>
    </TouchableOpacity>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginVertical: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  text: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },
});

// ─── main component ──────────────────────────────────────────────────────────

export function FeedTab() {
  const queryClient = useQueryClient();
  const filter = useFeedStore((s) => s.filter);
  const hasNewActivities = useFeedStore((s) => s.hasNewActivities);
  const setHasNewActivities = useFeedStore((s) => s.setHasNewActivities);
  const listRef = useRef<FlatList>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const { data, fetchNextPage, hasNextPage, isLoading, isRefetching, isError, refetch } = useFeed();

  const loadNewActivities = useCallback(() => {
    setHasNewActivities(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    refetch();
  }, [refetch, setHasNewActivities]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }, [queryClient]),
  );

  const categoryTypeMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const cat of ACTIVITY_CATEGORIES) {
      map[cat.key] = new Set(cat.activities.map((a) => a.key));
    }
    return map;
  }, []);

  const allItems = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredItems = useMemo(() => allItems.filter((item: Activity) => {
    if (deletedIds.has(item.id)) return false;
    if (filter.category !== 'all' && !categoryTypeMap[filter.category]?.has(item.type)) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      if (!(
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.profile?.full_name?.toLowerCase().includes(q) ||
        item.profile?.city?.toLowerCase().includes(q) ||
        item.profile?.username?.toLowerCase().includes(q)
      )) return false;
    }
    return true;
  }), [allItems, deletedIds, filter, categoryTypeMap]);

  const handleDeleted = useCallback((id: string) => {
    setDeletedIds((prev) => new Set([...prev, id]));
  }, []);

  const renderItem = useCallback(({ item }: { item: Activity }) => (
    <SocialPostCard activity={item} onDeleted={() => handleDeleted(item.id)} />
  ), [handleDeleted]);

  const renderHeader = useCallback(() => (
    <View>
      <SearchBar />
      <FilterBar />
    </View>
  ), []);

  const renderFooter = useCallback(() =>
    hasNextPage
      ? <View style={styles.footerLoader}><ActivityIndicator size="small" color={colors.primary} /></View>
      : allItems.length > 0
        ? <View style={styles.endOfFeed}><Text style={styles.endOfFeedText}>• Estás a par de tudo •</Text></View>
        : null,
  [hasNextPage, allItems.length]);

  // ── loading state: skeletons ──
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SearchBar />
        <FilterBar />
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  // ── error state ──
  if (isError) {
    return (
      <View style={styles.center}>
        <View style={emptyStyles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
        </View>
        <Text style={[emptyStyles.title, { color: colors.destructive }]}>Erro ao carregar</Text>
        <Text style={emptyStyles.sub}>Verifica a tua ligação e tenta novamente.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={listRef}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<EmptyFeed following={filter.following ?? false} />}
        ListFooterComponent={renderFooter}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshing={isRefetching}
        onRefresh={() => { setHasNewActivities(false); refetch(); }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        windowSize={7}
        initialNumToRender={3}
      />
      {hasNewActivities && (
        <View style={styles.bannerOverlay} pointerEvents="box-none">
          <NewActivitiesBanner onPress={loadNewActivities} />
        </View>
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bannerOverlay: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  endOfFeed: { paddingVertical: 28, alignItems: 'center' },
  endOfFeedText: { ...typography.body, fontSize: 12, color: colors.mutedForeground, letterSpacing: 2 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: { ...typography.bodyBold, fontSize: 14, color: colors.primaryForeground },
});
