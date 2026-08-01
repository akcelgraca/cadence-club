import { haversineDistance } from './geo';
import type { UnitSystem } from '../lib/types';

/** Metros por unidade de parcial: 1 km ou 1 milha. */
const UNIT_METERS: Record<UnitSystem, number> = {
  metric: 1000,
  imperial: 1609.344,
};

export interface Split {
  /** 1 = primeiro quilómetro (ou milha). */
  index: number;
  /** Metros percorridos neste parcial — inferior à unidade no último. */
  distance: number;
  /** Segundos gastos neste parcial. */
  duration: number;
  /** Ritmo em segundos por quilómetro (formatPace converte para milhas). */
  pace: number;
  elevationGain: number;
  /** O último parcial é quase sempre incompleto. */
  isPartial: boolean;
}

export interface SplitPoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  timestamp: string;
}

/**
 * Divide o percurso em parciais de 1 km (ou 1 milha).
 *
 * Os pontos de GPS não caem exatamente nas fronteiras dos quilómetros, por isso
 * o tempo e a subida do segmento que atravessa a fronteira são repartidos
 * proporcionalmente à distância — senão os parciais ficavam enviesados pela
 * frequência de amostragem do GPS.
 */
export function computeSplits(points: SplitPoint[], unitSystem: UnitSystem = 'metric'): Split[] {
  const unit = UNIT_METERS[unitSystem] ?? UNIT_METERS.metric;
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let accDistance = 0;
  let accTime = 0;
  let accElevation = 0;

  const pushSplit = (distance: number, duration: number, elevation: number, isPartial: boolean) => {
    splits.push({
      index: splits.length + 1,
      distance,
      duration,
      pace: distance > 0 ? duration / (distance / 1000) : 0,
      elevationGain: elevation,
      isPartial,
    });
  };

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    let segDistance = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    if (!Number.isFinite(segDistance) || segDistance <= 0) continue;

    let segTime = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
    if (!Number.isFinite(segTime) || segTime < 0) segTime = 0;

    const prevElev = prev.elevation ?? null;
    const currElev = curr.elevation ?? null;
    let segElevation =
      prevElev != null && currElev != null ? Math.max(0, currElev - prevElev) : 0;

    // Um único segmento pode atravessar mais do que uma fronteira
    while (accDistance + segDistance >= unit) {
      const needed = unit - accDistance;
      const fraction = needed / segDistance;
      const timeUsed = segTime * fraction;
      const elevUsed = segElevation * fraction;

      pushSplit(unit, accTime + timeUsed, accElevation + elevUsed, false);

      segDistance -= needed;
      segTime -= timeUsed;
      segElevation -= elevUsed;
      accDistance = 0;
      accTime = 0;
      accElevation = 0;
    }

    accDistance += segDistance;
    accTime += segTime;
    accElevation += segElevation;
  }

  // Resto final — só vale a pena mostrar acima de 50 m
  if (accDistance > 50) {
    pushSplit(accDistance, accTime, accElevation, true);
  }

  return splits;
}
