import { useState, useEffect, useMemo } from 'react';
import { useColors } from '../hooks/useColors';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { searchUsers, searchRoutes, searchRoutesByCity, type NearbyRouteResult } from '../services/search';
import { getSavedRouteIds, saveRoute, unsaveRoute } from '../services/routes';
import { supabase } from '../services/supabase';
import { Avatar } from '../components/common/Avatar';
import { FollowButton } from '../components/social/FollowButton';
import { formatDistance } from '../utils/formatDistance';
import { ActivityIcon } from '../components/common/ActivityIcon';
import { typography, withAlpha, type Colors } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import type { Profile } from '../lib/types';
import { goBackOr } from '../lib/navigation';

type SearchTab = 'users' | 'routes' | 'cities';
type SearchResult = Profile | NearbyRouteResult;

const TABS: { key: SearchTab; icon: keyof typeof Ionicons.glyphMap; i18n: string }[] = [
  { key: 'users', icon: 'people', i18n: 'search_users' },
  { key: 'routes', icon: 'map', i18n: 'search_routes' },
  { key: 'cities', icon: 'location', i18n: 'search_cities' },
];

export default function SearchScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const currentProfileId = useAuthStore((s) => s.profile?.id);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [routes, setRoutes] = useState<NearbyRouteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quem eu sigo + rotas guardadas — para os botões de ação nos resultados
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentProfileId) return;
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentProfileId)
      .then(({ data }) => setFollowingIds(new Set((data ?? []).map((f: any) => f.following_id))));
    getSavedRouteIds().then(setSavedIds).catch(() => {});
  }, [currentProfileId]);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setRoutes([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'users') {
          setUsers(await searchUsers(query));
        } else if (activeTab === 'routes') {
          setRoutes(await searchRoutes(query));
        } else {
          setRoutes(await searchRoutesByCity(query));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const handleUserPress = (user: Profile) => {
    if (currentProfileId && user.id === currentProfileId) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/profile/${user.id}`);
    }
  };

  const handleRoutePress = (route: NearbyRouteResult) => {
    router.push({ pathname: '/record', params: { routeId: route.id } });
  };

  const toggleSaveRoute = async (route: NearbyRouteResult) => {
    const isSaved = savedIds.has(route.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(route.id); else next.add(route.id);
      return next;
    });
    try {
      if (isSaved) await unsaveRoute(route.id);
      else await saveRoute(route.id);
    } catch {
      // reverter em caso de erro
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(route.id); else next.delete(route.id);
        return next;
      });
    }
  };

  const renderUserItem = ({ item }: { item: Profile }) => {
    const isSelf = item.id === currentProfileId;
    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => handleUserPress(item)}>
        <Avatar uri={item.avatar_url} name={item.full_name} size={44} />
        <View style={styles.resultContent}>
          <Text style={styles.resultName}>{item.full_name}</Text>
          <Text style={styles.resultSub}>
            @{item.username}{item.city ? ` · ${item.city}` : ''}
          </Text>
        </View>
        {!isSelf && (
          <FollowButton userId={item.id} initialFollowing={followingIds.has(item.id)} />
        )}
      </TouchableOpacity>
    );
  };

  const renderRouteItem = ({ item }: { item: NearbyRouteResult }) => {
    const isSaved = savedIds.has(item.id);
    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => handleRoutePress(item)}>
        <View style={styles.routeIconContainer}>
          <ActivityIcon activityKey={item.activity_type ?? ''} size={20} tintColor={c.primary} />
        </View>
        <View style={styles.resultContent}>
          <Text style={styles.resultName}>{item.name}</Text>
          <View style={styles.routeMeta}>
            <Ionicons name="location-outline" size={12} color={c.mutedForeground} />
            <Text style={styles.resultSub}>
              {item.city ? `${item.city} · ` : ''}{formatDistance(item.distance ?? 0, unitSystem)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => toggleSaveRoute(item)} hitSlop={10} style={styles.saveBtn}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isSaved ? c.primary : c.mutedForeground}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={c.mutedForeground} />
          <Text style={styles.emptyTitle}>{t('search_title')}</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'cities' ? t('search_cities_subtext') : t('search_initial_subtext')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={48} color={c.mutedForeground} />
        <Text style={styles.emptyTitle}>{t('search_no_results')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('search_no_results_subtext')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={18} color={c.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('feed_search_placeholder')}
            placeholderTextColor={c.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={c.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)')}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? c.primary : c.mutedForeground}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t(tab.i18n as any)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList<SearchResult>
          data={activeTab === 'users' ? users : routes}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'users' ? renderUserItem as any : renderRouteItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: c.foreground,
    ...typography.body,
  },
  cancelText: {
    ...typography.body,
    fontSize: 14,
    color: c.primary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.card,
  },
  tabActive: {
    borderColor: c.primary,
    backgroundColor: withAlpha(c.primary, 0.08),
  },
  tabText: {
    ...typography.body,
    fontSize: 13,
    color: c.mutedForeground,
  },
  tabTextActive: {
    color: c.primary,
    fontFamily: 'Barlow_600SemiBold',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: c.card,
    borderRadius: 12,
    gap: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: c.foreground,
  },
  resultSub: {
    ...typography.body,
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 2,
  },
  routeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(c.primary, 0.1),
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  saveBtn: { padding: 4 },
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
    color: c.foreground,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
