import { View, Text, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { useRouteStore } from '../../store/routeStore';
import { useAuth } from '../../hooks/useAuth';
import { fetchNearbyRoutes } from '../../services/routes';
import { searchRoutesForUser } from '../../services/search';
import { ACTIVITY_CATEGORIES, getActivityByKey } from '../../lib/constants';
import { ActivityIcon } from '../common/ActivityIcon';
import { setPickerConfig } from '../../app/profile/settings/picker';
import { type Colors } from '../../lib/theme';
import type { RunType } from '../../lib/types';
import type { RoutePickerItem } from './shared';
import { makeStyles } from './recordStyles';

export function IdleView({ isDistanceBased = true }: { isDistanceBased?: boolean }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const selectType = useActivityStore((s) => s.selectType);
  const selectRoute = useActivityStore((s) => s.selectRoute);
  const clearRoute = useActivityStore((s) => s.clearRoute);
  const startCountdown = useActivityStore((s) => s.startCountdown);
  const type = useActivityStore((s) => s.type);
  const selectedRouteName = useActivityStore((s) => s.selectedRouteName);
  const { userId, profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Keep clock updated for non-distance activities
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-select default activity based on user's main_sport
  useEffect(() => {
    // Wait until profile exists in the store and type isn't already set
    if (type || !profile) return;
    // Use profile.main_sport or default to 'run'
    const mainSport: string = profile.main_sport ?? 'run';
    const def = getActivityByKey(mainSport === 'multi' ? 'run' : mainSport);
    if (def) {
      const runType = def.key === 'trail_run' ? 'trail' : def.key === 'run' ? 'road' : undefined;
      selectType(def.key, runType as RunType | undefined);
    }
  }, [profile, type, selectType]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isSearching = debouncedSearch.length > 0;

  // Nearby routes (when not searching)
  const { data: nearbyRoutes, isLoading: nearbyLoading } = useQuery({
    queryKey: ['nearbyRoutes', type],
    queryFn: async () => {
      return fetchNearbyRoutes(38.7223, -9.1393, {
        activity_type: type ?? undefined,
        radius: 10000,
      }, userId ?? undefined);
    },
    enabled: showRoutePicker && !isSearching,
  });

  // Search routes (when searching)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['searchRoutes', debouncedSearch],
    queryFn: async () => {
      if (!userId || !debouncedSearch) return [] as RoutePickerItem[];
      return searchRoutesForUser(debouncedSearch, userId) as Promise<RoutePickerItem[]>;
    },
    enabled: showRoutePicker && isSearching && !!userId,
  });

  const routes = isSearching ? (searchResults ?? []) : (nearbyRoutes ?? []);
  const routesLoading = isSearching ? searchLoading : nearbyLoading;

  const handleSelectRoute = useCallback((route: RoutePickerItem) => {
    selectRoute(route.id, route.name, route.path);
    setShowRoutePicker(false);
  }, [selectRoute]);

  const handleCreateRoute = useCallback(() => {
    setShowRoutePicker(false);
    useRouteStore.getState().startCreating();
    router.push('/(tabs)/routes');
  }, []);

  // Current activity info
  const currentActivity = getActivityByKey(type ?? '');

  const openTypePicker = useCallback(() => {
    const sections = ACTIVITY_CATEGORIES.map((cat) => ({
      title: t(cat.i18n_key as any),
      options: cat.activities.map((a) => ({
        key: a.key,
        label: t(a.i18n_key as any),
        icon: a.icon,
      })),
    }));
    setPickerConfig({
      title: t('activity_select_type'),
      sections,
      selectedKey: type ?? '',
      onSelect: (key) => {
        const def = getActivityByKey(key);
        if (def) {
          const runType = def.key === 'trail_run' ? 'trail' : def.key === 'run' ? 'road' : undefined;
          selectType(def.key, runType as RunType | undefined);
        }
      },
    });
    router.push('/profile/settings/picker');
  }, [type, selectType, t]);

  const clockDisplay = !isDistanceBased ? (
    <View style={styles.idleClockCenter}>
      <Text style={styles.idleClockTime}>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text style={styles.idleClockLabel}>{t('time_of_day')}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.idleControls}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)')}>
        <Ionicons name="close" size={24} color={c.mutedForeground} />
      </TouchableOpacity>

      {/* Clock display for non-distance activities — absolutely centered */}
      {clockDisplay}

      {/* Activity label + buttons — at bottom for non-distance */}
      <View style={!isDistanceBased ? styles.nonDistanceBottomGroup : undefined}>
        {/* Selected activity type label — shown above the start button */}
        <Text style={styles.idleActivityLabel}>
          {type ? (currentActivity ? t(currentActivity.i18n_key as any) : t('activity_select_type')) : t('activity_select_type')}
        </Text>

        {/* Button row: activity type | play | [route | sensor] */}
        <View style={[styles.idleButtonRow, !isDistanceBased && styles.idleButtonRowNoFlex]}>
        {/* Activity type button */}
        <View style={styles.idleButtonGroup}>
          <TouchableOpacity
            style={[styles.idleSideButton, type && styles.idleSideButtonActive]}
            onPress={openTypePicker}
          >
            <ActivityIcon
              activityKey={type ?? ''}
              size={26}
              tintColor={type ? c.primary : c.mutedForeground}
            />
          </TouchableOpacity>
          <Text style={styles.idleButtonLabel}>{t('activity_select_type')}</Text>
        </View>

        {/* Play button */}
        <View style={styles.idleButtonGroup}>
          <TouchableOpacity
            style={[styles.playButton, !type && styles.playButtonDisabled]}
            onPress={startCountdown}
            disabled={!type}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={34} color={c.primaryForeground} />
          </TouchableOpacity>
          <Text style={styles.idleButtonLabel}>{t('activity_start')}</Text>
        </View>

        {/* Route button — only for distance-based activities */}
        {isDistanceBased && (
          <View style={styles.idleButtonGroup}>
            <TouchableOpacity
              style={[styles.idleSideButton, selectedRouteName && styles.idleSideButtonActive]}
              onPress={() => setShowRoutePicker(true)}
            >
              <Ionicons
                name="map"
                size={26}
                color={selectedRouteName ? c.primary : c.mutedForeground}
              />
            </TouchableOpacity>
            <Text style={styles.idleButtonLabel}>{t('activity_select_route')}</Text>
          </View>
        )}

        {/* Sensor button — only for non-distance activities */}
        {!isDistanceBased && (
          <View style={styles.idleButtonGroup}>
            <TouchableOpacity
              style={[styles.idleSideButton]}
              onPress={() => Alert.alert(t('sensor_connect_title'), t('sensor_connect_message'))}
            >
              <Ionicons
                name="bluetooth"
                size={26}
                color={c.mutedForeground}
              />
            </TouchableOpacity>
            <Text style={styles.idleButtonLabel}>{t('sensor_connect')}</Text>
          </View>
        )}
      </View>
      </View>

      {/* Selected route indicator */}
      {isDistanceBased && selectedRouteName && (
        <View style={styles.routeSelectedBar}>
          <Ionicons name="map" size={14} color={c.primary} />
          <Text style={styles.routeSelectedText} numberOfLines={1}>{selectedRouteName}</Text>
          <TouchableOpacity onPress={clearRoute}>
            <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Route picker modal — only for distance-based activities */}
      {isDistanceBased && (
      <Modal
        visible={showRoutePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRoutePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('activity_choose_route')}</Text>
            <TouchableOpacity onPress={() => setShowRoutePicker(false)}>
              <Ionicons name="close" size={24} color={c.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={16} color={c.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('feed_search_placeholder')}
                placeholderTextColor={c.mutedForeground}
                value={searchInput}
                onChangeText={setSearchInput}
                returnKeyType="search"
              />
              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => setSearchInput('')}>
                  <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* "Criar nova rota" button */}
          <TouchableOpacity style={styles.createRouteButton} onPress={handleCreateRoute}>
            <Ionicons name="add-circle-outline" size={18} color={c.primary} />
            <Text style={styles.createRouteText}>{t('route_create_new')}</Text>
          </TouchableOpacity>

          {selectedRouteName && (
            <TouchableOpacity
              style={styles.clearRouteButton}
              onPress={() => { clearRoute(); setShowRoutePicker(false); }}
            >
              <Text style={styles.clearRouteText}>{t('route_clear_selection')}</Text>
            </TouchableOpacity>
          )}

          {routesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={styles.loadingText}>{t('route_searching')}</Text>
            </View>
          ) : routes && routes.length > 0 ? (
            <FlatList
              data={routes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.routeList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.routeCard,
                    selectedRouteName === item.name && styles.routeCardSelected,
                  ]}
                  onPress={() => handleSelectRoute(item)}
                >
                  <View style={styles.routeCardHeader}>
                    <Ionicons name="map" size={20} color={c.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeCardName}>{item.name}</Text>
                      {(item as any).creator_name && (
                        <Text style={styles.routeCardCreator}>
                          {t('route_by')} {(item as any).creator_name}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.routeCardStats}>
                    <Text style={styles.routeCardStat}>
                      {item.distance >= 1000
                        ? `${(item.distance / 1000).toFixed(1)} km`
                        : `${Math.round(item.distance)} m`}
                    </Text>
                    {item.city && (
                      <Text style={styles.routeCardStat}>{item.city}</Text>
                    )}
                    <Text style={styles.routeCardStat}>
                      {item.difficulty === 'easy' ? t('route_difficulty_easy') :
                       item.difficulty === 'moderate' ? t('route_difficulty_moderate') :
                       item.difficulty === 'hard' ? t('route_difficulty_hard') : t('route_difficulty_expert')}
                    </Text>
                    <Text style={styles.routeCardStat}>
                      {item.activity_type === 'run' ? t('activity_run') :
                       item.activity_type === 'cycle' ? t('activity_cycle') : t('activity_walk')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.emptyText}>{t('route_none_found')}</Text>
              <Text style={styles.emptySubtext}>{t('route_none_subtext')}</Text>
              <TouchableOpacity onPress={handleCreateRoute}>
                <Text style={styles.createRouteLink}>{t('route_create_one')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
      )}
    </View>
  );
}

