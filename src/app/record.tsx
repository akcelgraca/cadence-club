import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, Modal, FlatList, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useActivityStore } from '../store/activityStore';
import { useRouteStore } from '../store/routeStore';
import { useSettingsStore } from '../store/settingsStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { saveActivity } from '../services/activities';
import { fetchNearbyRoutes, fetchRouteById } from '../services/routes';
import { searchRoutesForUser } from '../services/search';
import { getEquipment } from '../services/equipment';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { ACTIVITY_CATEGORIES, getActivityByKey } from '../lib/constants';
import { formatDuration } from '../utils/dateHelpers';
import { formatDistance } from '../utils/formatDistance';
import { formatPace, formatSpeed, formatElevation } from '../utils/formatPace';
import { calculateActivityCalories } from '../utils/calculateCalories';
import { LiveRecordingMap } from '../components/activity/LiveRecordingMap';
import { PaceProfile } from '../components/activity/PaceProfile';
import { ElevationProfile } from '../components/activity/ElevationProfile';
import { MAPBOX_STYLES, type MapboxStyleKey } from '../components/map/MapViewWrapper';
import { colors, withAlpha, typography } from '../lib/theme';
import { setPickerConfig } from './profile/settings/picker';
import type { RunType, NearbyRoute, SurfaceType } from '../lib/types';

// ============================================================
// Mood images
// ============================================================
const MOOD_IMAGES: Record<number, any> = {
  1: require('../../assets/images/moods/mood_1.png'),
  2: require('../../assets/images/moods/mood_2.png'),
  3: require('../../assets/images/moods/mood_3.png'),
  4: require('../../assets/images/moods/mood_4.png'),
  5: require('../../assets/images/moods/mood_5.png'),
};

// Unified type for route picker items (from nearby or search)
type RoutePickerItem = NearbyRoute;

// ============================================================
// Idle: select activity type + start recording
// ============================================================
function IdleView({ isDistanceBased = true }: { isDistanceBased?: boolean }) {
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
  const activityIcon = (currentActivity?.icon as any) ?? 'footsteps';

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
        <Ionicons name="close" size={24} color={colors.mutedForeground} />
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
            <Ionicons
              name={activityIcon}
              size={26}
              color={type ? colors.primary : colors.mutedForeground}
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
            <Ionicons name="play" size={34} color={colors.primaryForeground} />
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
                color={selectedRouteName ? colors.primary : colors.mutedForeground}
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
                color={colors.mutedForeground}
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
          <Ionicons name="map" size={14} color={colors.primary} />
          <Text style={styles.routeSelectedText} numberOfLines={1}>{selectedRouteName}</Text>
          <TouchableOpacity onPress={clearRoute}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
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
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
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
                  <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* "Criar nova rota" button */}
          <TouchableOpacity style={styles.createRouteButton} onPress={handleCreateRoute}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
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
              <ActivityIndicator size="large" color={colors.primary} />
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
                    <Ionicons name="map" size={20} color={colors.primary} />
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

// ============================================================
// Countdown: 3-2-1 overlay with dot indicators
// ============================================================
function CountdownView() {
  const { t } = useTranslation();
  const countdown = useActivityStore((s) => s.countdown);
  const tickCountdown = useActivityStore((s) => s.tickCountdown);

  useEffect(() => {
    const interval = setInterval(() => {
      tickCountdown();
    }, 1000);
    return () => clearInterval(interval);
  }, [tickCountdown]);

  return (
    <View style={[styles.container, styles.countdownContainer]}>
      <Text style={styles.countdownNumber}>{countdown}</Text>
      <Text style={styles.countdownLabel}>{t('activity_countdown')}</Text>
      {/* Dot indicators: filled dots = elapsed seconds (3 - countdown) */}
      <View style={styles.countdownDots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.countdownDot,
              i < 3 - countdown && styles.countdownDotFilled,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Recording: real GPS tracking with live metrics
// ============================================================
function RecordingView({ startTracking }: { startTracking: () => Promise<void> }) {
  const { t } = useTranslation();
  const pause = useActivityStore((s) => s.pause);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const currentPace = useActivityStore((s) => s.currentPace);
  const avgPace = useActivityStore((s) => s.avgPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const gpsSignal = useActivityStore((s) => s.gpsSignal);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  // Start GPS tracking on mount
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  // Keep elapsed time display updating every second (GPS callback only fires on new positions)
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useActivityStore.getState();
      const startTime = store.startTime;
      if (startTime) {
        const elapsed = (Date.now() - new Date(startTime).getTime() - store.totalPausedDuration) / 1000;
        useActivityStore.setState({ elapsedTime: elapsed });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, styles.recordingContainer]}>
      {/* GPS status indicator */}
      <View style={styles.gpsRow}>
        <View style={[
          styles.gpsDot,
          gpsSignal === 'good' ? styles.gpsGood :
          gpsSignal === 'weak' ? styles.gpsWeak :
          styles.gpsNone
        ]} />
        <Text style={styles.gpsText}>
          {gpsSignal === 'good' ? t('activity_gps_ok') :
           gpsSignal === 'weak' ? t('activity_gps_weak_short') :
           t('activity_gps_none')}
        </Text>
      </View>

      {/* Primary metric: elapsed time */}
      <View style={styles.metricTimeRow}>
        <Text style={styles.metricTime}>{formatDuration(elapsedTime)}</Text>
      </View>

      {/* Distance + current pace row */}
      <View style={styles.metricMainRow}>
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatDistance(distance, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatPace(currentPace, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('pace')}</Text>
        </View>
      </View>

      {/* Secondary metrics grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatPace(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_current_pace_label')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatPace(avgPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_avg_pace_label')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatSpeed(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_speed')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatElevation(elevationGain, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_elevation')}</Text>
        </View>
      </View>

      {/* Pause button */}
      <TouchableOpacity style={styles.pauseButton} onPress={pause} activeOpacity={0.7}>
        <Ionicons name="pause" size={18} color={colors.foreground} />
        <Text style={styles.pauseButtonText}>{t('activity_pause_button')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Non-distance recording: clock + timer + pause (no GPS)
// ============================================================
function NonDistanceRecordingView() {
  const { t } = useTranslation();
  const pause = useActivityStore((s) => s.pause);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const [now, setNow] = useState(new Date());

  // Keep clock and elapsed time updated
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      const store = useActivityStore.getState();
      const startTime = store.startTime;
      if (startTime) {
        const elapsed = (Date.now() - new Date(startTime).getTime() - store.totalPausedDuration) / 1000;
        useActivityStore.setState({ elapsedTime: elapsed });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.nonDistanceContainer}>
      {/* Clock + label — absolutely centered */}
      <View style={styles.nonDistanceClockCenter}>
        <Text style={styles.nonDistanceClock}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.nonDistanceClockLabel}>{t('time_of_day')}</Text>
      </View>

      {/* Elapsed timer — absolutely positioned, never moves */}
      <Text style={styles.nonDistanceTimer}>
        {(() => {
          const totalSec = Math.floor(elapsedTime);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        })()}
      </Text>

      {/* Pause button — at the bottom */}
      <View style={styles.nonDistanceBottom}>
        <TouchableOpacity style={styles.pauseButton} onPress={pause} activeOpacity={0.7}>
          <Ionicons name="pause" size={18} color={colors.foreground} />
          <Text style={styles.pauseButtonText}>{t('activity_pause_button')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// Paused: resume / discard / finish options
// ============================================================
function PausedView() {
  const { t } = useTranslation();
  const resume = useActivityStore((s) => s.resume);
  const finish = useActivityStore((s) => s.finish);
  const reset = useActivityStore((s) => s.reset);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const currentPace = useActivityStore((s) => s.currentPace);
  const avgPace = useActivityStore((s) => s.avgPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  const handleDiscard = () => {
    Alert.alert(
      t('activity_discard_confirm'),
      t('activity_discard_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('activity_discard'), style: 'destructive', onPress: reset },
      ]
    );
  };

  return (
    <View style={[styles.container, styles.pausedContainer]}>
      {/* Paused indicator */}
      <View style={styles.pausedIndicator}>
        <Ionicons name="pause-circle" size={18} color={colors.warning} />
        <Text style={styles.pausedTitle}>{t('activity_paused')}</Text>
      </View>

      {/* Primary metric: elapsed time */}
      <View style={styles.metricTimeRow}>
        <Text style={styles.metricTime}>{formatDuration(elapsedTime)}</Text>
      </View>

      {/* Distance + current pace row */}
      <View style={styles.metricMainRow}>
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatDistance(distance, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatPace(currentPace, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('pace')}</Text>
        </View>
      </View>

      {/* Secondary metrics grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatPace(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_current_pace_label')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatPace(avgPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_avg_pace_label')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatSpeed(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_speed')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatElevation(elevationGain, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_elevation')}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.pausedButtons}>
        <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          <Text style={styles.discardButtonText}>{t('activity_discard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resumeButton} onPress={resume} activeOpacity={0.7}>
          <Ionicons name="play" size={16} color={colors.gpsGood} />
          <Text style={styles.resumeButtonText}>{t('activity_resume')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishButton} onPress={finish} activeOpacity={0.85}>
          <Ionicons name="stop" size={16} color={colors.primaryForeground} />
          <Text style={styles.finishButtonText}>{t('activity_finish')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// Non-distance paused: clock + timer + resume/discard/finish
// ============================================================
function NonDistancePausedView() {
  const { t } = useTranslation();
  const resume = useActivityStore((s) => s.resume);
  const finish = useActivityStore((s) => s.finish);
  const reset = useActivityStore((s) => s.reset);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const [now, setNow] = useState(new Date());

  // Keep clock updated
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDiscard = () => {
    Alert.alert(
      t('activity_discard_confirm'),
      t('activity_discard_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('activity_discard'), style: 'destructive', onPress: reset },
      ]
    );
  };

  return (
    <View style={styles.nonDistanceContainer}>
      {/* Paused indicator — absolute top */}
      <View style={styles.pausedIndicatorTop}>
        <Ionicons name="pause-circle" size={18} color={colors.warning} />
        <Text style={styles.pausedTitle}>{t('activity_paused')}</Text>
      </View>

      {/* Clock + label — absolutely centered */}
      <View style={styles.nonDistanceClockCenter}>
        <Text style={styles.nonDistanceClock}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.nonDistanceClockLabel}>{t('time_of_day')}</Text>
      </View>

      {/* Elapsed timer — absolutely positioned, never moves */}
      <Text style={styles.nonDistanceTimer}>
        {(() => {
          const totalSec = Math.floor(elapsedTime);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        })()}
      </Text>

      {/* Action buttons — at the bottom */}
      <View style={styles.nonDistanceBottom}>
        <View style={styles.pausedButtons}>
          <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text style={styles.discardButtonText}>{t('activity_discard')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resumeButton} onPress={resume} activeOpacity={0.7}>
            <Ionicons name="play" size={16} color={colors.gpsGood} />
            <Text style={styles.resumeButtonText}>{t('activity_resume')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishButton} onPress={finish} activeOpacity={0.85}>
            <Ionicons name="stop" size={16} color={colors.primaryForeground} />
            <Text style={styles.finishButtonText}>{t('activity_finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// Surface type options (used in FinishedView)
// ============================================================
const SURFACE_TYPES: { key: SurfaceType; label: string; icon: any }[] = [
  { key: 'road', label: i18n.t('route_surface_road'), icon: 'car-sport-outline' },
  { key: 'trail', label: i18n.t('route_surface_trail'), icon: 'leaf-outline' },
  { key: 'mixed', label: i18n.t('route_surface_mixed'), icon: 'shuffle-outline' },
  { key: 'track', label: i18n.t('route_surface_track'), icon: 'ellipse-outline' },
];

// ============================================================
// Finished: summary + metadata editing + charts + mood + save
// ============================================================
function FinishedView({ isDistanceBased = true }: { isDistanceBased?: boolean }) {
  const { t } = useTranslation();
  const type = useActivityStore((s) => s.type);
  const runType = useActivityStore((s) => s.runType);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const avgPace = useActivityStore((s) => s.avgPace);
  const currentPace = useActivityStore((s) => s.currentPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const points = useActivityStore((s) => s.points);
  const mood = useActivityStore((s) => s.mood);
  const title = useActivityStore((s) => s.title);
  const description = useActivityStore((s) => s.description);
  const isPublic = useActivityStore((s) => s.isPublic);
  const surfaceType = useActivityStore((s) => s.surfaceType);
  const equipmentId = useActivityStore((s) => s.equipmentId);
  const startTime = useActivityStore((s) => s.startTime);
  const setMood = useActivityStore((s) => s.setMood);
  const setTitle = useActivityStore((s) => s.setTitle);
  const setDescription = useActivityStore((s) => s.setDescription);
  const setVisibility = useActivityStore((s) => s.setVisibility);
  const setSurfaceType = useActivityStore((s) => s.setSurfaceType);
  const setEquipmentId = useActivityStore((s) => s.setEquipmentId);
  const reset = useActivityStore((s) => s.reset);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const queryClient = useQueryClient();
  const { userId, profile } = useAuth();

  // Fetch user equipment
  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment', userId],
    queryFn: () => getEquipment(userId!),
    enabled: !!userId,
  });

  // Estimated calories for non-distance activities
  const estimatedCalories = !isDistanceBased
    ? Math.round(
        calculateActivityCalories(
          {
            type: type!,
            duration: elapsedTime,
            distance: 0,
            avg_pace: 0,
          } as any,
          profile?.weight_kg ?? 70,
        ),
      )
    : 0;

  const handleSave = async () => {
    try {
      const endTime = startTime
        ? new Date(new Date(startTime).getTime() + elapsedTime * 1000).toISOString()
        : new Date().toISOString();

      await saveActivity({
        type: type!,
        runType: runType ?? undefined,
        distance,
        duration: Math.round(elapsedTime),
        elevation_gain: Math.round(elevationGain),
        avg_pace: avgPace || currentPace || 0,
        start_time: startTime || new Date().toISOString(),
        end_time: endTime,
        route_summary: points.map((p) => [p.lat, p.lng]),
        points,
        mood,
        title: title || null,
        description: description || null,
        is_public: isPublic,
        surface_type: surfaceType,
        equipment_id: equipmentId,
      });

      // Invalidate all stats-related queries so home screen refreshes
      queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySummary'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyDailyBreakdown'] });
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyStats'] });
      queryClient.invalidateQueries({ queryKey: ['myActivities'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      Alert.alert(t('activity_saved_title'), t('activity_saved_message'), [
        { text: 'OK', onPress: () => { reset(); router.replace('/(tabs)'); } },
      ]);
    } catch (err: any) {
      console.error('[SaveActivity] Failed:', err?.message ?? err, err);
      Alert.alert(t('activity_save_error_title'), `${t('activity_save_error')}: ${err?.message ?? 'Erro desconhecido'}`);
    }
  };

  const activityLabel = type ? t(getActivityByKey(type)?.i18n_key as any ?? 'activity_detail_screen') : t('activity_detail_screen');

  // Build elevation points from GPS data
  const elevationPoints = points
    .filter((p) => p.elevation != null)
    .map((p) => ({ lat: p.lat, lng: p.lng, elevation: p.elevation! }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView
      contentContainerStyle={styles.finishedContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.finishedHeader}>
        <Text style={styles.finishedTitle}>{t('activity_summary_title')}</Text>
        <Text style={styles.finishedType}>{activityLabel}</Text>
      </View>

      {/* Stats grid */}
      {isDistanceBased ? (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDistance(distance, unitSystem)}</Text>
            <Text style={styles.summaryLabel}>{t('distance')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(elapsedTime)}</Text>
            <Text style={styles.summaryLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatPace(avgPace || currentPace, unitSystem)}</Text>
            <Text style={styles.summaryLabel}>{t('avg_pace')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(elevationGain)}m</Text>
            <Text style={styles.summaryLabel}>{t('elevation')}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(elapsedTime)}</Text>
            <Text style={styles.summaryLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{estimatedCalories}</Text>
            <Text style={styles.summaryLabel}>{t('activity_calories')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.summaryValueMuted]}>--</Text>
            <Text style={styles.summaryLabel}>{t('activity_heart_rate')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.summaryComingSoon]}>{t('coming_soon')}</Text>
            <Text style={styles.summaryLabel}>{t('activity_sensor_data')}</Text>
          </View>
        </View>
      )}

      {/* Title input */}
      <Text style={styles.fieldLabel}>{t('activity_title_label')}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder={t('activity_title_placeholder')}
        placeholderTextColor={colors.mutedForeground}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />

      {/* Description input */}
      <Text style={styles.fieldLabel}>{t('activity_description_label')}</Text>
      <TextInput
        style={[styles.fieldInput, styles.fieldTextArea]}
        placeholder={t('activity_desc_placeholder')}
        placeholderTextColor={colors.mutedForeground}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      {/* Surface type - only for distance-based activities */}
      {isDistanceBased && (
        <>
          <Text style={styles.fieldLabel}>{t('activity_surface_type')}</Text>
          <View style={styles.chipRow}>
            {SURFACE_TYPES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, surfaceType === s.key && styles.chipActive]}
                onPress={() => setSurfaceType(surfaceType === s.key ? null : s.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={s.icon}
                  size={14}
                  color={surfaceType === s.key ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.chipText, surfaceType === s.key && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Equipment selector */}
      {equipment.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>{t('activity_equipment_label')}</Text>
          <View style={styles.chipRow}>
            {equipment.map((eq) => (
              <TouchableOpacity
                key={eq.id}
                style={[styles.chip, equipmentId === eq.id && styles.chipActive]}
                onPress={() => setEquipmentId(equipmentId === eq.id ? null : eq.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={eq.type === 'shoes' ? 'footsteps-outline' : eq.type === 'bike' ? 'bicycle-outline' : 'hardware-chip-outline'}
                  size={14}
                  color={equipmentId === eq.id ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.chipText, equipmentId === eq.id && styles.chipTextActive]}>
                  {eq.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Visibility toggle */}
      <View style={styles.visibilityRow}>
        <View style={styles.visibilityInfo}>
          <Ionicons
            name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
            size={18}
            color={colors.foreground}
          />
          <Text style={styles.visibilityLabel}>
            {isPublic ? t('activity_visibility_public') : t('activity_visibility_private')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, isPublic && styles.toggleActive]}
          onPress={() => setVisibility(!isPublic)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
        </TouchableOpacity>
      </View>

      {/* Pace chart - only for distance-based */}
      {isDistanceBased && points.length >= 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>{t('pace')}</Text>
          <PaceProfile
            points={points.map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp }))}
            height={160}
          />
        </View>
      )}

      {/* Elevation profile chart - only for distance-based */}
      {isDistanceBased && elevationPoints.length >= 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>{t('elevation')}</Text>
          <ElevationProfile
            points={elevationPoints}
            height={160}
          />
        </View>
      )}

      {/* Mood selector */}
      <Text style={styles.moodTitle}>{t('activity_how_was_it')}</Text>
      <View style={styles.moodRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.moodButton, mood === n && styles.moodButtonSelected]}
            onPress={() => setMood(n)}
            activeOpacity={0.6}
          >
            <Image source={MOOD_IMAGES[n]} style={styles.moodImage} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
        <Text style={styles.saveButtonText}>{t('activity_save_button')}</Text>
      </TouchableOpacity>

      {/* Discard link */}
      <TouchableOpacity
        style={styles.discardLink}
        onPress={() => {
          Alert.alert(
            t('activity_discard_confirm'),
            t('activity_discard_message'),
            [
              { text: t('cancel'), style: 'cancel' },
              { text: t('activity_discard'), style: 'destructive', onPress: () => { reset(); router.replace('/(tabs)'); } },
            ]
          );
        }}
      >
        <Text style={styles.discardLinkText}>{t('activity_discard')}</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Map controls overlay (terrain toggle, style picker, 3D, center on user)
// ============================================================
function MapControls({
  showTerrain,
  onToggleTerrain,
  showStyleMenu,
  onToggleStyleMenu,
  mapStyle,
  onSelectStyle,
  show3D,
  onToggle3D,
  onCenterOnUser,
}: {
  showTerrain: boolean;
  onToggleTerrain: () => void;
  showStyleMenu: boolean;
  onToggleStyleMenu: () => void;
  mapStyle: MapboxStyleKey;
  onSelectStyle: (key: MapboxStyleKey) => void;
  show3D: boolean;
  onToggle3D: () => void;
  onCenterOnUser: () => void;
}) {
  return (
    <>
      {/* Backdrop to close style menu */}
      {showStyleMenu && (
        <TouchableOpacity
          style={styles.mapBackdrop}
          activeOpacity={1}
          onPress={() => onToggleStyleMenu()}
        />
      )}

      {/* Terrain toggle */}
      <TouchableOpacity
        style={styles.terrainToggle}
        onPress={onToggleTerrain}
        activeOpacity={0.7}
      >
        <Ionicons
          name="triangle"
          size={18}
          color={showTerrain ? colors.primary : colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* Style toggle */}
      <TouchableOpacity
        style={styles.styleToggle}
        onPress={() => onToggleStyleMenu()}
        activeOpacity={0.7}
      >
        <Ionicons name="layers-outline" size={18} color={colors.foreground} />
      </TouchableOpacity>

      {/* Style menu */}
      {showStyleMenu && (
        <View style={styles.styleMenu}>
          {(Object.keys(MAPBOX_STYLES) as MapboxStyleKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.styleMenuItem, mapStyle === key && styles.styleMenuItemActive]}
              onPress={() => onSelectStyle(key)}
            >
              <Text style={[styles.styleMenuText, mapStyle === key && styles.styleMenuTextActive]}>
                {key === 'dark' ? 'Escuro' :
                 key === 'light' ? 'Claro' :
                 key === 'streets' ? 'Ruas' :
                 key === 'satellite' ? 'Satélite' :
                 'Ar Livre'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 3D view toggle */}
      <TouchableOpacity
        style={styles.view3DToggle}
        onPress={onToggle3D}
        activeOpacity={0.7}
      >
        <Ionicons
          name="cube-outline"
          size={18}
          color={show3D ? colors.primary : colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* Center on user */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={onCenterOnUser}
        activeOpacity={0.7}
      >
        <Ionicons name="locate-outline" size={18} color={colors.foreground} />
      </TouchableOpacity>
    </>
  );
}

// ============================================================
// Main record screen — renders based on state
// ============================================================
export default function RecordScreen() {
  const state = useActivityStore((s) => s.state);
  const type = useActivityStore((s) => s.type);
  const selectRoute = useActivityStore((s) => s.selectRoute);
  const { startTracking, stopTracking } = useLocationTracker();
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const isDistanceBased = getActivityByKey(type ?? '')?.distance_based ?? true;

  // Map controls state
  const [mapStyle, setMapStyle] = useState<MapboxStyleKey>('outdoors');
  const [showTerrain, setShowTerrain] = useState(true);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [followUser, setFollowUser] = useState(true);

  const handleCenterOnUser = useCallback(() => {
    setFollowUser(false);
    setTimeout(() => setFollowUser(true), 50);
  }, []);

  // Load route from query param on mount
  useEffect(() => {
    if (routeId) {
      fetchRouteById(routeId).then((route) => {
        if (route) {
          selectRoute(route.id, route.name, route.path);
        }
      }).catch(() => {
        // Route not found or error — ignore
      });
    }
  }, [routeId, selectRoute]);

  // Stop GPS tracking when leaving recording state (pause, finish, reset)
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === 'recording' && state !== 'recording') {
      stopTracking();
    }
    prevState.current = state;
  }, [state, stopTracking]);

  switch (state) {
    case 'idle':
      if (!isDistanceBased) {
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <IdleView isDistanceBased={false} />
          </SafeAreaView>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 0.65 }}>
            <LiveRecordingMap
              style={{ flex: 1 }}
              mapStyle={MAPBOX_STYLES[mapStyle]}
              terrain={showTerrain}
              hillshade={showTerrain}
              showContours={showTerrain}
              followUser={followUser}
              followPitch={show3D ? 60 : 0}
            />
            <MapControls
              showTerrain={showTerrain}
              onToggleTerrain={() => setShowTerrain((v) => !v)}
              showStyleMenu={showStyleMenu}
              onToggleStyleMenu={() => setShowStyleMenu((v) => !v)}
              mapStyle={mapStyle}
              onSelectStyle={(key) => { setMapStyle(key); setShowStyleMenu(false); }}
              show3D={show3D}
              onToggle3D={() => setShow3D((v) => !v)}
              onCenterOnUser={handleCenterOnUser}
            />
          </View>
          <View style={{ flex: 0.35 }}>
            <IdleView />
          </View>
        </View>
      );

    case 'countdown':
      return <CountdownView />;

    case 'recording':
      if (!isDistanceBased) {
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <NonDistanceRecordingView />
          </SafeAreaView>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 0.4 }}>
            <LiveRecordingMap
              style={{ flex: 1 }}
              mapStyle={MAPBOX_STYLES[mapStyle]}
              terrain={showTerrain}
              hillshade={showTerrain}
              showContours={showTerrain}
              followUser={followUser}
              followPitch={show3D ? 60 : 0}
            />
            <MapControls
              showTerrain={showTerrain}
              onToggleTerrain={() => setShowTerrain((v) => !v)}
              showStyleMenu={showStyleMenu}
              onToggleStyleMenu={() => setShowStyleMenu((v) => !v)}
              mapStyle={mapStyle}
              onSelectStyle={(key) => { setMapStyle(key); setShowStyleMenu(false); }}
              show3D={show3D}
              onToggle3D={() => setShow3D((v) => !v)}
              onCenterOnUser={handleCenterOnUser}
            />
          </View>
          <View style={{ flex: 0.6 }}>
            <RecordingView startTracking={startTracking} />
          </View>
        </View>
      );

    case 'paused':
      if (!isDistanceBased) {
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <NonDistancePausedView />
          </SafeAreaView>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 0.4 }}>
            <LiveRecordingMap
              style={{ flex: 1 }}
              mapStyle={MAPBOX_STYLES[mapStyle]}
              terrain={showTerrain}
              hillshade={showTerrain}
              showContours={showTerrain}
              followUser={followUser}
              followPitch={show3D ? 60 : 0}
            />
            <MapControls
              showTerrain={showTerrain}
              onToggleTerrain={() => setShowTerrain((v) => !v)}
              showStyleMenu={showStyleMenu}
              onToggleStyleMenu={() => setShowStyleMenu((v) => !v)}
              mapStyle={mapStyle}
              onSelectStyle={(key) => { setMapStyle(key); setShowStyleMenu(false); }}
              show3D={show3D}
              onToggle3D={() => setShow3D((v) => !v)}
              onCenterOnUser={handleCenterOnUser}
            />
          </View>
          <View style={{ flex: 0.6 }}>
            <PausedView />
          </View>
        </View>
      );

    case 'finished':
      return <FinishedView isDistanceBased={isDistanceBased} />;
    default:
      return <IdleView />;
  }
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  // ---- Shared ----
  container: { flex: 1, backgroundColor: colors.background },

  // ---- Idle ----
  idleControls: { flex: 1 },
  closeButton: { position: 'absolute', top: 8, right: 16, zIndex: 10, padding: 8 },

  // Activity type label shown above the start button
  idleActivityLabel: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },

  // Button row
  idleButtonRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
    paddingTop: 8,
  },
  idleButtonRowCentered: {
    alignItems: 'center',
    paddingTop: 0,
    flex: 1,
    justifyContent: 'center',
  },
  nonDistanceBottomGroup: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  idleButtonRowNoFlex: {
    flex: 0,
    paddingTop: 0,
    gap: 28,
  },
  idleSideButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleSideButtonActive: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  idleButtonGroup: {
    alignItems: 'center',
    gap: 8,
  },
  idleButtonLabel: {
    ...typography.mono,
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonDisabled: { opacity: 0.35 },

  // Selected route indicator
  routeSelectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  routeSelectedText: { flex: 1, ...typography.body, color: colors.foreground, fontSize: 13 },

  // Non-distance idle clock (absolutely centered)
  idleClockCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleClockTime: {
    ...typography.statNumber,
    fontSize: 72,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  idleClockLabel: {
    ...typography.body,
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: 4,
  },

  // ---- Non-distance views ----
  nonDistanceContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  nonDistanceClockCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonDistanceBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  nonDistanceClock: {
    ...typography.statNumber,
    fontSize: 72,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  nonDistanceClockLabel: {
    ...typography.body,
    color: colors.mutedForeground,
    fontSize: 14,
    marginBottom: 16,
  },
  nonDistanceTimer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    ...typography.statNumber,
    fontSize: 56,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // ---- Countdown ----
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  countdownNumber: {
    ...typography.statNumber,
    fontSize: 120,
    color: colors.foreground,
  },
  countdownLabel: {
    ...typography.body,
    fontSize: 18,
    color: colors.mutedForeground,
    marginTop: 8,
  },
  countdownDots: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
  },
  countdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  countdownDotFilled: {
    backgroundColor: colors.primary,
  },

  // ---- Recording ----
  recordingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // GPS row
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  gpsGood: { backgroundColor: colors.gpsGood },
  gpsWeak: { backgroundColor: colors.gpsWeak },
  gpsNone: { backgroundColor: colors.gpsNone },
  gpsText: { ...typography.mono, color: colors.mutedForeground, fontSize: 12 },

  // Time display
  metricTimeRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTime: {
    ...typography.statNumber,
    fontSize: 64,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },

  // Distance + pace row
  metricMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 4,
  },
  metricMainItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricMainValue: {
    ...typography.statNumber,
    fontSize: 26,
    color: colors.foreground,
  },
  metricMainLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },

  // Secondary metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  metricGridItem: {
    width: '48.5%',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  metricGridValue: { ...typography.mono, fontSize: 15, color: colors.foreground },
  metricGridLabel: {
    ...typography.mono,
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Pause button
  pauseButton: {
    backgroundColor: withAlpha(colors.foreground, 0.12),
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 36,
    marginHorizontal: 4,
  },
  pauseButtonText: { ...typography.bodyBold, color: colors.foreground, fontSize: 16 },

  // ---- Paused ----
  pausedContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pausedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pausedIndicatorTop: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pausedTitle: {
    ...typography.headline,
    fontSize: 16,
    color: colors.warning,
    letterSpacing: 2,
  },
  pausedButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
    marginHorizontal: 4,
  },
  discardButton: {
    flex: 1,
    backgroundColor: withAlpha(colors.destructive, 0.12),
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  discardButtonText: { ...typography.bodyBold, color: colors.destructive, fontSize: 14 },
  resumeButton: {
    flex: 1,
    backgroundColor: withAlpha(colors.gpsGood, 0.15),
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  resumeButtonText: { ...typography.bodyBold, color: colors.gpsGood, fontSize: 14 },
  finishButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  finishButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 14 },

  // ---- Finished ----
  finishedContent: { paddingBottom: 60 },
  finishedHeader: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
  finishedTitle: {
    ...typography.headline,
    fontSize: 26,
    textAlign: 'center',
    color: colors.foreground,
    letterSpacing: 1,
  },
  finishedType: {
    ...typography.body,
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },

  // Summary stats grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  summaryItem: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: { ...typography.statNumber, fontSize: 22, color: colors.foreground },
  summaryValueMuted: { ...typography.statNumber, fontSize: 22, color: colors.mutedForeground },
  summaryComingSoon: { ...typography.mono, fontSize: 11, color: colors.mutedForeground },
  summaryLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // Form fields
  fieldLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    marginHorizontal: 20,
    ...typography.body,
  },
  fieldTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.mono,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },

  // Visibility
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
  },
  visibilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visibilityLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.foreground,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryForeground,
  },
  toggleKnobActive: {
    marginLeft: 'auto' as any,
  },

  // Charts
  chartSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  chartSectionTitle: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Mood
  moodTitle: {
    ...typography.bodyMedium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 14,
    marginTop: 24,
    color: colors.foreground,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 28 },
  moodButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  moodButtonSelected: { borderColor: colors.primary, backgroundColor: colors.inputBackground },
  moodImage: { width: 48, height: 48, borderRadius: 24 },

  // Save button
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  saveButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 18 },

  // Discard link (at bottom of finished screen)
  discardLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  discardLinkText: {
    ...typography.body,
    fontSize: 14,
    color: colors.destructive,
  },

  // ---- Modal (shared) ----
  modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: { ...typography.headline, fontSize: 22, color: colors.foreground },

  // Search bar in modal
  searchContainer: { paddingHorizontal: 24, marginBottom: 10 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    ...typography.body,
  },

  // Create route
  createRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: 10,
  },
  createRouteText: { ...typography.bodyBold, color: colors.primary, fontSize: 13 },
  createRouteLink: { ...typography.bodyBold, color: colors.primary, fontSize: 14, marginTop: 8 },
  clearRouteButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  clearRouteText: { ...typography.body, color: colors.destructive, fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { ...typography.body, color: colors.mutedForeground, marginTop: 12 },
  emptyText: { ...typography.body, color: colors.mutedForeground, fontSize: 14 },
  emptySubtext: { ...typography.body, color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
  routeList: { paddingHorizontal: 24, paddingBottom: 40 },
  routeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  routeCardSelected: { borderColor: colors.primary },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  routeCardName: { ...typography.bodyBold, color: colors.foreground, fontSize: 15, flexShrink: 1 },
  routeCardCreator: { ...typography.body, color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  routeCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  routeCardStat: { ...typography.mono, fontSize: 11, color: colors.mutedForeground },

  // ---- Map controls overlay ----
  mapBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  terrainToggle: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -62,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleToggle: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleMenu: {
    position: 'absolute',
    right: 60,
    top: '50%',
    marginTop: -110,
    backgroundColor: colors.overlayDark,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 110,
  },
  styleMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  styleMenuItemActive: {
    backgroundColor: colors.primary + '40',
  },
  styleMenuText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  styleMenuTextActive: {
    color: colors.primary,
    fontFamily: 'DMMono_500Medium',
  },
  view3DToggle: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: 26,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: 70,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
