import { View, Text, StyleSheet } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';

type MarkerType = 'start' | 'finish' | 'water' | 'viewpoint' | 'restroom' | 'parking' | 'cafe' | 'landmark' | 'custom' | 'waypoint';

const ICON_MAP: Record<MarkerType, { icon: string; color: string; bg: string }> = {
  start: { icon: 'flag', color: colors.primaryForeground, bg: colors.markerStart },
  finish: { icon: 'flag', color: colors.primaryForeground, bg: colors.markerEnd },
  water: { icon: 'water', color: colors.primaryForeground, bg: colors.markerWater },
  viewpoint: { icon: 'eye', color: colors.primaryForeground, bg: colors.markerViewpoint },
  restroom: { icon: 'man', color: colors.primaryForeground, bg: colors.markerRestroom },
  parking: { icon: 'car', color: colors.primaryForeground, bg: colors.markerParking },
  cafe: { icon: 'cafe', color: colors.primaryForeground, bg: colors.markerCafe },
  landmark: { icon: 'star', color: colors.primaryForeground, bg: colors.markerLandmark },
  custom: { icon: 'ellipse', color: colors.primaryForeground, bg: colors.primary },
  waypoint: { icon: 'ellipse', color: colors.primaryForeground, bg: colors.primary },
};

interface RouteMarkerProps {
  id: string;
  coordinate: [number, number]; // [lng, lat]
  type?: MarkerType;
  label?: string;
  onPress?: () => void;
}

export function RouteMarker({
  id,
  coordinate,
  type = 'waypoint',
  label,
  onPress,
}: RouteMarkerProps) {
  const { icon, bg } = ICON_MAP[type];

  return (
    <PointAnnotation
      id={id}
      coordinate={coordinate}
      onSelected={onPress}
    >
      <View style={styles.markerWrapper}>
        <View style={[styles.marker, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={10} color={colors.primaryForeground} />
        </View>
        {label ? <Text style={styles.label}>{label}</Text> : <View />}
      </View>
    </PointAnnotation>
  );
}

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: 'center',
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryForeground,
  },
  label: {
    color: colors.primaryForeground,
    fontSize: 9,
    fontFamily: 'Barlow_600SemiBold',
    textAlign: 'center',
    marginTop: 2,
    backgroundColor: colors.overlayDark,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
