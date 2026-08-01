import { MAPBOX_ACCESS_TOKEN } from './constants';

const STYLE = 'mapbox/light-v11';

/** Downsample an array to at most maxPoints evenly-spaced items. */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const result: T[] = [];
  const step = (arr.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

/**
 * Build a Mapbox Static Images API URL that renders the activity route as a
 * coloured line overlay on a dark map.
 *
 * @param routeSummary  Array of [lat, lng] pairs (as stored in the DB)
 * @param color         Hex colour WITHOUT the # (default: the app primary)
 * @param width         Image width in CSS pixels
 * @param height        Image height in CSS pixels
 */
export function buildStaticMapUrl(
  routeSummary: number[][],
  color = 'C7F732',
  width = 800,
  height = 450,
): string {
  if (!routeSummary || routeSummary.length < 2) return '';

  // Mapbox expects [lng, lat]; route_summary stores [lat, lng]
  const sampled = downsample(routeSummary, 20);
  const coords = sampled.map(([lat, lng]) => [lng, lat]);

  // GeoJSON LineString overlay
  const geojson = JSON.stringify({
    type: 'Feature',
    properties: { stroke: `#${color}`, 'stroke-width': 3 },
    geometry: { type: 'LineString', coordinates: coords },
  });

  const overlay = `geojson(${encodeURIComponent(geojson)})`;

  return (
    `https://api.mapbox.com/styles/v1/${STYLE}/static/` +
    `${overlay}/auto/${width}x${height}@2x` +
    `?padding=30&access_token=${MAPBOX_ACCESS_TOKEN}`
  );
}
