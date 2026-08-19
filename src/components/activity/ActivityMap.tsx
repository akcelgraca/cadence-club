import { View, StyleSheet } from 'react-native';
import { MapViewWrapper, MAPBOX_STYLES } from '../map/MapViewWrapper';
import { RoutePolyline } from '../map/RoutePolyline';
import { RouteMarker } from '../map/RouteMarker';
import { useSettingsStore } from '../../store/settingsStore';

interface ActivityMapProps {
  points?: { lat: number; lng: number }[];
  interactive?: boolean;
  height?: number;
  terrain?: boolean;
  hillshade?: boolean;
  showContours?: boolean;
}

export function ActivityMap({
  points,
  interactive = false,
  height = 200,
  terrain = true,
  hillshade = true,
  showContours = true,
}: ActivityMapProps) {
  const coords: [number, number][] = (points ?? []).map((p) => [p.lng, p.lat]);
  const defaultMapStyle = useSettingsStore((s) => s.settings.defaultMapStyle);

  const center: [number, number] | undefined =
    coords.length > 0 ? [coords[0][0], coords[0][1]] : undefined;

  return (
    <View style={[styles.container, { height }]}>
      <MapViewWrapper
        center={center}
        mapStyle={MAPBOX_STYLES[defaultMapStyle] ?? MAPBOX_STYLES.light}
        zoom={14}
        showUserLocation={false}
        terrain={terrain}
        hillshade={hillshade}
        showContours={showContours}
        style={styles.map}
      >
        {coords.length >= 2 && (
          <>
            <RoutePolyline id="activity-route" coordinates={coords} />
            <RouteMarker id="activity-start" coordinate={coords[0]} type="start" />
            <RouteMarker
              id="activity-end"
              coordinate={coords[coords.length - 1]}
              type="finish"
            />
          </>
        )}
      </MapViewWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    borderRadius: 16,
  },
});
