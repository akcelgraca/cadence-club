import type { UnitSystem } from '../lib/types';

// Conversion factors
/** Exportada porque a voz precisa da mesma conversão que o ecrã. */
export const MI_PER_KM = 0.621371;
const FT_PER_M = 3.28084;

/**
 * Convert meters to display-friendly value and unit based on the unit system.
 */
export function metersToDisplay(
  meters: number,
  unitSystem: UnitSystem = 'metric',
): { value: number; unit: string } {
  if (unitSystem === 'imperial') {
    const miles = (meters / 1000) * MI_PER_KM;
    if (miles < 0.1) return { value: Math.round(meters * FT_PER_M), unit: 'ft' };
    if (miles < 10) return { value: miles, unit: 'mi' };
    return { value: Math.round(miles), unit: 'mi' };
  }
  // metric
  if (meters < 1000) return { value: Math.round(meters), unit: 'm' };
  const km = meters / 1000;
  if (km < 10) return { value: km, unit: 'km' };
  return { value: Math.round(km), unit: 'km' };
}

/**
 * Convert distance in meters to a human-readable string respecting the unit system.
 */
export function formatDistanceImperial(
  meters: number,
  unitSystem: UnitSystem = 'metric',
): string {
  const { value, unit } = metersToDisplay(meters, unitSystem);
  if (unit === 'ft') return `${value} ft`;
  // For mi and km, format with 1 decimal for small values
  if (meters < 1000 && unitSystem === 'metric') return `${value} m`;
  if (value < 10) return `${value.toFixed(1)} ${unit}`;
  return `${value} ${unit}`;
}

/**
 * Convert pace from seconds/km to the appropriate unit system.
 */
export function paceToDisplay(
  secondsPerKm: number | null,
  unitSystem: UnitSystem = 'metric',
): string {
  const unitLabel = unitSystem === 'imperial' ? '/mi' : '/km';

  if (secondsPerKm === null || secondsPerKm <= 0) {
    return `--:--${unitLabel}`;
  }

  if (unitSystem === 'imperial') {
    const secondsPerMile = secondsPerKm / MI_PER_KM;
    const min = Math.floor(secondsPerMile / 60);
    const sec = Math.floor(secondsPerMile % 60);
    return `${min}'${sec.toString().padStart(2, '0')}"${unitLabel}`;
  }

  // metric (existing behavior)
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.floor(secondsPerKm % 60);
  return `${min}'${sec.toString().padStart(2, '0')}"${unitLabel}`;
}

/**
 * Convert speed from seconds/km to the appropriate unit system.
 */
export function speedToDisplay(
  secondsPerKm: number | null,
  unitSystem: UnitSystem = 'metric',
): string {
  const unitLabel = unitSystem === 'imperial' ? 'mph' : 'km/h';

  if (secondsPerKm === null || secondsPerKm <= 0) {
    return `-- ${unitLabel}`;
  }

  if (unitSystem === 'imperial') {
    const mph = (3600 / secondsPerKm) * MI_PER_KM;
    return `${mph.toFixed(1)} ${unitLabel}`;
  }

  return `${(3600 / secondsPerKm).toFixed(1)} ${unitLabel}`;
}

/**
 * Convert elevation from meters to the appropriate unit system.
 */
export function elevationToDisplay(
  meters: number,
  unitSystem: UnitSystem = 'metric',
): string {
  if (unitSystem === 'imperial') {
    return `${Math.round(meters * FT_PER_M)} ft`;
  }
  return `${Math.round(meters)} m`;
}
