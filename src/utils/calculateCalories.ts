import type { Activity } from '../lib/types';

/**
 * Returns MET (Metabolic Equivalent of Task) for a given activity type and pace/speed.
 * Reference: 2011 Compendium of Physical Activities
 */
function getMET(activity: Activity): number {
  const durationHours = activity.duration / 3600;
  if (durationHours <= 0) return 7; // fallback

  const speedKmh = (activity.distance / 1000) / durationHours; // km/h
  const paceMinPerKm = activity.avg_pace ? activity.avg_pace / 60 : 60 / (speedKmh || 0.001);

  switch (activity.type) {
    case 'run':
    case 'trail_run': {
      // MET based on running pace
      if (paceMinPerKm < 4) return 14;
      if (paceMinPerKm < 5) return 13;
      if (paceMinPerKm < 6) return 11;
      if (paceMinPerKm < 7) return 9.8;
      if (paceMinPerKm < 8) return 8.3;
      return 7;
    }
    case 'walk': {
      // Walking MET based on speed
      if (speedKmh < 3.2) return 2.5;
      if (speedKmh < 5.6) return 3.5;
      if (speedKmh < 6.4) return 4.3;
      return 5;
    }
    case 'cycle': {
      // Cycling MET based on speed
      if (speedKmh < 16) return 4;
      if (speedKmh < 19) return 6;
      if (speedKmh < 22) return 8;
      if (speedKmh < 26) return 10;
      if (speedKmh < 30) return 12;
      return 14;
    }
    default:
      return 7;
  }
}

/**
 * Calculate calories burned for a single activity.
 * Formula: MET × weight(kg) × duration(hours)
 */
export function calculateActivityCalories(activity: Activity, weightKg: number): number {
  const met = getMET(activity);
  const durationHours = activity.duration / 3600;
  return met * weightKg * durationHours;
}

/**
 * Calculate total calories burned across all activities in a given month.
 * @param activities - All activities
 * @param weightKg - User's weight in kg (defaults to 70)
 * @param monthYear - ISO string prefix "YYYY-MM" (defaults to current month)
 */
export function calculateMonthlyCalories(
  activities: Activity[],
  weightKg: number | undefined | null,
  monthYear?: string,
): number {
  const weight = weightKg ?? 70;
  const target = monthYear ?? new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const monthlyActivities = activities.filter(
    (a) => a.start_time.slice(0, 7) === target,
  );

  return monthlyActivities.reduce(
    (total, a) => total + calculateActivityCalories(a, weight),
    0,
  );
}
