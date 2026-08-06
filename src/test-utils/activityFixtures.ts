import type { Activity, ActivityType } from '../lib/types';

/**
 * Atividade mínima para testes. Só é preciso indicar o que o teste observa —
 * o resto tem valores plausíveis para o campo não ficar `undefined`.
 */
export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    user_id: 'user-1',
    type: 'run',
    state: 'finished',
    distance: 5000,
    duration: 1500,
    elevation_gain: 30,
    avg_pace: 300,
    start_time: '2026-07-15T08:00:00.000Z',
    end_time: '2026-07-15T08:25:00.000Z',
    route_summary: null,
    mood: null,
    title: 'Corrida matinal',
    description: null,
    is_public: true,
    source: 'app',
    created_at: '2026-07-15T08:25:00.000Z',
    ...overrides,
  };
}

/**
 * Atividade descrita pelo que interessa ao cálculo de calorias: modalidade,
 * distância e duração. O ritmo médio é derivado, como no registo real.
 */
export function makeEffort(
  type: ActivityType,
  distanceMeters: number,
  durationSeconds: number,
  overrides: Partial<Activity> = {},
): Activity {
  return makeActivity({
    type,
    distance: distanceMeters,
    duration: durationSeconds,
    avg_pace: distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : 0,
    ...overrides,
  });
}
