import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeed } from '../../hooks/useFeed';
import { useFeedStore } from '../../store/feedStore';
import { useAuthStore } from '../../store/authStore';
import { useUnreadCount } from '../../hooks/useNotifications';
import { ActivityCard } from '../../components/activity/ActivityCard';
import { colors, typography, withAlpha } from '../../lib/theme';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { Activity, ActivityCategory } from '../../lib/types';

const FILTER_OPTIONS: { key: ActivityCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'feed_filter_all', icon: 'apps' },
  ...ACTIVITY_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: cat.i18n_key,
    icon: cat.icon,
  })),
];

export default function FeedScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const filter = useFeedStore((s) => s.filter);
  const setFilter = useFeedStore((s) => s.setFilter);
  const { data: unreadCount = 0 } = useUnreadCount();
  const [searchInput, setSearchInput] = useState(filter.searchQuery);

  // Debounce search (200ms) and sync to store
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter({ searchQuery: searchInput.trim() });
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput, setFilter]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useFeed();

  // Refetch when tab gains focus
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }, [queryClient]),
  );

  // Build a set of activity types per category for client-side filtering
  const categoryTypeMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const cat of ACTIVITY_CATEGORIES) {
      map[cat.key] = new Set(cat.activities.map((a) => a.key));
    }
    return map;
  }, []);

  // Flatten pages and apply client-side filters
  const allItems = data?.pages.flat() ?? [];

  const filteredItems = allItems.filter((item: Activity) => {
    if (filter.category !== 'all' && !categoryTypeMap[filter.category]?.has(item.type)) return false;
    if (filter.following && item.user_id === profile?.id) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchName = item.profile?.full_name?.toLowerCase().includes(q);
      const matchCity = item.profile?.city?.toLowerCase().includes(q);
      const matchUsername = item.profile?.username?.toLowerCase().includes(q);
      if (!(matchTitle || matchDesc || matchName || matchCity || matchUsername)) return false;
    }
    return true;
  });

  const renderItem = ({ item }: { item: Activity }) => (
    <ActivityCard activity={item} />
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Filter chips */}
      <View style={styles.headerTop}>
        <Text style={styles.title}>{t('tab_feed')}</Text>
        <View style={styles.headerActions}>
          {profile && (
            <TouchableOpacity
              style={[styles.followingChip, filter.following && styles.followingChipActive]}
              onPress={() => setFilter({ following: !filter.following })}
            >
              <Ionicons
                name={filter.following ? 'people' : 'people-outline'}
                size={14}
                color={filter.following ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.followingChipText,
                  filter.following && styles.followingChipTextActive,
                ]}
              >
                {t('feed_filter_following')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/search')}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.foreground}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={14} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('feed_search_placeholder')}
          placeholderTextColor={colors.mutedForeground}
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => setSearchInput('')}>
            <Ionicons name="close-circle" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: opt }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter.category === opt.key && styles.filterChipActive]}
            onPress={() => setFilter({ category: opt.key })}
          >
            <Ionicons
              name={opt.icon as any}
              size={12}
              color={filter.category === opt.key ? colors.primaryForeground : colors.foreground}
            />
            <Text
              style={[
                styles.filterChipText,
                filter.category === opt.key && styles.filterChipTextActive,
              ]}
            >
              {t(opt.label as any)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>{t('feed_empty_title')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('feed_empty_subtitle')}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.emptyTitle}>{t('feed_error')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.foreground, 0.08),
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.foreground, 0.08),
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.mono,
    fontSize: 9,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  title: {
    ...typography.headline,
    fontSize: 28,
    color: colors.foreground,
  },
  followingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.foreground, 0.08),
  },
  followingChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followingChipText: {
    ...typography.body,
    fontSize: 12,
    color: colors.foreground,
  },
  followingChipTextActive: {
    color: colors.primaryForeground,
    fontFamily: 'Barlow_600SemiBold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.foreground,
    ...typography.body,
  },
  filterRow: {
    gap: 6,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.body,
    fontSize: 12,
    color: colors.foreground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
    fontFamily: 'Barlow_600SemiBold',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.foreground,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
});
