import type { UnitSystem } from '../lib/types';
import { paceToDisplay, speedToDisplay, elevationToDisplay } from './convertUnits';

/**
 * Format pace in seconds/km to a human-readable string like "5'30\"/km" or "8'51\"/mi".
 * Uses unitSystem from settings to determine units (defaults to metric for backward compat).
 */
export function formatPace(secondsPerKm: number | null, unitSystem?: UnitSystem): string {
  return paceToDisplay(secondsPerKm, unitSystem);
}

/**
 * Format speed from pace in seconds/km to km/h or mph.
 * Uses unitSystem from settings to determine units (defaults to metric for backward compat).
 */
export function formatSpeed(secondsPerKm: number | null, unitSystem?: UnitSystem): string {
  return speedToDisplay(secondsPerKm, unitSystem);
}

/**
 * Format elevation from meters to m or ft.
 * Uses unitSystem from settings to determine units (defaults to metric for backward compat).
 */
export function formatElevation(meters: number, unitSystem?: UnitSystem): string {
  return elevationToDisplay(meters, unitSystem);
}
