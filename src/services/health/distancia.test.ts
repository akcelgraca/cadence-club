import { distanciaNoIntervalo, metrosDe } from './adapters';

/**
 * A distância no Health Connect.
 *
 * Ficou a zero desde que a sincronização existe, porque vive em registos
 * `Distance` separados do `ExerciseSession`. Um treino sem distância entra na
 * app com 0 km — e um 0 km numa lista de corridas não parece um erro, parece
 * um treino de ginásio.
 */

const t = (min: number) => new Date(`2026-08-26T10:${String(min).padStart(2, '0')}:00Z`).getTime();

describe('distanciaNoIntervalo', () => {
  it('soma os troços que caem dentro do treino', () => {
    const registos = [
      { inicio: t(0), fim: t(10), metros: 2000 },
      { inicio: t(10), fim: t(20), metros: 2200 },
    ];
    expect(distanciaNoIntervalo(registos, t(0), t(20))).toBe(4200);
  });

  it('ignora o que está fora do treino', () => {
    // O passeio até ao carro depois da corrida não é corrida.
    const registos = [
      { inicio: t(0), fim: t(10), metros: 2000 },
      { inicio: t(30), fim: t(40), metros: 800 },
    ];
    expect(distanciaNoIntervalo(registos, t(0), t(20))).toBe(2000);
  });

  it('reparte um troço que atravessa o início do treino', () => {
    // Quem carrega no "iniciar" com atraso produz exatamente isto. Contar o
    // troço inteiro atribuía a este treino metros percorridos antes dele.
    const registos = [{ inicio: t(0), fim: t(10), metros: 1000 }];
    // Metade do troço cai dentro → metade da distância.
    expect(distanciaNoIntervalo(registos, t(5), t(20))).toBe(500);
  });

  it('reparte um troço que atravessa o fim', () => {
    const registos = [{ inicio: t(10), fim: t(20), metros: 1000 }];
    expect(distanciaNoIntervalo(registos, t(0), t(15))).toBe(500);
  });

  it('dois treinos seguidos não somam mais do que a pessoa andou', () => {
    // É a consequência que interessa: sem repartir, o troço a cavalo entre os
    // dois era contado duas vezes, uma em cada um.
    const registos = [{ inicio: t(8), fim: t(12), metros: 400 }];
    const primeiro = distanciaNoIntervalo(registos, t(0), t(10));
    const segundo = distanciaNoIntervalo(registos, t(10), t(20));
    expect(primeiro + segundo).toBe(400);
  });

  it('um registo instantâneo dentro do treino conta inteiro', () => {
    // Não há como repartir uma duração zero, e descartá-lo perdia a distância.
    const registos = [{ inicio: t(5), fim: t(5), metros: 300 }];
    expect(distanciaNoIntervalo(registos, t(0), t(10))).toBe(300);
  });

  it('valores inválidos ou negativos não entram', () => {
    const registos = [
      { inicio: t(0), fim: t(10), metros: NaN },
      { inicio: t(0), fim: t(10), metros: -50 },
      { inicio: t(0), fim: t(10), metros: 1000 },
    ];
    expect(distanciaNoIntervalo(registos, t(0), t(10))).toBe(1000);
  });

  it('sem registos dá zero, não NaN', () => {
    expect(distanciaNoIntervalo([], t(0), t(10))).toBe(0);
  });
});

describe('metrosDe', () => {
  /**
   * O Health Connect declara a unidade. Assumir metros funcionava até ao dia em
   * que uma app escrevesse em quilómetros — e aí uma maratona entrava como 42
   * metros. Absurdo, mas plausível o suficiente para passar despercebido.
   */
  it('converte as unidades que a biblioteca usa', () => {
    expect(metrosDe({ value: 5000, unit: 'meters' })).toBe(5000);
    expect(metrosDe({ value: 5, unit: 'kilometers' })).toBe(5000);
    expect(metrosDe({ value: 1, unit: 'miles' })).toBeCloseTo(1609.344, 2);
    expect(metrosDe({ value: 100, unit: 'feet' })).toBeCloseTo(30.48, 2);
  });

  it('sem unidade assume metros', () => {
    expect(metrosDe({ value: 1200 })).toBe(1200);
    expect(metrosDe(1200)).toBe(1200);
  });

  it('lixo dá zero em vez de NaN', () => {
    // Um NaN a subir para a base de dados estraga somas de semanas inteiras.
    expect(metrosDe(null)).toBe(0);
    expect(metrosDe({ value: 'muito' })).toBe(0);
    expect(metrosDe(undefined)).toBe(0);
  });
});
