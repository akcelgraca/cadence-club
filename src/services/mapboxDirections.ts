import { MAPBOX_ACCESS_TOKEN } from '../lib/constants';
import { getElevationProfile } from './elevation';

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox';

type DirectionProfile = 'walking' | 'cycling' | 'running';

// running uses the walking profile under the hood
function mapProfile(profile: DirectionProfile): string {
  if (profile === 'running') return 'walking';
  return profile;
}

interface DirectionsResult {
  path: [number, number][]; // snapped polyline [lng, lat][]
  distance: number; // meters
  duration: number; // seconds
  elevationGain: number;
  elevations: number[];
}

// Decode Mapbox polyline (precision 5 or 6)
function decodePolyline(str: string, precision: number = 5): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

export async function getRoutePath(
  waypoints: [number, number][],
  profile: DirectionProfile = 'running',
): Promise<DirectionsResult> {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const mappedProfile = mapProfile(profile);
  const url = `${MAPBOX_DIRECTIONS_URL}/${mappedProfile}/${coords}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=polyline&overview=full`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || !data.routes || data.routes.length === 0) {
    console.error('[Directions] Mapbox API error:', data);
    throw new Error(data.message ?? 'No route found');
  }

  const route = data.routes[0];
  const path = decodePolyline(route.geometry);

  const { elevations, elevationGain } = await getElevationProfile(path);

  return {
    path,
    distance: route.distance, // meters
    duration: route.duration, // seconds
    elevationGain,
    elevations,
  };
}
