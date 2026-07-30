import type { UnitSystem } from '../lib/types';
import { formatDistanceImperial } from './convertUnits';

/**
 * Format distance in meters to a human-readable string,
 * respecting the unit system (defaults to metric for backward compat).
 */
export function formatDistance(meters: number, unitSystem?: UnitSystem): string {
  return formatDistanceImperial(meters, unitSystem);
}
