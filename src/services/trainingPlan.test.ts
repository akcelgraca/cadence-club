jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { generateWeeklyPlan, generatePersonalizedPlan } from './trainingPlan';
import pt from '../lib/i18n/pt';
import type { ActivityGoal, QuestionnairePreferences } from '../lib/types';

const TODOS_OS_OBJETIVOS: ActivityGoal[] = [
  'stay_active', 'run_weekly_km', 'cycle_weekly_km', 'lose_weight', 'gain_muscle',
  'improve_endurance', 'train_for_race', 'train_with_friends', 'improve_flexibility',
  'improve_technique', 'explore_outdoors', 'have_fun',
];

describe('generateWeeklyPlan', () => {
  it('cobre a semana inteira para qualquer objetivo', () => {
    for (const objetivo of TODOS_OS_OBJETIVOS) {
      const plano = generateWeeklyPlan(objetivo);
      expect(plano).toHaveLength(7);
      expect(plano.map((d) => d.day_of_week)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it('dá pelo menos um dia de treino e um de descanso em cada objetivo', () => {
    for (const objetivo of TODOS_OS_OBJETIVOS) {
      const plano = generateWeeklyPlan(objetivo);
      expect(plano.some((d) => d.activity_type !== 'rest')).toBe(true);
      expect(plano.some((d) => d.activity_type === 'rest')).toBe(true);
    }
  });

  it('deixa os dias de descanso sem alvo de distância ou duração', () => {
    for (const objetivo of TODOS_OS_OBJETIVOS) {
      for (const dia of generateWeeklyPlan(objetivo).filter((d) => d.activity_type === 'rest')) {
        expect(dia.target_distance).toBeNull();
        expect(dia.target_duration).toBeNull();
      }
    }
  });

  it('cai em "manter-se ativo" sem objetivo definido', () => {
    expect(generateWeeklyPlan(null)).toEqual(generateWeeklyPlan('stay_active'));
  });

  describe('objetivos de quilometragem semanal', () => {
    /** Distâncias das saídas de um plano, por ordem da semana. */
    function saidas(objetivo: ActivityGoal, alvo?: number) {
      return generateWeeklyPlan(objetivo, alvo)
        .filter((d) => d.activity_type !== 'rest')
        .map((d) => d.target_distance!);
    }

    function total(objetivo: ActivityGoal, alvo?: number) {
      return saidas(objetivo, alvo).reduce((soma, km) => soma + km, 0);
    }

    it('reparte o alvo por quatro saídas progressivas', () => {
      expect(saidas('run_weekly_km', 40)).toEqual([7, 9, 11, 13]);
    });

    it('o plano soma exatamente o alvo semanal', () => {
      for (const alvo of [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120]) {
        expect(total('run_weekly_km', alvo)).toBe(alvo);
        expect(total('cycle_weekly_km', alvo)).toBe(alvo);
      }
    });

    it('as saídas nunca decrescem ao longo da semana', () => {
      // A saída longa fica com o resto do arredondamento; se o resto crescesse
      // demais, o plano acabaria com uma saída mais curta do que a anterior.
      for (const alvo of [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120]) {
        const km = saidas('run_weekly_km', alvo);
        expect([...km].sort((a, b) => a - b)).toEqual(km);
      }
    });

    it('mantém a saída longa como a maior', () => {
      for (const alvo of [10, 20, 40, 75]) {
        const km = saidas('run_weekly_km', alvo);
        expect(km.at(-1)).toBe(Math.max(...km));
      }
    });

    it('assume 10 km na corrida e 20 km na bicicleta sem alvo', () => {
      expect(generateWeeklyPlan('run_weekly_km'))
        .toEqual(generateWeeklyPlan('run_weekly_km', 10));
      expect(generateWeeklyPlan('cycle_weekly_km'))
        .toEqual(generateWeeklyPlan('cycle_weekly_km', 20));
      expect(total('run_weekly_km')).toBe(10);
      expect(total('cycle_weekly_km')).toBe(20);
    });

    it('cresce monotonamente com o alvo', () => {
      expect(total('run_weekly_km', 60)).toBeGreaterThan(total('run_weekly_km', 20));
    });

    it('escalona a bicicleta pelo mesmo critério', () => {
      expect(saidas('cycle_weekly_km', 100)).toEqual([18, 23, 27, 32]);
    });

    it('arredonda um alvo fracionário sem perder nem inventar quilómetros', () => {
      expect(total('run_weekly_km', 32.4)).toBe(32);
      expect(total('run_weekly_km', 32.6)).toBe(33);
    });
  });

  describe('objetivos sem distância', () => {
    it('define duração em vez de distância na flexibilidade', () => {
      for (const dia of generateWeeklyPlan('improve_flexibility')) {
        if (dia.activity_type === 'rest') continue;
        expect(dia.target_duration).toBeGreaterThan(0);
        expect(dia.target_distance).toBeNull();
      }
    });

    it('usa modalidades de força para ganhar músculo', () => {
      const tipos = generateWeeklyPlan('gain_muscle').map((d) => d.activity_type);
      expect(tipos).toContain('weight_training');
      expect(tipos).not.toContain('run');
    });
  });
});

describe('generatePersonalizedPlan', () => {
  function prefs(overrides: Partial<QuestionnairePreferences> = {}): QuestionnairePreferences {
    return {
      available_days: [0, 2, 4],
      preferred_activities: ['run'],
      session_duration: 'medium',
      fitness_level: 'intermediate',
      ...overrides,
    };
  }

  it('marca descanso nos dias em que a pessoa não pode treinar', () => {
    const plano = generatePersonalizedPlan(prefs({ available_days: [0, 2, 4] }));

    expect(plano.map((d) => d.activity_type)).toEqual([
      'run', 'rest', 'run', 'rest', 'run', 'rest', 'rest',
    ]);
    expect(plano[1].label).toBe('training_rest_day');
  });

  it('roda pelas modalidades preferidas em vez de repetir a primeira', () => {
    const plano = generatePersonalizedPlan(
      prefs({
        available_days: [0, 1, 2, 3],
        preferred_activities: ['run', 'cycle', 'yoga'],
      }),
    );

    expect(plano.slice(0, 4).map((d) => d.activity_type))
      .toEqual(['run', 'cycle', 'yoga', 'run']);
  });

  it('converte a duração da sessão em segundos', () => {
    expect(generatePersonalizedPlan(prefs({ session_duration: 'short' }))[0].target_duration)
      .toBe(25 * 60);
    expect(generatePersonalizedPlan(prefs({ session_duration: 'medium' }))[0].target_duration)
      .toBe(45 * 60);
    expect(generatePersonalizedPlan(prefs({ session_duration: 'long' }))[0].target_duration)
      .toBe(75 * 60);
  });

  it('só dá alvo de distância a modalidades que a medem', () => {
    const plano = generatePersonalizedPlan(
      prefs({ available_days: [0, 1], preferred_activities: ['run', 'yoga'] }),
    );

    expect(plano[0].target_distance).toBeGreaterThan(0); // corrida
    expect(plano[1].target_distance).toBeNull();         // ioga
    // A duração aplica-se às duas.
    expect(plano[1].target_duration).toBe(45 * 60);
  });

  it('aumenta as distâncias com o nível de condição física', () => {
    const distancia = (nivel: QuestionnairePreferences['fitness_level']) =>
      generatePersonalizedPlan(prefs({ fitness_level: nivel }))[0].target_distance!;

    expect(distancia('beginner')).toBe(3);
    expect(distancia('intermediate')).toBe(5);
    expect(distancia('advanced')).toBe(8);
    expect(distancia('pro')).toBe(12);
  });

  it('usa o nível intermédio quando o questionário não o indica', () => {
    const semNivel = generatePersonalizedPlan(
      prefs({ fitness_level: null as unknown as QuestionnairePreferences['fitness_level'] }),
    );
    expect(semNivel).toEqual(generatePersonalizedPlan(prefs({ fitness_level: 'intermediate' })));
  });

  it('guarda a chave de tradução, não o texto — o label vai para a base de dados', () => {
    const plano = generatePersonalizedPlan(
      prefs({ available_days: [0, 1, 2], preferred_activities: ['run', 'cycle', 'swimming'] }),
    );
    expect(plano.slice(0, 3).map((d) => d.label))
      .toEqual(['activity_run', 'activity_cycle', 'activity_swimming']);
  });

  it('todas as chaves de sessão existem no dicionário', () => {
    // Um label sem tradução apareceria ao utilizador como "plan_bike_long".
    const planos = [
      generatePersonalizedPlan(prefs({ available_days: [0, 1, 2, 3, 4, 5, 6] })),
      ...TODOS_OS_OBJETIVOS.map((objetivo) => generateWeeklyPlan(objetivo)),
    ];
    for (const plano of planos) {
      for (const dia of plano) {
        expect(pt).toHaveProperty(dia.label);
      }
    }
  });

  it('cobre sempre a semana inteira', () => {
    const plano = generatePersonalizedPlan(prefs({ available_days: [] }));
    expect(plano).toHaveLength(7);
    expect(plano.every((d) => d.activity_type === 'rest')).toBe(true);
  });
});
