const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const MAX_SAMPLE_POINTS = 50;

export interface ElevationProfileResult {
  elevations: number[];
  elevationGain: number;
}

function samplePath(path: [number, number][], maxPoints: number): [number, number][] {
  if (path.length <= maxPoints) return path;

  const step = (path.length - 1) / (maxPoints - 1);
  const sampled: [number, number][] = [];

  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    sampled.push(path[idx]);
  }

  return sampled;
}

export async function getElevationProfile(
  path: [number, number][],
): Promise<ElevationProfileResult> {
  if (path.length < 2) {
    return { elevations: [], elevationGain: 0 };
  }

  const sampled = samplePath(path, MAX_SAMPLE_POINTS);

  try {
    const latitudes = sampled.map(([, lat]) => lat);
    const longitudes = sampled.map(([lng]) => lng);

    const res = await fetch(OPEN_METEO_ELEVATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitudes, longitudes }),
    });

    if (!res.ok) {
      console.error('[Elevation] API error:', res.status);
      return { elevations: [], elevationGain: 0 };
    }

    const data = await res.json();
    const elevations: number[] = data.elevation ?? [];

    if (!elevations.length) {
      return { elevations: [], elevationGain: 0 };
    }

    // Compute cumulative positive elevation delta
    let elevationGain = 0;
    for (let i = 1; i < elevations.length; i++) {
      const delta = elevations[i] - elevations[i - 1];
      if (delta > 0) {
        elevationGain += delta;
      }
    }

    return { elevations, elevationGain: Math.round(elevationGain) };
  } catch (err) {
    console.error('[Elevation] Failed to fetch elevation:', err);
    return { elevations: [], elevationGain: 0 };
  }
}
