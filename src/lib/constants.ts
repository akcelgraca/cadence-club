export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'your-mapbox-token';
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || 'your-posthog-key';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

/**
 * Diz alto quando a configuração não chegou ao build.
 *
 * Sem isto, o sintoma é `UnknownHostException: unable to resolve` ao primeiro
 * pedido — o que não diz a ninguém que faltou uma variável de ambiente. Foi o
 * que aconteceu no primeiro build Android com push: o `.env` é gitignorado,
 * portanto não sobe para o EAS, e a app saiu a apontar para
 * `https://YOUR_PROJECT.supabase.co`.
 *
 * `npm run env:check` verifica isto antes de se gastar um build.
 */
if (__DEV__ && process.env.NODE_ENV !== 'test') {
  const emFalta = Object.entries({
    EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    EXPO_PUBLIC_MAPBOX_TOKEN: MAPBOX_ACCESS_TOKEN,
  })
    .filter(([, v]) => v.startsWith('your-') || v.includes('YOUR_PROJECT'))
    .map(([k]) => k);

  if (emFalta.length > 0) {
    console.warn(
      `[config] a usar valores de exemplo: ${emFalta.join(', ')}. ` +
        'A app vai falhar com UnknownHostException ao primeiro pedido. ' +
        'Corre `npm run env:check`.',
    );
  }
}

// Activity
export const GPS_INTERVAL = 5000; // 5 segundos entre leituras GPS
export const GPS_DISTANCE_THRESHOLD = 5; // 5 metros de threshold
export const COUNTDOWN_SECONDS = 3;
export const PACE_WINDOW_SECONDS = 30; // janela média móvel para pace
export const MIN_ACTIVITY_DURATION = 60; // 1 minuto mínimo
export const MIN_ACTIVITY_DISTANCE = 100; // 100 metros mínimo
export const AUTO_PAUSE_SPEED_THRESHOLD = 0.8; // m/s abaixo do qual se considera parado
export const AUTO_PAUSE_DELAY_MS = 6000; // 6 segundos parado para auto-pausar

// Pagination
export const FEED_PAGE_SIZE = 15;
export const COMMENTS_PAGE_SIZE = 20;

// Streaks
export const STREAK_DAY_WINDOW = 36; // horas para considerar "dia seguinte"

// Badges
export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;

import type { ActivityType, ActivityCategory, ActivityDefinition } from './types';

// ============================================================
// Activity Categories & Activities — single source of truth
// ============================================================

export interface ActivityCategoryDef {
  key: ActivityCategory;
  icon: string;
  i18n_key: string;
  activities: ActivityDefinition[];
}

export const ACTIVITY_CATEGORIES: ActivityCategoryDef[] = [
  {
    key: 'foot',
    icon: 'fitness',
    i18n_key: 'activity_category_foot',
    activities: [
      { key: 'run', category: 'foot', icon: 'fitness', i18n_key: 'activity_run', description_key: 'activity_run_desc', distance_based: true },
      { key: 'trail_run', category: 'foot', icon: 'terrain', i18n_key: 'activity_trail_run', description_key: 'activity_trail_run_desc', distance_based: true },
      { key: 'stroll', category: 'foot', icon: 'walk-outline', i18n_key: 'activity_stroll', description_key: 'activity_stroll_desc', distance_based: true },
      { key: 'walk', category: 'foot', icon: 'walk', i18n_key: 'activity_walk', description_key: 'activity_walk_desc', distance_based: true },
      { key: 'wheelchair', category: 'foot', icon: 'accessible', i18n_key: 'activity_wheelchair', description_key: 'activity_wheelchair_desc', distance_based: true },
    ],
  },
  {
    key: 'cycling',
    icon: 'bicycle',
    i18n_key: 'activity_category_cycling',
    activities: [
      { key: 'cycle', category: 'cycling', icon: 'bicycle', i18n_key: 'activity_cycle', description_key: 'activity_cycle_desc', distance_based: true },
      { key: 'ebike', category: 'cycling', icon: 'flash', i18n_key: 'activity_ebike', description_key: 'activity_ebike_desc', distance_based: true },
      { key: 'mtb', category: 'cycling', icon: 'trail-sign', i18n_key: 'activity_mtb', description_key: 'activity_mtb_desc', distance_based: true },
    ],
  },
  {
    key: 'strength',
    icon: 'barbell',
    i18n_key: 'activity_category_strength',
    activities: [
      { key: 'weight_training', category: 'strength', icon: 'barbell', i18n_key: 'activity_weight_training', description_key: 'activity_weight_training_desc', distance_based: false },
      { key: 'workout', category: 'strength', icon: 'fitness-outline', i18n_key: 'activity_workout', description_key: 'activity_workout_desc', distance_based: false },
      { key: 'hiit', category: 'strength', icon: 'timer', i18n_key: 'activity_hiit', description_key: 'activity_hiit_desc', distance_based: false },
      { key: 'crossfit', category: 'strength', icon: 'barbell-outline', i18n_key: 'activity_crossfit', description_key: 'activity_crossfit_desc', distance_based: false },
      { key: 'physiotherapy', category: 'strength', icon: 'medkit', i18n_key: 'activity_physiotherapy', description_key: 'activity_physiotherapy_desc', distance_based: false },
    ],
  },
  {
    key: 'racquet',
    icon: 'tennisball',
    i18n_key: 'activity_category_racquet',
    activities: [
      { key: 'tennis', category: 'racquet', icon: 'tennisball', i18n_key: 'activity_tennis', description_key: 'activity_tennis_desc', distance_based: false },
      { key: 'padel', category: 'racquet', icon: 'tennisball-outline', i18n_key: 'activity_padel', description_key: 'activity_padel_desc', distance_based: false },
      { key: 'squash', category: 'racquet', icon: 'radio', i18n_key: 'activity_squash', description_key: 'activity_squash_desc', distance_based: false },
      { key: 'badminton', category: 'racquet', icon: 'git-network', i18n_key: 'activity_badminton', description_key: 'activity_badminton_desc', distance_based: false },
      { key: 'table_tennis', category: 'racquet', icon: 'disc', i18n_key: 'activity_table_tennis', description_key: 'activity_table_tennis_desc', distance_based: false },
    ],
  },
  {
    key: 'water',
    icon: 'water',
    i18n_key: 'activity_category_water',
    activities: [
      { key: 'swimming', category: 'water', icon: 'water', i18n_key: 'activity_swimming', description_key: 'activity_swimming_desc', distance_based: false },
      { key: 'surf', category: 'water', icon: 'water-outline', i18n_key: 'activity_surf', description_key: 'activity_surf_desc', distance_based: false },
      { key: 'stand_up_paddle', category: 'water', icon: 'boat', i18n_key: 'activity_stand_up_paddle', description_key: 'activity_stand_up_paddle_desc', distance_based: false },
      { key: 'kayak', category: 'water', icon: 'boat-outline', i18n_key: 'activity_kayak', description_key: 'activity_kayak_desc', distance_based: false },
      { key: 'rowing', category: 'water', icon: 'boat', i18n_key: 'activity_rowing', description_key: 'activity_rowing_desc', distance_based: false },
      { key: 'canoeing', category: 'water', icon: 'boat-outline', i18n_key: 'activity_canoeing', description_key: 'activity_canoeing_desc', distance_based: false },
      { key: 'sailing', category: 'water', icon: 'boat', i18n_key: 'activity_sailing', description_key: 'activity_sailing_desc', distance_based: false },
    ],
  },
  {
    key: 'winter',
    icon: 'snow',
    i18n_key: 'activity_category_winter',
    activities: [
      { key: 'ice_skating', category: 'winter', icon: 'snow-outline', i18n_key: 'activity_ice_skating', description_key: 'activity_ice_skating_desc', distance_based: false },
      { key: 'snowboard', category: 'winter', icon: 'snow', i18n_key: 'activity_snowboard', description_key: 'activity_snowboard_desc', distance_based: false },
      { key: 'alpine_skiing', category: 'winter', icon: 'snow-outline', i18n_key: 'activity_alpine_skiing', description_key: 'activity_alpine_skiing_desc', distance_based: false },
    ],
  },
  {
    key: 'team',
    icon: 'people',
    i18n_key: 'activity_category_team',
    activities: [
      { key: 'football', category: 'team', icon: 'football', i18n_key: 'activity_football', description_key: 'activity_football_desc', distance_based: false },
      { key: 'basketball', category: 'team', icon: 'basketball', i18n_key: 'activity_basketball', description_key: 'activity_basketball_desc', distance_based: false },
      { key: 'volleyball', category: 'team', icon: 'football-outline', i18n_key: 'activity_volleyball', description_key: 'activity_volleyball_desc', distance_based: false },
      { key: 'futsal', category: 'team', icon: 'football', i18n_key: 'activity_futsal', description_key: 'activity_futsal_desc', distance_based: false },
    ],
  },
  {
    key: 'other',
    icon: 'apps',
    i18n_key: 'activity_category_other',
    activities: [
      { key: 'yoga', category: 'other', icon: 'body', i18n_key: 'activity_yoga', description_key: 'activity_yoga_desc', distance_based: false },
      { key: 'dance', category: 'other', icon: 'musical-notes', i18n_key: 'activity_dance', description_key: 'activity_dance_desc', distance_based: false },
      { key: 'skateboard', category: 'other', icon: 'cube', i18n_key: 'activity_skateboard', description_key: 'activity_skateboard_desc', distance_based: false },
      { key: 'pilates', category: 'other', icon: 'body-outline', i18n_key: 'activity_pilates', description_key: 'activity_pilates_desc', distance_based: false },
    ],
  },
];

// Derived flat arrays
export const ALL_ACTIVITY_TYPES: ActivityType[] = ACTIVITY_CATEGORIES.flatMap(
  (cat) => cat.activities.map((a) => a.key),
);

export const DISTANCE_BASED_ACTIVITIES: ActivityType[] = ACTIVITY_CATEGORIES.flatMap(
  (cat) => cat.activities.filter((a) => a.distance_based).map((a) => a.key),
);

export function getActivityByKey(key: string): ActivityDefinition | undefined {
  for (const cat of ACTIVITY_CATEGORIES) {
    const found = cat.activities.find((a) => a.key === key);
    if (found) return found;
  }
  return undefined;
}

// Deprecated — kept for backward compatibility with existing code
// Prefer using ACTIVITY_CATEGORIES or getActivityByKey()
export const ACTIVITY_TYPES = ALL_ACTIVITY_TYPES.map((key) => {
  const def = getActivityByKey(key)!;
  return {
    key: def.key,
    label: def.key, // label is now resolved via i18n
    icon: def.icon,
    activityType: (def.key === 'trail_run' ? 'run' : def.category === 'cycling' ? 'cycle' : def.category === 'foot' ? def.key : def.key) as string,
    runType: (def.key === 'trail_run' ? 'trail' : def.key === 'run' ? 'road' : undefined) as string | undefined,
  };
});

export const ACTIVITY_GOALS = [
  { key: 'stay_active', i18n_key: 'goal_stay_active', icon: 'fitness' },
  { key: 'run_weekly_km', i18n_key: 'goal_run_weekly_km', icon: 'fitness' },
  { key: 'cycle_weekly_km', i18n_key: 'goal_cycle_weekly_km', icon: 'bicycle' },
  { key: 'lose_weight', i18n_key: 'goal_lose_weight', icon: 'scale' },
  { key: 'gain_muscle', i18n_key: 'goal_gain_muscle', icon: 'barbell' },
  { key: 'improve_endurance', i18n_key: 'goal_improve_endurance', icon: 'trending-up' },
  { key: 'train_for_race', i18n_key: 'goal_train_for_race', icon: 'flag' },
  { key: 'train_with_friends', i18n_key: 'goal_train_with_friends', icon: 'people' },
  { key: 'improve_flexibility', i18n_key: 'goal_improve_flexibility', icon: 'body' },
  { key: 'improve_technique', i18n_key: 'goal_improve_technique', icon: 'tennisball' },
  { key: 'explore_outdoors', i18n_key: 'goal_explore_outdoors', icon: 'compass' },
  { key: 'have_fun', i18n_key: 'goal_have_fun', icon: 'happy' },
] as const;

// Main sports — all activities derived from ACTIVITY_CATEGORIES + multi option
export const MAIN_SPORTS: { key: MainSport; icon: string; i18n_key: string }[] = [
  ...ACTIVITY_CATEGORIES.flatMap((cat) =>
    cat.activities.map((a) => ({
      key: a.key,
      icon: a.icon,
      i18n_key: a.i18n_key,
    })),
  ),
  { key: 'multi', icon: 'ribbon', i18n_key: 'activity_multi' },
];

export const GENDERS = [
  { key: 'male', i18n_key: 'gender_male' },
  { key: 'female', i18n_key: 'gender_female' },
  { key: 'other', i18n_key: 'gender_other' },
  { key: 'prefer_not_to_say', i18n_key: 'gender_prefer_not_to_say' },
] as const;

/**
 * Países.
 *
 * `value` é o que fica guardado em `profiles.country` — mantém-se o nome
 * português para não obrigar a migrar os perfis existentes. `i18n_key` é só
 * para mostrar. A ordenação alfabética é feita no ecrã, sobre o texto já
 * traduzido, senão a lista aparecia por ordem portuguesa a quem lê inglês.
 */
export const COUNTRIES: { value: string; i18n_key: string }[] = [
  { value: 'África do Sul', i18n_key: 'country_south_africa' },
  { value: 'Alemanha', i18n_key: 'country_germany' },
  { value: 'Angola', i18n_key: 'country_angola' },
  { value: 'Argentina', i18n_key: 'country_argentina' },
  { value: 'Austrália', i18n_key: 'country_australia' },
  { value: 'Áustria', i18n_key: 'country_austria' },
  { value: 'Bélgica', i18n_key: 'country_belgium' },
  { value: 'Brasil', i18n_key: 'country_brazil' },
  { value: 'Bulgária', i18n_key: 'country_bulgaria' },
  { value: 'Cabo Verde', i18n_key: 'country_cape_verde' },
  { value: 'Canadá', i18n_key: 'country_canada' },
  { value: 'Chile', i18n_key: 'country_chile' },
  { value: 'China', i18n_key: 'country_china' },
  { value: 'Colômbia', i18n_key: 'country_colombia' },
  { value: 'Coreia do Sul', i18n_key: 'country_south_korea' },
  { value: 'Dinamarca', i18n_key: 'country_denmark' },
  { value: 'Egito', i18n_key: 'country_egypt' },
  { value: 'Emirados Árabes Unidos', i18n_key: 'country_uae' },
  { value: 'Eslováquia', i18n_key: 'country_slovakia' },
  { value: 'Espanha', i18n_key: 'country_spain' },
  { value: 'Estados Unidos', i18n_key: 'country_united_states' },
  { value: 'Finlândia', i18n_key: 'country_finland' },
  { value: 'França', i18n_key: 'country_france' },
  { value: 'Grécia', i18n_key: 'country_greece' },
  { value: 'Guiné-Bissau', i18n_key: 'country_guinea_bissau' },
  { value: 'Índia', i18n_key: 'country_india' },
  { value: 'Irlanda', i18n_key: 'country_ireland' },
  { value: 'Islândia', i18n_key: 'country_iceland' },
  { value: 'Itália', i18n_key: 'country_italy' },
  { value: 'Japão', i18n_key: 'country_japan' },
  { value: 'Luxemburgo', i18n_key: 'country_luxembourg' },
  { value: 'Marrocos', i18n_key: 'country_morocco' },
  { value: 'México', i18n_key: 'country_mexico' },
  { value: 'Moçambique', i18n_key: 'country_mozambique' },
  { value: 'Noruega', i18n_key: 'country_norway' },
  { value: 'Nova Zelândia', i18n_key: 'country_new_zealand' },
  { value: 'Países Baixos', i18n_key: 'country_netherlands' },
  { value: 'Peru', i18n_key: 'country_peru' },
  { value: 'Polónia', i18n_key: 'country_poland' },
  { value: 'Portugal', i18n_key: 'country_portugal' },
  { value: 'Reino Unido', i18n_key: 'country_united_kingdom' },
  { value: 'Roménia', i18n_key: 'country_romania' },
  { value: 'Rússia', i18n_key: 'country_russia' },
  { value: 'São Tomé e Príncipe', i18n_key: 'country_sao_tome_principe' },
  { value: 'Singapura', i18n_key: 'country_singapore' },
  { value: 'Suécia', i18n_key: 'country_sweden' },
  { value: 'Suíça', i18n_key: 'country_switzerland' },
  { value: 'Tailândia', i18n_key: 'country_thailand' },
  { value: 'Timor-Leste', i18n_key: 'country_timor_leste' },
  { value: 'Turquia', i18n_key: 'country_turkey' },
  { value: 'Ucrânia', i18n_key: 'country_ukraine' },
  { value: 'Venezuela', i18n_key: 'country_venezuela' },
];

/** Chave de tradução de um país já guardado. */
export function getCountryKey(value: string): string | undefined {
  return COUNTRIES.find((c) => c.value === value)?.i18n_key;
}

export const EQUIPMENT_TYPES = [
  { key: 'bike', i18n_key: 'equipment_type_bike', icon: 'bicycle' },
  { key: 'shoes', i18n_key: 'equipment_type_shoes', icon: 'footsteps' },
  { key: 'other', i18n_key: 'equipment_type_other', icon: 'cube' },
] as const;

import type { SessionDuration, FitnessLevel, PreferredTime, TrainingFocus, MainSport } from './types';

/** Meses abreviados, por índice (0 = janeiro). */
export const MONTH_SHORT_KEYS = [
  'month_short_jan', 'month_short_feb', 'month_short_mar', 'month_short_apr',
  'month_short_may', 'month_short_jun', 'month_short_jul', 'month_short_aug',
  'month_short_sep', 'month_short_oct', 'month_short_nov', 'month_short_dec',
] as const;

// Questionnaire
export const DAYS_OF_WEEK = [
  { key: 0, short_key: 'questionnaire_days_mon', full_key: 'training_day_full_mon' },
  { key: 1, short_key: 'questionnaire_days_tue', full_key: 'training_day_full_tue' },
  { key: 2, short_key: 'questionnaire_days_wed', full_key: 'training_day_full_wed' },
  { key: 3, short_key: 'questionnaire_days_thu', full_key: 'training_day_full_thu' },
  { key: 4, short_key: 'questionnaire_days_fri', full_key: 'training_day_full_fri' },
  { key: 5, short_key: 'questionnaire_days_sat', full_key: 'training_day_full_sat' },
  { key: 6, short_key: 'questionnaire_days_sun', full_key: 'training_day_full_sun' },
] as const;

export const SESSION_DURATIONS: { key: SessionDuration; i18n_key: string; minutes: number }[] = [
  { key: 'short', i18n_key: 'questionnaire_duration_short', minutes: 25 },
  { key: 'medium', i18n_key: 'questionnaire_duration_medium', minutes: 45 },
  { key: 'long', i18n_key: 'questionnaire_duration_long', minutes: 75 },
];

export const FITNESS_LEVELS: { key: FitnessLevel; i18n_key: string; description_key: string }[] = [
  { key: 'beginner', i18n_key: 'questionnaire_fitness_beginner', description_key: 'questionnaire_fitness_beginner_desc' },
  { key: 'intermediate', i18n_key: 'questionnaire_fitness_intermediate', description_key: 'questionnaire_fitness_intermediate_desc' },
  { key: 'advanced', i18n_key: 'questionnaire_fitness_advanced', description_key: 'questionnaire_fitness_advanced_desc' },
  { key: 'pro', i18n_key: 'questionnaire_fitness_pro', description_key: 'questionnaire_fitness_pro_desc' },
];

export const WEEKLY_FREQUENCIES = [
  { key: 2, i18n_key: 'questionnaire_frequency_2_3' },
  { key: 3, i18n_key: 'questionnaire_frequency_3_4' },
  { key: 4, i18n_key: 'questionnaire_frequency_4_5' },
  { key: 5, i18n_key: 'questionnaire_frequency_5_plus' },
] as const;

export const PREFERRED_TIMES: { key: PreferredTime; i18n_key: string; icon: string }[] = [
  { key: 'morning', i18n_key: 'questionnaire_time_morning', icon: 'sunny-outline' },
  { key: 'afternoon', i18n_key: 'questionnaire_time_afternoon', icon: 'partly-sunny-outline' },
  { key: 'evening', i18n_key: 'questionnaire_time_evening', icon: 'moon-outline' },
  { key: 'flexible', i18n_key: 'questionnaire_time_flexible', icon: 'time-outline' },
];

export const TRAINING_FOCUSES: { key: TrainingFocus; i18n_key: string; icon: string }[] = [
  { key: 'endurance', i18n_key: 'questionnaire_focus_endurance', icon: 'trending-up-outline' },
  { key: 'speed', i18n_key: 'questionnaire_focus_speed', icon: 'flash-outline' },
  { key: 'weight_loss', i18n_key: 'questionnaire_focus_weight_loss', icon: 'fitness-outline' },
  { key: 'general_health', i18n_key: 'questionnaire_focus_health', icon: 'heart-outline' },
  { key: 'race_prep', i18n_key: 'questionnaire_focus_race', icon: 'flag-outline' },
  { key: 'strength', i18n_key: 'questionnaire_focus_strength', icon: 'barbell-outline' },
  { key: 'flexibility', i18n_key: 'questionnaire_focus_flexibility', icon: 'body-outline' },
  { key: 'technique', i18n_key: 'questionnaire_focus_technique', icon: 'tennisball-outline' },
  { key: 'outdoors', i18n_key: 'questionnaire_focus_outdoors', icon: 'compass-outline' },
  { key: 'fun', i18n_key: 'questionnaire_focus_fun', icon: 'happy-outline' },
];
