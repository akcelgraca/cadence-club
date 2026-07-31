import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { searchUsers, searchRoutes, type NearbyRouteResult } from '../services/search';
import { Avatar } from '../components/common/Avatar';
import { formatDistance } from '../utils/formatDistance';
import { ActivityIcon } from '../components/common/ActivityIcon';
import { colors, typography, withAlpha } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import type { Profile } from '../lib/types';

type SearchTab = 'users' | 'routes';
type SearchResult = Profile | NearbyRouteResult;

export default function SearchScreen() {
  const { t } = useTranslation();
  const currentProfileId = useAuthStore((s) => s.profile?.id);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [routes, setRoutes] = useState<NearbyRouteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          const results = await searchUsers(query);
          setUsers(results);
        } else {
          const results = await searchRoutes(query);
          setRoutes(results);
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

  const renderUserItem = ({ item }: { item: Profile }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handleUserPress(item)}>
      <Avatar uri={item.avatar_url} name={item.full_name} size={44} />
      <View style={styles.resultContent}>
        <Text style={styles.resultName}>{item.full_name}</Text>
        <Text style={styles.resultSub}>@{item.username}</Text>
        {item.bio && <Text style={styles.resultBio} numberOfLines={1}>{item.bio}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderRouteItem = ({ item }: { item: NearbyRouteResult }) => {
    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => handleRoutePress(item)}>
        <View style={styles.routeIconContainer}>
          <ActivityIcon activityKey={item.activity_type ?? ''} size={20} tintColor={colors.primary} />
        </View>
        <View style={styles.resultContent}>
          <Text style={styles.resultName}>{item.name}</Text>
          <View style={styles.routeMeta}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.resultSub}>
              {item.city ? `${item.city} · ` : ''}{formatDistance(item.distance ?? 0, unitSystem)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>{t('search_title')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('search_initial_subtext')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
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
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('feed_search_placeholder')}
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'users' ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            {t('search_users')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
          onPress={() => setActiveTab('routes')}
        >
          <Ionicons
            name="map"
            size={16}
            color={activeTab === 'routes' ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
            {t('search_routes')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    borderColor: colors.border,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    ...typography.body,
  },
  cancelText: {
    ...typography.body,
    fontSize: 14,
    color: colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  tabText: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
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
    backgroundColor: colors.card,
    borderRadius: 12,
    gap: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.foreground,
  },
  resultSub: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  resultBio: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  routeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(colors.primary, 0.1),
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
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
});
