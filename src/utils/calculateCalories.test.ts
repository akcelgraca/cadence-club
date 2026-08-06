import { calculateActivityCalories, calculateMonthlyCalories } from './calculateCalories';
import { makeActivity, makeEffort } from '../test-utils/activityFixtures';

/** MET × peso(kg) × horas — a fórmula que a implementação usa. */
function expectedCalories(met: number, weightKg: number, durationSeconds: number) {
  return met * weightKg * (durationSeconds / 3600);
}

describe('calculateActivityCalories', () => {
  describe('corrida', () => {
    it('usa o MET mais alto para ritmos abaixo de 4 min/km', () => {
      const a = makeEffort('run', 10000, 10000 / 1000 * 210); // 3'30"/km
      expect(calculateActivityCalories(a, 70)).toBeCloseTo(
        expectedCalories(14, 70, 2100), 6,
      );
    });

    it('escalona o MET por escalão de ritmo', () => {
      const escaloes: [number, number][] = [
        [270, 13],   // 4'30"/km
        [330, 11],   // 5'30"/km
        [390, 9.8],  // 6'30"/km
        [450, 8.3],  // 7'30"/km
        [540, 7],    // 9'00"/km
      ];
      for (const [pace, met] of escaloes) {
        const a = makeEffort('run', 10000, pace * 10);
        expect(calculateActivityCalories(a, 70)).toBeCloseTo(
          expectedCalories(met, 70, pace * 10), 6,
        );
      }
    });

    it('trata o trilho como corrida', () => {
      const estrada = makeEffort('run', 10000, 3300);
      const trilho = makeEffort('trail_run', 10000, 3300);
      expect(calculateActivityCalories(trilho, 70))
        .toBeCloseTo(calculateActivityCalories(estrada, 70), 6);
    });

    it('gasta mais quem corre mais depressa durante o mesmo tempo', () => {
      const rapido = makeEffort('run', 6000, 1800); // 5'00"/km
      const lento = makeEffort('run', 3000, 1800);  // 10'00"/km
      expect(calculateActivityCalories(rapido, 70))
        .toBeGreaterThan(calculateActivityCalories(lento, 70));
    });
  });

  describe('caminhada e bicicleta (MET pela velocidade, não pelo ritmo)', () => {
    it('escalona a caminhada pela velocidade', () => {
      // 3 km/h → 2,5 | 5 km/h → 3,5 | 6 km/h → 4,3 | 7 km/h → 5
      const casos: [number, number][] = [[3, 2.5], [5, 3.5], [6, 4.3], [7, 5]];
      for (const [kmh, met] of casos) {
        const a = makeEffort('walk', kmh * 1000, 3600);
        expect(calculateActivityCalories(a, 70)).toBeCloseTo(
          expectedCalories(met, 70, 3600), 6,
        );
      }
    });

    it('escalona a bicicleta pela velocidade', () => {
      const casos: [number, number][] = [
        [14, 4], [17, 6], [20, 8], [24, 10], [28, 12], [35, 14],
      ];
      for (const [kmh, met] of casos) {
        const a = makeEffort('cycle', kmh * 1000, 3600);
        expect(calculateActivityCalories(a, 70)).toBeCloseTo(
          expectedCalories(met, 70, 3600), 6,
        );
      }
    });
  });

  describe('modalidades sem distância', () => {
    it('usa o MET genérico de 7 para ioga, natação e afins', () => {
      for (const tipo of ['yoga', 'swimming', 'weight_training', 'football'] as const) {
        const a = makeActivity({ type: tipo, distance: 0, duration: 3600, avg_pace: 0 });
        expect(calculateActivityCalories(a, 70)).toBeCloseTo(
          expectedCalories(7, 70, 3600), 6,
        );
      }
    });
  });

  describe('casos degenerados', () => {
    it('devolve 0 para duração nula', () => {
      const a = makeActivity({ duration: 0, distance: 0, avg_pace: 0 });
      expect(calculateActivityCalories(a, 70)).toBe(0);
    });

    it('não estoira com distância nula e duração positiva', () => {
      const a = makeActivity({ type: 'run', distance: 0, duration: 1800, avg_pace: 0 });
      const kcal = calculateActivityCalories(a, 70);
      expect(Number.isFinite(kcal)).toBe(true);
      expect(kcal).toBeGreaterThan(0);
    });

    it('escala linearmente com o peso', () => {
      const a = makeEffort('run', 10000, 3300);
      expect(calculateActivityCalories(a, 100))
        .toBeCloseTo(calculateActivityCalories(a, 50) * 2, 6);
    });
  });
});

describe('calculateMonthlyCalories', () => {
  const julho = [
    makeEffort('run', 10000, 3300, { start_time: '2026-07-01T08:00:00.000Z' }),
    makeEffort('run', 5000, 1650, { start_time: '2026-07-20T08:00:00.000Z' }),
  ];
  const junho = [
    makeEffort('run', 10000, 3300, { start_time: '2026-06-30T23:00:00.000Z' }),
  ];
  const agosto = [
    makeEffort('run', 10000, 3300, { start_time: '2026-08-01T00:00:00.000Z' }),
  ];

  it('soma apenas as atividades do mês pedido', () => {
    const total = calculateMonthlyCalories([...junho, ...julho, ...agosto], 70, '2026-07');
    const esperado = julho.reduce((t, a) => t + calculateActivityCalories(a, 70), 0);
    expect(total).toBeCloseTo(esperado, 6);
  });

  it('exclui os meses vizinhos, mesmo à distância de uma hora', () => {
    expect(calculateMonthlyCalories(junho, 70, '2026-07')).toBe(0);
    expect(calculateMonthlyCalories(agosto, 70, '2026-07')).toBe(0);
  });

  it('devolve 0 sem atividades', () => {
    expect(calculateMonthlyCalories([], 70, '2026-07')).toBe(0);
  });

  it('assume 70 kg quando o perfil não tem peso', () => {
    const semPeso = calculateMonthlyCalories(julho, null, '2026-07');
    const comPeso = calculateMonthlyCalories(julho, 70, '2026-07');
    expect(semPeso).toBeCloseTo(comPeso, 6);
    expect(calculateMonthlyCalories(julho, undefined, '2026-07')).toBeCloseTo(comPeso, 6);
  });

  it('usa o mês corrente quando nenhum é indicado', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    try {
      const total = calculateMonthlyCalories([...junho, ...julho, ...agosto], 70);
      expect(total).toBeCloseTo(calculateMonthlyCalories(julho, 70, '2026-07'), 6);
    } finally {
      jest.useRealTimers();
    }
  });
});
