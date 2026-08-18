import { metersToLatDegrees } from '../../test-utils/geoFixtures';
import {
  ELEVATION_THRESHOLD_M,
  ROUTE_SUMMARY_MAX_POINTS,
  elevationGain,
  routeSummary,
  totalDistance,
  trackToWorkout,
} from './track';
import type { TrackPoint } from './types';

/**
 * Os pontos andam todos ao longo de um meridiano (longitude constante), onde
 * a haversine se reduz a R × Δlatitude. Isso dá distâncias exactas e permite
 * afirmar "isto são 1000 m" sem depender de arredondamentos.
 */
function ponto(
  metrosDoInicio: number,
  opcoes: { elevation?: number | null; time?: string | null } = {},
): TrackPoint {
  return {
    lat: metersToLatDegrees(metrosDoInicio),
    lng: 0,
    elevation: opcoes.elevation ?? null,
    time: opcoes.time ?? null,
  };
}

describe('totalDistance', () => {
  it('soma os troços ao longo do meridiano', () => {
    const pontos = [ponto(0), ponto(1000), ponto(2000)];
    expect(totalDistance(pontos)).toBeCloseTo(2000, 1);
  });

  it('é zero com menos de dois pontos', () => {
    expect(totalDistance([])).toBe(0);
    expect(totalDistance([ponto(0)])).toBe(0);
  });

  it('conta o caminho andado, não o deslocamento', () => {
    // Ida e volta: o deslocamento é zero, a distância percorrida não.
    const pontos = [ponto(0), ponto(500), ponto(0)];
    expect(totalDistance(pontos)).toBeCloseTo(1000, 1);
  });
});

describe('elevationGain', () => {
  it('soma as subidas que passam o limiar', () => {
    const pontos = [
      ponto(0, { elevation: 100 }),
      ponto(100, { elevation: 110 }),
      ponto(200, { elevation: 130 }),
    ];
    expect(elevationGain(pontos)).toBeCloseTo(30, 5);
  });

  it('ignora oscilação do GPS abaixo do limiar', () => {
    // Serrilha de ±2 m: ruído típico, não é subida.
    const pontos = [
      ponto(0, { elevation: 100 }),
      ponto(50, { elevation: 102 }),
      ponto(100, { elevation: 100 }),
      ponto(150, { elevation: 102 }),
      ponto(200, { elevation: 100 }),
    ];
    expect(elevationGain(pontos)).toBe(0);
  });

  it('não deixa passar subidas pequenas encadeadas', () => {
    // Cada passo fica abaixo do limiar, mas o total sobe 12 m. Comparar com o
    // ponto anterior em vez de com a referência deixaria isto passar como 0 —
    // e é exactamente por isso que a referência só avança quando conta.
    const abaixo = ELEVATION_THRESHOLD_M - 0.5;
    const pontos = [
      ponto(0, { elevation: 100 }),
      ponto(50, { elevation: 100 + abaixo }),
      ponto(100, { elevation: 100 + abaixo * 2 }),
      ponto(150, { elevation: 100 + abaixo * 3 }),
    ];
    // A referência só avança quando o acumulado passa o limiar, por isso o
    // ganho é contado — ao contrário do caso da serrilha, onde volta atrás.
    expect(elevationGain(pontos)).toBeGreaterThan(0);
  });

  it('é zero quando o ficheiro não traz altimetria', () => {
    expect(elevationGain([ponto(0), ponto(100), ponto(200)])).toBe(0);
  });

  it('não conta descidas', () => {
    const pontos = [
      ponto(0, { elevation: 200 }),
      ponto(100, { elevation: 150 }),
      ponto(200, { elevation: 100 }),
    ];
    expect(elevationGain(pontos)).toBe(0);
  });
});

describe('routeSummary', () => {
  it('devolve todos os pontos quando cabem', () => {
    const pontos = [ponto(0), ponto(100), ponto(200)];
    expect(routeSummary(pontos)).toHaveLength(3);
  });

  it('reduz ao máximo e mantém as pontas', () => {
    const pontos = Array.from({ length: 1000 }, (_, i) => ponto(i * 10));
    const resumo = routeSummary(pontos);

    expect(resumo).toHaveLength(ROUTE_SUMMARY_MAX_POINTS);
    expect(resumo[0]).toEqual([pontos[0].lat, pontos[0].lng]);
    expect(resumo[resumo.length - 1]).toEqual([
      pontos[pontos.length - 1].lat,
      pontos[pontos.length - 1].lng,
    ]);
  });

  it('lida com lista vazia', () => {
    expect(routeSummary([])).toEqual([]);
  });
});

describe('trackToWorkout', () => {
  const inicio = '2026-08-18T10:00:00.000Z';
  const fim = '2026-08-18T10:30:00.000Z';

  it('deriva duração, distância e desnível', () => {
    const treino = trackToWorkout(
      {
        name: 'Corrida matinal',
        rawType: 'running',
        declaredDistance: null,
        points: [
          ponto(0, { time: inicio, elevation: 100 }),
          ponto(5000, { time: fim, elevation: 150 }),
        ],
      },
      'file:abc',
    );

    expect(treino).not.toBeNull();
    expect(treino!.duration).toBe(1800);
    expect(treino!.distance).toBeCloseTo(5000, 0);
    expect(treino!.elevationGain).toBeCloseTo(50, 5);
    expect(treino!.externalId).toBe('file:abc');
    expect(treino!.rawType).toBe('running');
  });

  it('prefere a distância declarada à calculada', () => {
    // O dispositivo que gravou sabia mais do que coordenadas.
    const treino = trackToWorkout(
      {
        name: null,
        rawType: 'cycling',
        declaredDistance: 12345,
        points: [ponto(0, { time: inicio }), ponto(5000, { time: fim })],
      },
      'file:abc',
    );
    expect(treino!.distance).toBe(12345);
  });

  it('assume corrida quando o ficheiro não declara modalidade', () => {
    const treino = trackToWorkout(
      {
        name: null,
        rawType: null,
        declaredDistance: null,
        points: [ponto(0, { time: inicio }), ponto(1000, { time: fim })],
      },
      'file:abc',
    );
    // Descartar por falta de etiqueta custaria a atividade toda.
    expect(treino!.rawType).toBe('running');
  });

  it('rejeita traçados sem tempos — é uma rota, não um treino', () => {
    const treino = trackToWorkout(
      {
        name: 'Percurso planeado',
        rawType: 'running',
        declaredDistance: null,
        points: [ponto(0), ponto(1000), ponto(2000)],
      },
      'file:abc',
    );
    expect(treino).toBeNull();
  });

  it('rejeita quando só há um ponto com tempo', () => {
    const treino = trackToWorkout(
      {
        name: null,
        rawType: null,
        declaredDistance: null,
        points: [ponto(0, { time: inicio }), ponto(1000)],
      },
      'file:abc',
    );
    expect(treino).toBeNull();
  });

  it('rejeita duração não positiva', () => {
    const treino = trackToWorkout(
      {
        name: null,
        rawType: null,
        declaredDistance: null,
        points: [ponto(0, { time: fim }), ponto(1000, { time: inicio })],
      },
      'file:abc',
    );
    expect(treino).toBeNull();
  });
});
