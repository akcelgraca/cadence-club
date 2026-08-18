import { haversineDistance } from '../../utils/geo';
import type { ExternalWorkout } from '../health/types';
import type { ParsedTrack, TrackPoint } from './types';

/**
 * Subida mínima, em metros, para contar como ganho de elevação.
 *
 * O GPS oscila alguns metros na vertical mesmo parado. Somar todas as
 * diferenças positivas dá números absurdos — uma corrida plana acusaria
 * centenas de metros de subida. O limiar filtra o ruído.
 *
 * 3 metros é o valor que a maioria dos dispositivos usa.
 */
export const ELEVATION_THRESHOLD_M = 3;

/**
 * Pontos máximos no `route_summary`.
 *
 * O traçado completo vive em `activity_points`; o resumo é só para desenhar o
 * mapa na lista e no feed, onde mais do que isto não se distingue a olho e só
 * pesa no JSON.
 */
export const ROUTE_SUMMARY_MAX_POINTS = 200;

/** Distância total percorrida, em metros, somando ponto a ponto. */
export function totalDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  return total;
}

/**
 * Subida acumulada, em metros.
 *
 * Só conta quando a diferença face ao último ponto *aceite* passa o limiar —
 * não face ao ponto anterior. Comparar com o anterior deixaria passar uma
 * sequência de subidas de 2,9 m, que somadas dariam o mesmo ruído que se
 * queria filtrar.
 */
export function elevationGain(points: TrackPoint[]): number {
  const comAltitude = points.filter((p) => p.elevation !== null);
  if (comAltitude.length < 2) return 0;

  let ganho = 0;
  let referencia = comAltitude[0].elevation as number;

  for (let i = 1; i < comAltitude.length; i++) {
    const atual = comAltitude[i].elevation as number;
    const delta = atual - referencia;
    if (delta >= ELEVATION_THRESHOLD_M) {
      ganho += delta;
      referencia = atual;
    } else if (delta < 0) {
      // A descer, a referência acompanha: senão uma descida longa seguida de
      // subida curta contaria a subida toda desde o ponto alto.
      referencia = atual;
    }
  }
  return ganho;
}

/**
 * Reduz o traçado a no máximo `ROUTE_SUMMARY_MAX_POINTS`, mantendo sempre o
 * primeiro e o último.
 *
 * Amostragem regular, não Douglas-Peucker: é para desenhar uma miniatura, e a
 * diferença visual não compensa a complexidade.
 */
export function routeSummary(points: TrackPoint[]): number[][] {
  if (points.length === 0) return [];
  if (points.length <= ROUTE_SUMMARY_MAX_POINTS) {
    return points.map((p) => [p.lat, p.lng]);
  }

  const passo = (points.length - 1) / (ROUTE_SUMMARY_MAX_POINTS - 1);
  const resumo: number[][] = [];
  for (let i = 0; i < ROUTE_SUMMARY_MAX_POINTS; i++) {
    const p = points[Math.round(i * passo)];
    resumo.push([p.lat, p.lng]);
  }
  return resumo;
}

/**
 * Converte um traçado num treino, no mesmo formato que a sincronização com a
 * Saúde produz — para poder seguir pelo mesmo `planImport`.
 *
 * `externalId` é responsabilidade de quem chama: aqui não há um id vindo da
 * plataforma, por isso usa-se um hash do conteúdo do ficheiro (ver
 * `fileFingerprint`). Assim, importar duas vezes o mesmo ficheiro é apanhado
 * pela defesa que já existe.
 *
 * Devolve null quando o traçado não dá um treino: sem pontos, ou sem tempos
 * (um GPX de rota planeada tem coordenadas mas não tem relógio).
 */
export function trackToWorkout(
  track: ParsedTrack,
  externalId: string,
): ExternalWorkout | null {
  const comTempo = track.points.filter((p) => p.time !== null);
  if (comTempo.length < 2) return null;

  const inicio = comTempo[0].time as string;
  const fim = comTempo[comTempo.length - 1].time as string;
  const duracao = (new Date(fim).getTime() - new Date(inicio).getTime()) / 1000;
  if (!Number.isFinite(duracao) || duracao <= 0) return null;

  // A distância declarada pelo dispositivo ganha à calculada: quem gravou
  // tinha mais informação do que coordenadas (roda, passada, filtros).
  const distancia = track.declaredDistance ?? totalDistance(track.points);

  return {
    externalId,
    // Sem modalidade declarada assume-se corrida — é o caso mais comum, e o
    // utilizador corrige na edição. Descartar seria pior: perdia-se a
    // atividade por causa de uma etiqueta em falta.
    rawType: track.rawType ?? 'running',
    startTime: new Date(inicio).toISOString(),
    endTime: new Date(fim).toISOString(),
    distance: distancia,
    duration: duracao,
    elevationGain: elevationGain(track.points),
    // Nem GPX nem TCX trazem frequência cardíaca num sítio que valha a pena
    // ler nesta fase; o TCX tem-na por ponto, fica para quando houver coluna.
    avgHeartRate: null,
    // Um ficheiro não foi gravado por nós, mesmo que tenha saído desta app —
    // se o utilizador o exportou e reimportou, a defesa do id externo trata
    // do caso, e a da sobreposição temporal apanha o resto.
    sourceApp: null,
  };
}
