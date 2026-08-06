import { computeSplits, type SplitPoint } from './splits';
import { buildTrack, metersToLatDegrees } from '../test-utils/geoFixtures';

/**
 * Os traçados usam passos de 300 m de propósito: nenhuma fronteira de
 * quilómetro cai exatamente em cima de um ponto de GPS, que é o caso real e
 * também o que obriga a repartição proporcional a funcionar. Passos de
 * exatamente 1000 m fariam o teste depender do arredondamento do haversine.
 */

describe('computeSplits', () => {
  describe('casos degenerados', () => {
    it('devolve vazio sem pontos', () => {
      expect(computeSplits([])).toEqual([]);
    });

    it('devolve vazio com um só ponto', () => {
      expect(computeSplits(buildTrack(1, 300, 60))).toEqual([]);
    });

    it('devolve vazio para um treino parado no mesmo sítio', () => {
      const parado: SplitPoint[] = Array.from({ length: 10 }, (_, i) => ({
        lat: 38.7223,
        lng: -9.1393,
        elevation: null,
        timestamp: new Date(Date.UTC(2026, 0, 1, 8, 0, i)).toISOString(),
      }));
      expect(computeSplits(parado)).toEqual([]);
    });

    it('ignora um resto final abaixo de 50 m', () => {
      // 2 segmentos de 515 m = 1030 m: sobram 30 m que não valem um parcial.
      const splits = computeSplits(buildTrack(3, 515, 100));
      expect(splits).toHaveLength(1);
      expect(splits[0].isPartial).toBe(false);
    });

    it('mostra um resto final acima de 50 m', () => {
      // 2 segmentos de 530 m = 1060 m: sobram 60 m.
      const splits = computeSplits(buildTrack(3, 530, 100));
      expect(splits).toHaveLength(2);
      expect(splits[1].isPartial).toBe(true);
      expect(splits[1].distance).toBeCloseTo(60, 3);
    });
  });

  describe('ritmo constante', () => {
    // 19 segmentos de 300 m / 60 s = 5700 m em 1140 s, ou seja 200 s/km.
    const splits = computeSplits(buildTrack(20, 300, 60));

    it('produz um parcial por quilómetro mais o resto', () => {
      expect(splits).toHaveLength(6);
      expect(splits.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('dá parciais completos de exatamente 1000 m', () => {
      for (const split of splits.slice(0, 5)) {
        expect(split.distance).toBe(1000);
        expect(split.isPartial).toBe(false);
      }
    });

    it('reparte o tempo proporcionalmente à distância, não por ponto de GPS', () => {
      // Sem repartição, os parciais herdariam a grelha de 300 m e viriam
      // com 180 s ou 240 s em vez dos 200 s certos.
      for (const split of splits.slice(0, 5)) {
        expect(split.duration).toBeCloseTo(200, 6);
        expect(split.pace).toBeCloseTo(200, 6);
      }
    });

    it('marca o resto final como parcial com o ritmo correto', () => {
      const last = splits[5];
      expect(last.isPartial).toBe(true);
      expect(last.distance).toBeCloseTo(700, 3);
      expect(last.duration).toBeCloseTo(140, 6);
      expect(last.pace).toBeCloseTo(200, 6);
    });

    it('conserva a distância e o tempo totais', () => {
      const distancia = splits.reduce((t, s) => t + s.distance, 0);
      const tempo = splits.reduce((t, s) => t + s.duration, 0);
      expect(distancia).toBeCloseTo(5700, 3);
      expect(tempo).toBeCloseTo(1140, 6);
    });
  });

  it('reparte um segmento que atravessa várias fronteiras de uma vez', () => {
    // Um único ponto a 2500 m do anterior — acontece quando o GPS se perde.
    const splits = computeSplits(buildTrack(2, 2500, 500));

    expect(splits).toHaveLength(3);
    expect(splits[0]).toMatchObject({ distance: 1000, isPartial: false });
    expect(splits[0].duration).toBeCloseTo(200, 6);
    expect(splits[1]).toMatchObject({ distance: 1000, isPartial: false });
    expect(splits[1].duration).toBeCloseTo(200, 6);
    expect(splits[2].distance).toBeCloseTo(500, 3);
    expect(splits[2].duration).toBeCloseTo(100, 6);
    expect(splits[2].isPartial).toBe(true);
  });

  it('distingue um quilómetro rápido de um lento', () => {
    // 1200 m a 60 s cada 300 m, depois 1200 m a 120 s cada 300 m.
    const rapido = buildTrack(5, 300, 60); // 0 → 1200 m
    const lat0 = rapido[rapido.length - 1].lat;
    const t0 = new Date(rapido[rapido.length - 1].timestamp).getTime();
    const lento: SplitPoint[] = Array.from({ length: 4 }, (_, i) => ({
      lat: lat0 + metersToLatDegrees(300 * (i + 1)),
      lng: -9.1393,
      elevation: null,
      timestamp: new Date(t0 + 120000 * (i + 1)).toISOString(),
    }));

    const splits = computeSplits([...rapido, ...lento]);

    expect(splits[0].pace).toBeCloseTo(200, 6); // 300 m / 60 s
    expect(splits[1].pace).toBeGreaterThan(splits[0].pace);
    // O 2.º km é quase todo lento (200 m rápidos + 800 m lentos).
    expect(splits[1].duration).toBeCloseTo(0.2 * 200 + 0.8 * 400, 6);
  });

  describe('elevação', () => {
    it('reparte a subida proporcionalmente e não pelo ponto de GPS', () => {
      // +3 m a cada 300 m = +10 m a cada 1000 m.
      const splits = computeSplits(buildTrack(20, 300, 60, { elevationStep: 3 }));
      for (const split of splits.slice(0, 5)) {
        expect(split.elevationGain).toBeCloseTo(10, 6);
      }
      expect(splits[5].elevationGain).toBeCloseTo(7, 6); // resto de 700 m
    });

    it('ignora a descida — só conta ganho positivo', () => {
      const splits = computeSplits(buildTrack(20, 300, 60, { elevationStep: -3 }));
      for (const split of splits) {
        expect(split.elevationGain).toBe(0);
      }
    });

    it('trata elevação ausente como ganho nulo', () => {
      const splits = computeSplits(buildTrack(20, 300, 60));
      for (const split of splits) {
        expect(split.elevationGain).toBe(0);
      }
    });
  });

  describe('sistema imperial', () => {
    it('divide por milhas em vez de quilómetros', () => {
      const splits = computeSplits(buildTrack(20, 300, 60), 'imperial');
      // 5700 m = 3 milhas completas (4828,03 m) + 871,97 m
      expect(splits).toHaveLength(4);
      for (const split of splits.slice(0, 3)) {
        expect(split.distance).toBeCloseTo(1609.344, 6);
        expect(split.isPartial).toBe(false);
      }
      expect(splits[3].isPartial).toBe(true);
      expect(splits[3].distance).toBeCloseTo(5700 - 3 * 1609.344, 3);
    });

    it('mantém o ritmo em segundos por quilómetro (formatPace é que converte)', () => {
      const splits = computeSplits(buildTrack(20, 300, 60), 'imperial');
      // O ritmo real são 200 s/km, independentemente da unidade do parcial.
      expect(splits[0].pace).toBeCloseTo(200, 6);
    });
  });

  describe('dados de GPS corrompidos', () => {
    it('trata um relógio que anda para trás como tempo nulo', () => {
      const pontos = buildTrack(5, 300, 60);
      // O 3.º ponto chega com timestamp anterior ao 2.º.
      pontos[2].timestamp = new Date(
        new Date(pontos[1].timestamp).getTime() - 30000,
      ).toISOString();

      const splits = computeSplits(pontos);
      // O segmento que anda para trás vale 0 s em vez de tempo negativo — a
      // distância mantém-se intacta (1200 m = 1 km + resto de 200 m).
      expect(splits).toHaveLength(2);
      expect(splits[0].distance).toBe(1000);
      expect(splits[0].duration).toBeGreaterThan(0);
      expect(Number.isFinite(splits[0].duration)).toBe(true);
    });

    it('não estoira com timestamps inválidos', () => {
      const pontos = buildTrack(5, 300, 60);
      pontos[2].timestamp = 'não é uma data';

      const splits = computeSplits(pontos);
      // Os dois segmentos que tocam no ponto inválido contam 0 s; a distância
      // não se perde e nenhum valor fica NaN.
      expect(splits).toHaveLength(2);
      expect(splits[0].distance).toBe(1000);
      for (const split of splits) {
        expect(Number.isFinite(split.duration)).toBe(true);
        expect(Number.isFinite(split.pace)).toBe(true);
      }
    });

    it('salta pontos repetidos sem os contar como paragem', () => {
      const pontos = buildTrack(5, 300, 60);
      const duplicados = [pontos[0], pontos[0], ...pontos.slice(1)];

      expect(computeSplits(duplicados)).toEqual(computeSplits(pontos));
    });
  });
});
