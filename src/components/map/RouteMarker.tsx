import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { PointAnnotation } from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { type Colors } from '../../lib/theme';

type MarkerType = 'start' | 'finish' | 'water' | 'viewpoint' | 'restroom' | 'parking' | 'cafe' | 'landmark' | 'custom' | 'waypoint';

/**
 * Ícone e cor por tipo de marcador.
 *
 * Função da paleta, e não constante de módulo, porque os dois genéricos
 * (`custom` e `waypoint`) usam o verde da marca, que muda entre temas. Os
 * restantes são iguais nos dois de propósito: vivem por cima do mapa, não da
 * interface, e o significado de cada cor — água, miradouro, estacionamento —
 * tem de ser o mesmo de dia e de noite.
 */
const iconMap = (c: Colors): Record<MarkerType, { icon: string; bg: string }> => ({
  start: { icon: 'flag', bg: c.markerStart },
  finish: { icon: 'flag', bg: c.markerEnd },
  water: { icon: 'water', bg: c.markerWater },
  viewpoint: { icon: 'eye', bg: c.markerViewpoint },
  restroom: { icon: 'man', bg: c.markerRestroom },
  parking: { icon: 'car', bg: c.markerParking },
  cafe: { icon: 'cafe', bg: c.markerCafe },
  landmark: { icon: 'star', bg: c.markerLandmark },
  custom: { icon: 'ellipse', bg: c.primary },
  waypoint: { icon: 'ellipse', bg: c.primary },
});

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { icon, bg } = useMemo(() => iconMap(c), [c])[type];

  return (
    <PointAnnotation
      id={id}
      coordinate={coordinate}
      onSelected={onPress}
    >
      <View style={styles.markerWrapper}>
        <View style={[styles.marker, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={10} color={c.primaryForeground} />
        </View>
        {label ? <Text style={styles.label}>{label}</Text> : <View />}
      </View>
    </PointAnnotation>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
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
    borderColor: c.primaryForeground,
  },
  label: {
    color: c.primaryForeground,
    fontSize: 9,
    fontFamily: 'Barlow_600SemiBold',
    textAlign: 'center',
    marginTop: 2,
    backgroundColor: c.overlayDark,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
