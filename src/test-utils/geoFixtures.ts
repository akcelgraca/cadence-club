/**
 * Auxiliares para construir traçados de GPS sintéticos nos testes.
 *
 * Todos os pontos andam ao longo de um meridiano (longitude constante).
 * Nesse caso a fórmula de haversine reduz-se a `distância = R × Δlatitude`,
 * portanto conseguimos gerar percursos com distâncias exatas em vez de
 * aproximadas — é isso que permite afirmar "este parcial tem 1000 m".
 */

/** Mesmo raio da Terra usado em utils/geo.ts. */
export const EARTH_RADIUS_M = 6371000;

/** Graus de latitude que correspondem a uma distância em metros. */
export function metersToLatDegrees(meters: number): number {
  return (meters / EARTH_RADIUS_M) * (180 / Math.PI);
}

export interface TrackPoint {
  lat: number;
  lng: number;
  elevation: number | null;
  timestamp: string;
}

/**
 * Traçado em linha reta com espaçamento constante.
 *
 * @param count       número de pontos (o primeiro está no km 0)
 * @param stepMeters  distância entre pontos consecutivos
 * @param stepSeconds tempo entre pontos consecutivos
 */
export function buildTrack(
  count: number,
  stepMeters: number,
  stepSeconds: number,
  options: { startTime?: string; elevationStep?: number; startLat?: number } = {},
): TrackPoint[] {
  const start = new Date(options.startTime ?? '2026-01-01T08:00:00.000Z').getTime();
  const startLat = options.startLat ?? 38.7223; // Lisboa
  const latStep = metersToLatDegrees(stepMeters);

  return Array.from({ length: count }, (_, i) => ({
    lat: startLat + latStep * i,
    lng: -9.1393,
    elevation: options.elevationStep != null ? options.elevationStep * i : null,
    timestamp: new Date(start + stepSeconds * 1000 * i).toISOString(),
  }));
}
