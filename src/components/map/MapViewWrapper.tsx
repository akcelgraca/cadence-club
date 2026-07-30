import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, LogBox } from 'react-native';
import { MapView, Camera, LocationPuck, UserTrackingMode, RasterDemSource, HillshadeLayer, VectorSource, LineLayer } from '@rnmapbox/maps';
import * as Location from 'expo-location';

// The native Mapbox SDK emits this harmless error when terrain layers
// reference the "dem" source during MapView unmount or style changes.
// LogBox.ignoreLogs catches it at the React Native level regardless of
// how the message is structured (tag, message, or combined).
LogBox.ignoreLogs(["Source 'dem' is in use"]);

// Default: Lisbon, Portugal
const FALLBACK_CENTER: [number, number] = [-9.1393, 38.7223];

function isValidCenter(c: any): c is [number, number] {
  return (
    Array.isArray(c) &&
    c.length === 2 &&
    typeof c[0] === 'number' &&
    typeof c[1] === 'number' &&
    !isNaN(c[0]) &&
    !isNaN(c[1])
  );
}

export const MAPBOX_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
} as const;

export type { MapboxStyleKey } from '../../lib/types';

interface MapViewWrapperProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  mapStyle?: string;
  showUserLocation?: boolean;
  followUser?: boolean;
  followUserMode?: UserTrackingMode;
  followPitch?: number;
  pitch?: number;
  animationDuration?: number;
  terrain?: boolean;
  hillshade?: boolean;
  showContours?: boolean;
  terrainExaggeration?: number;
  children?: ReactNode;
  onPress?: (coord: [number, number]) => void;
  onRegionChange?: (center: [number, number], zoom: number) => void;
  style?: any;
}

/** Terrain layers kept mounted across style changes — @rnmapbox/maps
 *  re-adds them automatically after the new style finishes loading.
 *  Hillshade rendered BEFORE source so unmount order is safe. */
function TerrainLayers({ showHillshade, showContours }: { showHillshade: boolean; showContours: boolean }) {
  return (
    <>
      {/* Hillshade BEFORE source so on unmount the layer is removed
          first — avoiding "Source 'dem' is in use, cannot remove". */}
      {showHillshade && (
        <HillshadeLayer
          id="dem-hillshade"
          sourceID="dem"
          style={{
            hillshadeIlluminationDirection: 315,
            hillshadeIlluminationAnchor: 'map',
            hillshadeExaggeration: 0.3,
          }}
        />
      )}
      <RasterDemSource id="dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />
      {showContours && (
        <VectorSource id="contours" url="mapbox://mapbox.mapbox-terrain-v2">
          <LineLayer
            id="contour-lines"
            sourceLayerID="contour"
            style={{
              lineColor: 'rgba(139,90,43,0.4)',
              lineWidth: 0.5,
            }}
          />
        </VectorSource>
      )}
    </>
  );
}

export function MapViewWrapper({
  center,
  zoom = 12,
  mapStyle = MAPBOX_STYLES.dark,
  showUserLocation = true,
  followUser = false,
  followUserMode = UserTrackingMode.Follow,
  followPitch,
  pitch = 0,
  animationDuration = 0,
  terrain: showTerrain = false,
  hillshade: showHillshade = false,
  showContours = false,
  terrainExaggeration = 1.5,
  children,
  onPress,
  style,
}: MapViewWrapperProps) {
  const cameraRef = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const safeCenter: [number, number] = isValidCenter(center) ? center : FALLBACK_CENTER;

  // Request location permission so UserLocation dot appears
  useEffect(() => {
    if (!showUserLocation) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, [showUserLocation]);

  // Imperatively update camera when center changes (skip if followUser)
  useEffect(() => {
    if (followUser) return;
    cameraRef.current?.setCamera({
      centerCoordinate: safeCenter,
      zoomLevel: zoom,
      pitch,
      animationDuration,
    });
  }, [safeCenter[0], safeCenter[1], zoom, pitch, followUser, animationDuration]);

  const handlePress = useCallback(
    (feature: any) => {
      if (!onPress) return;
      const point = feature?.geometry?.coordinates;
      if (point) onPress(point as [number, number]);
    },
    [onPress],
  );

  const terrainActive = showTerrain;

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        styleURL={mapStyle}
        logoEnabled={false}
        scaleBarEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        onPress={handlePress}
        {...(terrainActive ? { terrain: { exaggeration: terrainExaggeration, source: 'dem' } } : {})}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: safeCenter,
            zoomLevel: zoom,
            pitch,
            animationDuration: 0,
          }}
          {...(followUser
            ? {
                followUserLocation: true,
                followUserMode,
                ...(followPitch != null ? { followPitch } : {}),
              }
            : {})}
        />
        {terrainActive && (
          <TerrainLayers showHillshade={showHillshade} showContours={showContours} />
        )}
        {hasPermission && <LocationPuck visible={true} puckBearingEnabled={true} puckBearing="heading" />}
        {children}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});
