import { supabase } from './supabase';
import type { TrainingPlanDay, ActivityGoal, QuestionnairePreferences } from '../lib/types';
import { SESSION_DURATIONS, getActivityByKey } from '../lib/constants';

// ============================================================
// Fetch the current week's training plan for a user
// ============================================================
export async function getWeeklyPlan(userId: string): Promise<TrainingPlanDay[]> {
  const weekStart = getWeekStartDate();

  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('day_of_week');

  if (error) throw error;
  return (data ?? []) as TrainingPlanDay[];
}

// ============================================================
// Update a single training plan day
// ============================================================
export async function updateTrainingPlanDay(
  id: string,
  updates: Partial<Pick<TrainingPlanDay, 'activity_type' | 'label' | 'target_distance' | 'target_duration'>>
): Promise<TrainingPlanDay> {
  const { data, error } = await supabase
    .from('training_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TrainingPlanDay;
}

// ============================================================
// Generate a weekly plan based on user's goal
// ============================================================
export async function generateAndSavePlan(
  userId: string,
  goal: ActivityGoal | null,
  preferences?: QuestionnairePreferences | null,
  weeklyKmTarget?: number | null,
): Promise<TrainingPlanDay[]> {
  const weekStart = getWeekStartDate();

  // Check if plan already exists for this week
  const { data: existing } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .limit(1);

  if (existing && existing.length > 0) {
    // Plan already exists, return it
    return getWeeklyPlan(userId);
  }

  // Generate the plan — use personalized if preferences available, otherwise fallback to goal-based
  const plan = (preferences && preferences.available_days.length > 0)
    ? generatePersonalizedPlan(preferences)
    : generateWeeklyPlan(goal, weeklyKmTarget);

  // Save to database
  const rows = plan.map((day) => ({
    user_id: userId,
    week_start: weekStart,
    day_of_week: day.day_of_week,
    activity_type: day.activity_type,
    label: day.label,
    target_distance: day.target_distance,
    target_duration: day.target_duration,
  }));

  const { data, error } = await supabase
    .from('training_plans')
    .insert(rows)
    .select()
    .order('day_of_week');

  if (error) throw error;
  return (data ?? []) as TrainingPlanDay[];
}

// ============================================================
// Generate a weekly plan structure (no DB)
// ============================================================
export function generateWeeklyPlan(goal: ActivityGoal | null, weeklyKmTarget?: number | null): Omit<TrainingPlanDay, 'id' | 'user_id' | 'week_start' | 'is_completed'>[] {
  switch (goal) {
    case 'run_weekly_km':
      return generateRunWeeklyKmPlan(weeklyKmTarget ?? 10);
    case 'cycle_weekly_km':
      return generateCycleWeeklyKmPlan(weeklyKmTarget ?? 20);
    case 'lose_weight':
      return generateLoseWeightPlan();
    case 'gain_muscle':
      return generateGainMusclePlan();
    case 'improve_endurance':
      return generateEndurancePlan();
    case 'train_for_race':
      return generateRaceTrainingPlan();
    case 'train_with_friends':
      return generateSocialPlan();
    case 'improve_flexibility':
      return generateFlexibilityPlan();
    case 'improve_technique':
      return generateTechniquePlan();
    case 'explore_outdoors':
      return generateOutdoorsPlan();
    case 'have_fun':
      return generateFunPlan();
    case 'stay_active':
    default:
      return generateStayActivePlan();
  }
}

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  // Monday = 0 for our system
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// ============================================================
// Personalized plan generator based on questionnaire preferences
// ============================================================
export function generatePersonalizedPlan(prefs: QuestionnairePreferences): Omit<TrainingPlanDay, 'id' | 'user_id' | 'week_start' | 'is_completed'>[] {
  const { available_days: availableDays, preferred_activities: activities, fitness_level: fitnessLevel } = prefs;
  const durationMinutes = SESSION_DURATIONS.find((d) => d.key === prefs.session_duration)?.minutes ?? 45;
  const targetDuration = durationMinutes * 60; // convert to seconds

  // Distance table by activity and fitness level (in km) — only for distance_based activities
  const DISTANCE_MAP: Record<string, Record<string, number>> = {
    beginner:  {
      run: 3, trail_run: 2, stroll: 1.5, walk: 2, wheelchair: 1.5,
      cycle: 8, ebike: 10, mtb: 5,
    },
    intermediate: {
      run: 5, trail_run: 4, stroll: 3, walk: 3, wheelchair: 3,
      cycle: 15, ebike: 18, mtb: 10,
    },
    advanced: {
      run: 8, trail_run: 7, stroll: 5, walk: 5, wheelchair: 5,
      cycle: 25, ebike: 30, mtb: 18,
    },
    pro: {
      run: 12, trail_run: 10, stroll: 8, walk: 8, wheelchair: 8,
      cycle: 40, ebike: 50, mtb: 30,
    },
  };

  const level = fitnessLevel ?? 'intermediate';
  const distances = DISTANCE_MAP[level] ?? DISTANCE_MAP.intermediate;

  // Labels by activity type
  const LABELS: Record<string, string> = {
    run: 'Corrida',
    trail_run: 'Corrida em Trilho',
    stroll: 'Passeio',
    walk: 'Caminhada',
    wheelchair: 'Cadeira de rodas',
    cycle: 'Bicicleta',
    ebike: 'Bicicleta elétrica',
    mtb: 'Bicicleta de montanha',
    weight_training: 'Treino com peso',
    workout: 'Treino',
    hiit: 'HIIT',
    crossfit: 'Crossfit',
    physiotherapy: 'Fisioterapia',
    tennis: 'Ténis',
    padel: 'Padel',
    squash: 'Squash',
    badminton: 'Badminton',
    table_tennis: 'Ténis de Mesa',
    swimming: 'Natação',
    surf: 'Surf',
    stand_up_paddle: 'Remo em pé',
    kayak: 'Caiaque',
    rowing: 'Remo',
    canoeing: 'Canoagem',
    sailing: 'Vela',
    ice_skating: 'Patinagem no gelo',
    snowboard: 'Snowboard',
    alpine_skiing: 'Esqui Alpino',
    football: 'Futebol',
    basketball: 'Basquetebol',
    volleyball: 'Voleibol',
    futsal: 'Futsal',
    yoga: 'Ioga',
    dance: 'Dança',
    skateboard: 'Skate',
    pilates: 'Pilates',
  };

  let activityIndex = 0;

  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    if (!availableDays.includes(dayOfWeek)) {
      return {
        day_of_week: dayOfWeek,
        activity_type: 'rest' as const,
        label: 'Descanso',
        target_distance: null,
        target_duration: null,
      };
    }

    // Round-robin through preferred activities
    const activity = activities[activityIndex % activities.length];
    activityIndex++;

    const isDistanceBased = getActivityByKey(activity)?.distance_based ?? false;
    return {
      day_of_week: dayOfWeek,
      activity_type: activity as TrainingPlanDay['activity_type'],
      label: LABELS[activity] ?? activity,
      target_distance: isDistanceBased ? (distances[activity] ?? 3) : null,
      target_duration: targetDuration,
    };
  });
}

// stay_active: 3 activity days + 4 rest
function generateStayActivePlan() {
  return [
    { day_of_week: 0, activity_type: 'walk' as const, label: 'Caminhada leve', target_distance: 3, target_duration: null },
    { day_of_week: 1, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 2, activity_type: 'walk' as const, label: 'Caminhada', target_distance: 4, target_duration: null },
    { day_of_week: 3, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 4, activity_type: 'run' as const, label: 'Corrida leve', target_distance: 3, target_duration: null },
    { day_of_week: 5, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 6, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
  ];
}

// run_weekly_km: progressive run plan scaled by weekly target
function generateRunWeeklyKmPlan(weeklyTarget: number) {
  const short = Math.round(weeklyTarget * 0.2);
  const medium = Math.round(weeklyTarget * 0.25);
  const midLong = Math.round(weeklyTarget * 0.3);
  const long = Math.round(weeklyTarget * 0.35);
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'run' as const, label: 'Intervalos', target_distance: short, target_duration: null },
    { day_of_week: 2, activity_type: 'run' as const, label: 'Fácil', target_distance: medium, target_duration: null },
    { day_of_week: 3, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 4, activity_type: 'run' as const, label: 'Ritmo', target_distance: midLong, target_duration: null },
    { day_of_week: 5, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 6, activity_type: 'run' as const, label: 'Longo', target_distance: long, target_duration: null },
  ];
}

// cycle_weekly_km: progressive cycling plan scaled by weekly target
function generateCycleWeeklyKmPlan(weeklyTarget: number) {
  const short = Math.round(weeklyTarget * 0.2);
  const medium = Math.round(weeklyTarget * 0.25);
  const midLong = Math.round(weeklyTarget * 0.3);
  const long = Math.round(weeklyTarget * 0.35);
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'cycle' as const, label: 'Bike leve', target_distance: short, target_duration: null },
    { day_of_week: 2, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 3, activity_type: 'cycle' as const, label: 'Bike moderada', target_distance: medium, target_duration: null },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'cycle' as const, label: 'Bike ritmo', target_distance: midLong, target_duration: null },
    { day_of_week: 6, activity_type: 'cycle' as const, label: 'Bike longa', target_distance: long, target_duration: null },
  ];
}

// gain_muscle: strength-focused plan
function generateGainMusclePlan() {
  return [
    { day_of_week: 0, activity_type: 'weight_training' as const, label: 'Peso corpo inteiro', target_distance: null, target_duration: 2700 },
    { day_of_week: 1, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 2, activity_type: 'hiit' as const, label: 'HIIT', target_distance: null, target_duration: 1800 },
    { day_of_week: 3, activity_type: 'weight_training' as const, label: 'Peso superior', target_distance: null, target_duration: 2700 },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'crossfit' as const, label: 'Crossfit', target_distance: null, target_duration: 2700 },
    { day_of_week: 6, activity_type: 'weight_training' as const, label: 'Peso inferior', target_distance: null, target_duration: 2700 },
  ];
}

// improve_endurance: mixed cardio plan
function generateEndurancePlan() {
  return [
    { day_of_week: 0, activity_type: 'run' as const, label: 'Corrida leve', target_distance: 5, target_duration: null },
    { day_of_week: 1, activity_type: 'cycle' as const, label: 'Bicicleta', target_distance: 15, target_duration: null },
    { day_of_week: 2, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 3, activity_type: 'swimming' as const, label: 'Natação', target_distance: null, target_duration: 2700 },
    { day_of_week: 4, activity_type: 'run' as const, label: 'Corrida longa', target_distance: 8, target_duration: null },
    { day_of_week: 5, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 6, activity_type: 'cycle' as const, label: 'Bike longa', target_distance: 25, target_duration: null },
  ];
}

// train_for_race: progressive run/cycle plan
function generateRaceTrainingPlan() {
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'run' as const, label: 'Intervalos', target_distance: 6, target_duration: null },
    { day_of_week: 2, activity_type: 'cycle' as const, label: 'Bike recuperação', target_distance: 10, target_duration: null },
    { day_of_week: 3, activity_type: 'run' as const, label: 'Corrida ritmo', target_distance: 8, target_duration: null },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'run' as const, label: 'Corrida leve', target_distance: 5, target_duration: null },
    { day_of_week: 6, activity_type: 'run' as const, label: 'Longo', target_distance: 14, target_duration: null },
  ];
}

// improve_flexibility: yoga + pilates + rest
function generateFlexibilityPlan() {
  return [
    { day_of_week: 0, activity_type: 'yoga' as const, label: 'Ioga', target_distance: null, target_duration: 2700 },
    { day_of_week: 1, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 2, activity_type: 'pilates' as const, label: 'Pilates', target_distance: null, target_duration: 2700 },
    { day_of_week: 3, activity_type: 'yoga' as const, label: 'Ioga', target_distance: null, target_duration: 2700 },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'pilates' as const, label: 'Pilates', target_distance: null, target_duration: 2700 },
    { day_of_week: 6, activity_type: 'yoga' as const, label: 'Ioga suave', target_distance: null, target_duration: 1800 },
  ];
}

// improve_technique: racquet sports + swim drills
function generateTechniquePlan() {
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'tennis' as const, label: 'Ténis', target_distance: null, target_duration: 3600 },
    { day_of_week: 2, activity_type: 'swimming' as const, label: 'Natação técnica', target_distance: null, target_duration: 2700 },
    { day_of_week: 3, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 4, activity_type: 'padel' as const, label: 'Padel', target_distance: null, target_duration: 3600 },
    { day_of_week: 5, activity_type: 'swimming' as const, label: 'Natação', target_distance: null, target_duration: 2700 },
    { day_of_week: 6, activity_type: 'squash' as const, label: 'Squash', target_distance: null, target_duration: 2700 },
  ];
}

// explore_outdoors: trail_run, mtb, kayak, walk
function generateOutdoorsPlan() {
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'trail_run' as const, label: 'Trilho', target_distance: 5, target_duration: null },
    { day_of_week: 2, activity_type: 'walk' as const, label: 'Caminhada', target_distance: 4, target_duration: null },
    { day_of_week: 3, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 4, activity_type: 'mtb' as const, label: 'BTT', target_distance: 12, target_duration: null },
    { day_of_week: 5, activity_type: 'kayak' as const, label: 'Caiaque', target_distance: null, target_duration: 3600 },
    { day_of_week: 6, activity_type: 'walk' as const, label: 'Caminhada longa', target_distance: 8, target_duration: null },
  ];
}

// have_fun: varied, light plan with diverse activities
function generateFunPlan() {
  return [
    { day_of_week: 0, activity_type: 'dance' as const, label: 'Dança', target_distance: null, target_duration: 2700 },
    { day_of_week: 1, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 2, activity_type: 'walk' as const, label: 'Caminhada', target_distance: 3, target_duration: null },
    { day_of_week: 3, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 4, activity_type: 'skateboard' as const, label: 'Skate', target_distance: null, target_duration: 2700 },
    { day_of_week: 5, activity_type: 'football' as const, label: 'Futebol', target_distance: null, target_duration: 3600 },
    { day_of_week: 6, activity_type: 'cycle' as const, label: 'Passeio bike', target_distance: 8, target_duration: null },
  ];
}

// lose_weight: 5-6 days moderate activity
function generateLoseWeightPlan() {
  return [
    { day_of_week: 0, activity_type: 'walk' as const, label: 'Caminhada rápida', target_distance: 5, target_duration: null },
    { day_of_week: 1, activity_type: 'run' as const, label: 'Corrida moderada', target_distance: 4, target_duration: null },
    { day_of_week: 2, activity_type: 'cycle' as const, label: 'Bicicleta', target_distance: 12, target_duration: null },
    { day_of_week: 3, activity_type: 'walk' as const, label: 'Caminhada', target_distance: 4, target_duration: null },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'run' as const, label: 'Corrida leve', target_distance: 3, target_duration: null },
    { day_of_week: 6, activity_type: 'walk' as const, label: 'Caminhada longa', target_distance: 8, target_duration: null },
  ];
}

// train_with_friends: social plan
function generateSocialPlan() {
  return [
    { day_of_week: 0, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 1, activity_type: 'run' as const, label: 'Corrida social', target_distance: 5, target_duration: null },
    { day_of_week: 2, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 3, activity_type: 'walk' as const, label: 'Caminhada', target_distance: 3, target_duration: null },
    { day_of_week: 4, activity_type: 'rest' as const, label: 'Descanso', target_distance: null, target_duration: null },
    { day_of_week: 5, activity_type: 'run' as const, label: 'Treino grupo', target_distance: 8, target_duration: null },
    { day_of_week: 6, activity_type: 'cycle' as const, label: 'Passeio bike', target_distance: 15, target_duration: null },
  ];
}
