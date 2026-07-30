import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import { colors } from '../../lib/theme';

interface RoutePolylineProps {
  id: string;
  coordinates: [number, number][]; // [lng, lat][]
  color?: string;
  width?: number;
  isSelected?: boolean;
  opacity?: number;
}

export function RoutePolyline({
  id,
  coordinates,
  color,
  width,
  isSelected = false,
  opacity = 0.4,
}: RoutePolylineProps) {
  if (coordinates.length < 2) return null;

  const geoJson = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
    properties: {},
  };

  const lineColor = isSelected ? colors.primary : color ?? colors.primary;
  const lineWidth = isSelected ? (width ?? 3) + 1 : width ?? 3;

  return (
    <ShapeSource id={`route-${id}`} shape={geoJson}>
      {/* Glow line (wider, transparent) */}
      <LineLayer
        id={`route-${id}-glow`}
        style={{
          lineColor: lineColor,
          lineWidth: lineWidth + 3,
          lineOpacity: 0.1,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Main line */}
      <LineLayer
        id={`route-${id}-main`}
        style={{
          lineColor: lineColor,
          lineWidth: lineWidth,
          lineOpacity: opacity,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}
