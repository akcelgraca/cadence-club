import { haversineDistance } from './geo';
import { EARTH_RADIUS_M, metersToLatDegrees } from '../test-utils/geoFixtures';

describe('haversineDistance', () => {
  it('devolve 0 para o mesmo ponto', () => {
    expect(haversineDistance(38.7223, -9.1393, 38.7223, -9.1393)).toBe(0);
  });

  it('um grau de latitude vale R × π/180 metros', () => {
    // Ao longo de um meridiano a fórmula reduz-se a R × Δlat, por isso este
    // valor é exato e não uma aproximação.
    const expected = (EARTH_RADIUS_M * Math.PI) / 180;
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(expected, 6);
  });

  it('converte metros para latitude e de volta sem perder precisão', () => {
    const lat = 38.7223 + metersToLatDegrees(1000);
    expect(haversineDistance(38.7223, -9.1393, lat, -9.1393)).toBeCloseTo(1000, 6);
  });

  it('é simétrica', () => {
    const ida = haversineDistance(38.7223, -9.1393, 41.1579, -8.6291);
    const volta = haversineDistance(41.1579, -8.6291, 38.7223, -9.1393);
    expect(ida).toBeCloseTo(volta, 9);
  });

  it('Lisboa–Porto ronda os 274 km', () => {
    const d = haversineDistance(38.7223, -9.1393, 41.1579, -8.6291);
    expect(d).toBeGreaterThan(270000);
    expect(d).toBeLessThan(278000);
  });

  it('a longitude encolhe com a latitude', () => {
    // Um grau de longitude no equador é bem maior do que perto do polo.
    const equador = haversineDistance(0, 0, 0, 1);
    const norte = haversineDistance(60, 0, 60, 1);
    // cos(60°) = 0.5, logo o de cima deve valer metade.
    expect(norte / equador).toBeCloseTo(0.5, 3);
  });

  it('funciona a atravessar o antimeridiano', () => {
    const d = haversineDistance(0, 179.9, 0, -179.9);
    // 0.2 graus de longitude no equador, não a volta ao mundo.
    expect(d).toBeCloseTo((EARTH_RADIUS_M * 0.2 * Math.PI) / 180, 3);
  });
});
