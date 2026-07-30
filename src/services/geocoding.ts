import { MAPBOX_ACCESS_TOKEN } from '../lib/constants';

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Simple LRU-capped in-memory cache to avoid unbounded growth
const MAX_CACHE_SIZE = 200;
const reverseCache = new Map<string, string>();
const forwardCache = new Map<string, { name: string; lng: number; lat: number }[]>();

function evictOldest(cache: Map<string, unknown>, maxSize: number) {
  if (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  try {
    const url = `${MAPBOX_GEOCODING_URL}/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,locality,region&language=pt`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      // Prefer locality (city), fallback to place
      const city = data.features.find((f: any) =>
        f.place_type.includes('place') || f.place_type.includes('locality')
      );
      const name = city?.text ?? data.features[0].text ?? null;
      if (name) {
        reverseCache.set(key, name);
        evictOldest(reverseCache, MAX_CACHE_SIZE);
      }
      return name;
    }
    return null;
  } catch (err) {
    console.warn('[Geocoding] Reverse geocode failed:', err);
    return null;
  }
}

export interface GeocodingResult {
  name: string;
  lng: number;
  lat: number;
  context?: string; // region/country context
}

export async function forwardGeocode(query: string): Promise<GeocodingResult[]> {
  const cacheKey = query.toLowerCase().trim();
  if (forwardCache.has(cacheKey)) return forwardCache.get(cacheKey)!;

  try {
    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,locality&language=pt&limit=5`;
    const res = await fetch(url);
    const data = await res.json();

    const results: GeocodingResult[] = (data.features ?? []).map((f: any) => ({
      name: f.text,
      lng: f.center[0],
      lat: f.center[1],
      context: f.place_name,
    }));

    forwardCache.set(cacheKey, results);
    evictOldest(forwardCache, MAX_CACHE_SIZE);
    return results;
  } catch (err) {
    console.warn('[Geocoding] Forward geocode failed:', err);
    return [];
  }
}
