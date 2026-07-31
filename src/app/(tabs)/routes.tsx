import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MapViewWrapper, MAPBOX_STYLES, type MapboxStyleKey } from '../../components/map/MapViewWrapper';
import { RoutePolyline } from '../../components/map/RoutePolyline';
import { RouteMarker } from '../../components/map/RouteMarker';
import { RouteDetailSheet } from '../../components/map/RouteDetailSheet';
import { RouteCreator } from '../../components/map/RouteCreator';
import { FilterBar } from '../../components/map/FilterBar';
import { useRouteStore } from '../../store/routeStore';
import { useAuthStore } from '../../store/authStore';
import { fetchNearbyRoutes } from '../../services/routes';
import { forwardGeocode } from '../../services/geocoding';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { NearbyRoute, RouteFilters } from '../../lib/types';

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const {
    viewport,
    setViewport,
    isCreating,
    startCreating,
    cancelCreating,
    draftWaypoints,
    addWaypoint,
    selectedRouteId,
    selectRoute,
    clearSelection,
    filters,
    setFilters,
  } = useRouteStore();

  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [cityName, setCityName] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapboxStyleKey>('dark');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [showTerrain, setShowTerrain] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const pre3DZoomRef = useRef<number | null>(null);
  const [adjustedZoom, setAdjustedZoom] = useState<number | null>(null);
  const [is3DTransitioning, setIs3DTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle3D = useCallback(() => {
    // Clear any pending transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setShow3D((v) => {
      if (!v) {
        // Enabling 3D: store current zoom and compensate for perspective
        pre3DZoomRef.current = viewport.zoom;
        setAdjustedZoom(viewport.zoom + 1);
      } else {
        // Disabling 3D: restore original zoom
        pre3DZoomRef.current = null;
        setAdjustedZoom(null);
      }
      return !v;
    });
    setIs3DTransitioning(true);
    transitionTimeoutRef.current = setTimeout(() => {
      setIs3DTransitioning(false);
    }, 600);
  }, [viewport.zoom]);

  const displayZoom = adjustedZoom ?? viewport.zoom;

  // Resolve map center: GPS first → city geocode fallback → store default
  useEffect(() => {
    const resolveCenter = async () => {
      // Try GPS first for precise user location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setMapCenter([loc.coords.longitude, loc.coords.latitude]);
          // Also try to get city name for the badge
          const city = profile?.city;
          if (city) {
            const results = await forwardGeocode(city);
            if (results.length > 0) {
              setCityName(results[0].name);
            }
          }
          return;
        }
      } catch { /* GPS not available, fall back to city geocode */ }

      // Fallback to city geocode
      const city = profile?.city;
      if (city) {
        const results = await forwardGeocode(city);
        if (results.length > 0) {
          setMapCenter([results[0].lng, results[0].lat]);
          setCityName(results[0].name);
          return;
        }
      }
    };
    resolveCenter();
  }, [profile?.city]);

  // Fetch nearby routes
  const center = mapCenter ?? viewport.center;
  const userId = profile?.id;
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['nearbyRoutes', center[1], center[0], filters, userId],
    queryFn: () => fetchNearbyRoutes(center[1], center[0], filters, userId),
    enabled: !!center,
  });

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  // When a route is selected, fly to its start point
  useEffect(() => {
    if (selectedRoute) {
      setViewport({ center: selectedRoute.start_point, zoom: 14 });
    }
  }, [selectedRouteId]);

  const handleMapPress = useCallback(
    (coord: [number, number]) => {
      if (isCreating) {
        addWaypoint(coord);
        return;
      }
      // Tap on blank area → clear selection
      clearSelection();
    },
    [isCreating, addWaypoint, clearSelection],
  );

  const handleRouteSelect = useCallback(
    (route: NearbyRoute) => {
      selectRoute(route.id);
    },
    [selectRoute],
  );

  const handleFollowRoute = useCallback(
    (route: NearbyRoute) => {
      router.push({ pathname: '/record', params: { routeId: route.id } });
    },
    [],
  );

  const handleSaveRoute = useCallback(() => {
    refetch();
  }, [refetch]);

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
      >
        {/* Render nearby routes */}
        {routes.flatMap((route) => {
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

        {/* Start/Finish labels for selected route */}
        {selectedRoute && selectedRoute.path.length > 0 && (
          <>
            <RouteMarker
              id={`start-${selectedRoute.id}`}
              coordinate={selectedRoute.path[0]}
              type="start"
              label="Inicio"
            />
            <RouteMarker
              id={`finish-${selectedRoute.id}`}
              coordinate={selectedRoute.path[selectedRoute.path.length - 1]}
              type="finish"
              label="Fim"
            />
          </>
        )}

        {/* Draft waypoints (in creation mode) */}
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

        {/* Draft polyline */}
        {isCreating && draftWaypoints.length >= 2 && (
          <RoutePolyline
            id="draft"
            coordinates={draftWaypoints}
            color="#f39c12"
            opacity={0.7}
          />
        )}
      </MapViewWrapper>

      {/* City overlay */}
      {cityName && (
        <View style={[styles.cityBadge, { top: insets.top + 90 }]}>
          <Ionicons name="location" size={12} color={colors.primary} />
          <Text style={styles.cityText}>{cityName}</Text>
        </View>
      )}

      {/* Route count badge */}
      {routes.length > 0 && (
        <View style={[styles.countBadge, { top: insets.top + 130 }]}>
          <Text style={styles.countText}>{routes.length} rotas</Text>
        </View>
      )}

      {/* Map style selector */}
      {!isCreating && (
        <>
          {/* Backdrop */}
          {styleMenuOpen && (
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={() => setStyleMenuOpen(false)}
            />
          )}

          {/* Terrain toggle */}
          <TouchableOpacity
            style={styles.terrainToggle}
            onPress={() => setShowTerrain((v) => !v)}
          >
            <Ionicons
              name="triangle"
              size={18}
              color={showTerrain ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>

          {/* 3D view toggle */}
          <TouchableOpacity
            style={styles.view3DToggle}
            onPress={handleToggle3D}
          >
            <Ionicons
              name="cube-outline"
              size={18}
              color={show3D ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>

          {/* Toggle button */}
          <TouchableOpacity
            style={styles.styleToggle}
            onPress={() => setStyleMenuOpen((v) => !v)}
          >
            <Ionicons name="layers-outline" size={18} color={colors.foreground} />
          </TouchableOpacity>

          {/* Vertical menu */}
          {styleMenuOpen && (
            <View style={styles.styleMenu}>
              {(Object.keys(MAPBOX_STYLES) as MapboxStyleKey[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.styleMenuItem, mapStyle === key && styles.styleMenuItemActive]}
                  onPress={() => {
                    setMapStyle(key);
                    setStyleMenuOpen(false);
                  }}
                >
                  <Text style={[styles.styleMenuText, mapStyle === key && styles.styleMenuTextActive]}>
                    {key === 'dark' ? 'Escuro' :
                     key === 'light' ? 'Claro' :
                     key === 'streets' ? 'Ruas' :
                     key === 'satellite' ? 'Satelite' :
                     'Ar Livre'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* FAB: Create route */}
      {!isCreating && (
        <TouchableOpacity style={styles.fab} onPress={startCreating}>
          <Ionicons name="add" size={28} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      {/* Route creator panel */}
      {isCreating && (
        <RouteCreator onSave={handleSaveRoute} onCancel={cancelCreating} />
      )}

      {/* Route detail sheet */}
      <RouteDetailSheet
        route={selectedRoute}
        visible={!!selectedRoute}
        onClose={clearSelection}
        onFollow={handleFollowRoute}
        isOwner={profile?.id === selectedRoute?.user_id}
      />
    </SafeAreaView>
    <FilterBar filters={filters} onFiltersChange={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cityBadge: {
    position: 'absolute',
    top: 90,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlayDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cityText: {
    ...typography.body,
    fontSize: 13,
    color: colors.foreground,
  },
  countBadge: {
    position: 'absolute',
    top: 130,
    right: 16,
    backgroundColor: colors.overlayDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  backdrop: {
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
    backgroundColor: withAlpha(colors.primary, 0.25),
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
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.primaryForeground,
  },
  routeDotStart: {
    backgroundColor: colors.markerStart,
  },
  routeDotEnd: {
    backgroundColor: colors.markerEnd,
  },
  routeDotDimmed: {
    opacity: 0.35,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
