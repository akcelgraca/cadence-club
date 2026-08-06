import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { mapControlsHeight } from '../../components/record/MapControls';
import { MapViewWrapper, MAPBOX_STYLES, type MapboxStyleKey } from '../../components/map/MapViewWrapper';
import { RoutePolyline } from '../../components/map/RoutePolyline';
import { RouteMarker } from '../../components/map/RouteMarker';
import { RouteDetailSheet } from '../../components/map/RouteDetailSheet';
import { RouteCreator } from '../../components/map/RouteCreator';
import { RouteCarouselCard } from '../../components/map/RouteCarouselCard';
import { FilterBar } from '../../components/map/FilterBar';
import { useRouteStore } from '../../store/routeStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { fetchNearbyRoutes, getSavedRouteIds, saveRoute, unsaveRoute } from '../../services/routes';
import { reverseGeocode } from '../../services/geocoding';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { NearbyRoute } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import { track } from '../../lib/analytics';

const CARD_GAP = 12;
const CARD_RATIO = 0.82;
const CAROUSEL_HEIGHT = 156;

export default function RoutesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const defaultMapStyle = useSettingsStore((s) => s.settings.defaultMapStyle);

  const {
    viewport, setViewport,
    isCreating, startCreating, cancelCreating,
    draftWaypoints, addWaypoint,
    selectedRouteId, selectRoute, clearSelection,
    filters, setFilters,
  } = useRouteStore();

  const cardWidth = Math.round(screenW * CARD_RATIO);
  const snapInterval = cardWidth + CARD_GAP;

  const carouselRef = useRef<FlatList<NearbyRoute>>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [cityName, setCityName] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapboxStyleKey>(defaultMapStyle ?? 'light');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [showTerrain, setShowTerrain] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  /** Separado da seleção: selecionar no carrossel realça no mapa, tocar abre a ficha. */
  const [detailRoute, setDetailRoute] = useState<NearbyRoute | null>(null);

  const pre3DZoomRef = useRef<number | null>(null);
  const [adjustedZoom, setAdjustedZoom] = useState<number | null>(null);
  const [is3DTransitioning, setIs3DTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle3D = useCallback(() => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    setShow3D((v) => {
      if (!v) {
        pre3DZoomRef.current = viewport.zoom;
        setAdjustedZoom(viewport.zoom + 1);
      } else {
        pre3DZoomRef.current = null;
        setAdjustedZoom(null);
      }
      return !v;
    });
    setIs3DTransitioning(true);
    transitionTimeoutRef.current = setTimeout(() => setIs3DTransitioning(false), 600);
  }, [viewport.zoom]);

  const displayZoom = adjustedZoom ?? viewport.zoom;

  // Centro do mapa: GPS primeiro, cidade do perfil como recurso
  useEffect(() => {
    const resolveCenter = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setMapCenter([loc.coords.longitude, loc.coords.latitude]);
          return;
        }
      } catch { /* sem GPS — segue para a cidade do perfil */ }
    };
    resolveCenter();
  }, []);

  const center = mapCenter ?? viewport.center;
  const userId = profile?.id;

  // O nome da localidade vem do próprio mapa, não do perfil — assim acompanha
  // a área que estás a ver em vez de mostrar sempre a tua cidade
  useEffect(() => {
    let cancelled = false;
    reverseGeocode(center[1], center[0])
      .then((place) => { if (!cancelled) setCityName(place); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [Math.round(center[0] * 100), Math.round(center[1] * 100)]);

  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['nearbyRoutes', center[1], center[0], filters, userId],
    queryFn: () => fetchNearbyRoutes(center[1], center[0], filters, userId),
    enabled: !!center,
  });

  useFocusEffect(useCallback(() => {
    getSavedRouteIds().then(setSavedIds).catch(() => {});
  }, []));

  const visibleRoutes = useMemo(
    () => (savedOnly ? routes.filter((r) => savedIds.has(r.id)) : routes),
    [routes, savedOnly, savedIds],
  );

  const selectedRoute = visibleRoutes.find((r) => r.id === selectedRouteId) ?? null;

  // Ao selecionar, voa para o início da rota
  useEffect(() => {
    if (selectedRoute) setViewport({ center: selectedRoute.start_point, zoom: 14 });
  }, [selectedRouteId]);

  const handleMapPress = useCallback(
    (coord: [number, number]) => {
      if (isCreating) {
        addWaypoint(coord);
        return;
      }
      clearSelection();
    },
    [isCreating, addWaypoint, clearSelection],
  );

  const handleToggleSave = useCallback(async (route: NearbyRoute) => {
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
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(route.id); else next.delete(route.id);
        return next;
      });
    }
  }, [savedIds]);

  const handleFollowRoute = useCallback((route: NearbyRoute) => {
    router.push({ pathname: '/record', params: { routeId: route.id } });
  }, []);

  const handleSaveRoute = useCallback(() => { refetch(); }, [refetch]);

  const showCarousel = !isCreating && visibleRoutes.length > 0;
  const fabBottom = showCarousel ? CAROUSEL_HEIGHT + 16 : 30;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MapViewWrapper
          center={center}
          zoom={displayZoom}
          mapStyle={MAPBOX_STYLES[mapStyle]}
          terrain={showTerrain}
          hillshade={showTerrain}
          showContours={showTerrain}
          pitch={show3D ? 60 : 0}
          animationDuration={is3DTransitioning ? 600 : 0}
          onPress={handleMapPress}
          onRegionChange={(c, z) => setViewport({ center: c, zoom: z })}
          compassPosition={{ top: insets.top + 8 + mapControlsHeight() + 8, right: 12 }}
        >
          {visibleRoutes.flatMap((route) => {
            const isSelected = route.id === selectedRouteId;
            const isDimmed = !!selectedRouteId && !isSelected;
            const elements = [
              <RoutePolyline
                key={route.id}
                id={route.id}
                coordinates={route.path}
                isSelected={isSelected}
                opacity={isDimmed ? 0.15 : 0.5}
              />,
            ];
            if (route.path.length > 0) {
              elements.push(
                <PointAnnotation
                  key={`start-dot-${route.id}`}
                  id={`start-dot-${route.id}`}
                  coordinate={route.path[0]}
                  onSelected={() => selectRoute(route.id)}
                >
                  <View style={[styles.routeDot, styles.routeDotStart, isDimmed && styles.routeDotDimmed]} />
                </PointAnnotation>,
              );
            }
            if (route.path.length > 1) {
              elements.push(
                <PointAnnotation
                  key={`end-dot-${route.id}`}
                  id={`end-dot-${route.id}`}
                  coordinate={route.path[route.path.length - 1]}
                >
                  <View style={[styles.routeDot, styles.routeDotEnd, isDimmed && styles.routeDotDimmed]} />
                </PointAnnotation>,
              );
            }
            return elements;
          })}

          {selectedRoute && selectedRoute.path.length > 0 && (
            <>
              <RouteMarker
                id={`start-${selectedRoute.id}`}
                coordinate={selectedRoute.path[0]}
                type="start"
                label={t('routes_start')}
              />
              <RouteMarker
                id={`finish-${selectedRoute.id}`}
                coordinate={selectedRoute.path[selectedRoute.path.length - 1]}
                type="finish"
                label="Fim"
              />
            </>
          )}

          {isCreating &&
            draftWaypoints.map((coord, i) => (
              <RouteMarker
                key={`draft-${i}`}
                id={`draft-${i}`}
                coordinate={coord}
                type={i === 0 ? 'start' : 'waypoint'}
                label={`${i + 1}`}
                onPress={() => {}}
              />
            ))}

          {isCreating && draftWaypoints.length >= 2 && (
            <RoutePolyline id="draft" coordinates={draftWaypoints} color="#f39c12" opacity={0.7} />
          )}
        </MapViewWrapper>

        {/* Localidade — ao lado do botão de filtros */}
        {cityName && !isCreating && (
          <View style={[styles.cityBadge, { top: insets.top + 8 }]}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={styles.cityText} numberOfLines={1}>{cityName}</Text>
          </View>
        )}

        {/* Controlos do mapa — agrupados no canto superior direito */}
        {!isCreating && (
          <>
            {styleMenuOpen && (
              <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={() => setStyleMenuOpen(false)}
              />
            )}

            <View style={[styles.controlStack, { top: insets.top + 8 }]}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setStyleMenuOpen((v) => !v)}
                accessibilityLabel={t('settings_map_style')}
              >
                <Ionicons name="layers-outline" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setShowTerrain((v) => !v)}
                accessibilityLabel={t('routes_terrain')}
              >
                <Ionicons name="triangle" size={17} color={showTerrain ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => { track('premium_feature_used', { feature: 'map_3d' }); handleToggle3D(); }}
                accessibilityLabel={t('routes_3d')}
              >
                <Ionicons name="cube-outline" size={18} color={show3D ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, savedOnly && styles.controlBtnActive]}
                onPress={() => { setSavedOnly((v) => !v); clearSelection(); }}
                accessibilityLabel={t('routes_saved_only')}
              >
                <Ionicons
                  name={savedOnly ? 'bookmark' : 'bookmark-outline'}
                  size={17}
                  color={savedOnly ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {styleMenuOpen && (
              <View style={[styles.styleMenu, { top: insets.top + 8 }]}>
                {(Object.keys(MAPBOX_STYLES) as MapboxStyleKey[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.styleMenuItem, mapStyle === key && styles.styleMenuItemActive]}
                    onPress={() => { track('premium_feature_used', { feature: 'map_styles' }); setMapStyle(key); setStyleMenuOpen(false); }}
                  >
                    <Text style={[styles.styleMenuText, mapStyle === key && styles.styleMenuTextActive]}>
                      {key === 'dark' ? t('settings_map_dark')
                        : key === 'light' ? t('settings_map_light')
                        : key === 'streets' ? t('settings_map_streets')
                        : key === 'satellite' ? t('settings_map_satellite')
                        : t('settings_map_outdoors')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* FAB: criar rota */}
        {!isCreating && (
          <TouchableOpacity
            style={[styles.fab, { bottom: fabBottom }]}
            onPress={startCreating}
            accessibilityLabel={t('routes_create')}
          >
            <Ionicons name="add" size={28} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}

        {/* Carrossel de rotas — a camada de navegação que faltava */}
        {!isCreating && (
          isLoading ? (
            <View style={styles.carouselState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : visibleRoutes.length > 0 ? (
            <FlatList
              ref={carouselRef}
              style={styles.carousel}
              data={visibleRoutes}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={snapInterval}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingHorizontal: (screenW - cardWidth) / 2,
                gap: CARD_GAP,
              }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
                const route = visibleRoutes[index];
                if (route && route.id !== selectedRouteId) selectRoute(route.id);
              }}
              renderItem={({ item }) => (
                <RouteCarouselCard
                  route={item}
                  width={cardWidth}
                  isActive={item.id === selectedRouteId}
                  isSaved={savedIds.has(item.id)}
                  onToggleSave={() => handleToggleSave(item)}
                  onDetails={() => { selectRoute(item.id); setDetailRoute(item); }}
                  onFollow={() => handleFollowRoute(item)}
                />
              )}
            />
          ) : (
            <View style={styles.carouselState}>
              <View style={styles.emptyCard}>
                <Ionicons
                  name={savedOnly ? 'bookmark-outline' : 'map-outline'}
                  size={22}
                  color={colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyTitle}>
                    {savedOnly ? t('routes_none_saved') : t('routes_none_here')}
                  </Text>
                  <Text style={styles.emptySub}>
                    {savedOnly
                      ? t('routes_none_saved_body')
                      : t('routes_none_here_body')}
                  </Text>
                </View>
              </View>
            </View>
          )
        )}

        {isCreating && <RouteCreator onSave={handleSaveRoute} onCancel={cancelCreating} />}

        <RouteDetailSheet
          route={detailRoute}
          visible={!!detailRoute}
          onClose={() => setDetailRoute(null)}
          onFollow={handleFollowRoute}
          isOwner={profile?.id === detailRoute?.user_id}
        />
      </SafeAreaView>

      <FilterBar filters={filters} onFiltersChange={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Pastilha da localidade (à direita do botão de filtros)
  cityBadge: {
    position: 'absolute',
    left: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 180,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cityText: { ...typography.bodyMedium, fontSize: 13, color: colors.foreground, flexShrink: 1 },

  // Controlos agrupados
  controlStack: {
    position: 'absolute',
    right: 12,
    gap: 8,
  },
  controlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Ativo = anel verde sobre branco opaco; um fundo translúcido deixaria
  // o mapa passar através do botão
  controlBtnActive: { borderWidth: 1.5, borderColor: colors.primary },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  styleMenu: {
    position: 'absolute',
    right: 60,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 118,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  styleMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  styleMenuItemActive: { backgroundColor: withAlpha(colors.primary, 0.12) },
  styleMenuText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  styleMenuTextActive: { color: colors.primary, fontFamily: 'DMMono_500Medium' },

  routeDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.primaryForeground,
  },
  routeDotStart: { backgroundColor: colors.markerStart },
  routeDotEnd: { backgroundColor: colors.markerEnd },
  routeDotDimmed: { opacity: 0.35 },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },

  // Carrossel
  carousel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 16,
    maxHeight: CAROUSEL_HEIGHT,
  },
  carouselState: {
    position: 'absolute',
    left: 0, right: 0, bottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  emptySub: {
    ...typography.body, fontSize: 12,
    color: colors.mutedForeground, marginTop: 2, lineHeight: 16,
  },
});
