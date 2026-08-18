import { XMLParser } from 'fast-xml-parser';
import type { ParsedTrack, TrackPoint } from './types';

/**
 * Leitor de TCX (Garmin Training Center).
 *
 * Também é XML, mas com outra árvore: `Activities > Activity > Lap >
 * Track > Trackpoint`, e as coordenadas em elementos filhos em vez de
 * atributos.
 *
 * Vale a pena por dois motivos: a modalidade vem declarada no atributo
 * `Sport` da `<Activity>`, e cada `<Lap>` traz `DistanceMeters` medida pelo
 * dispositivo — melhor do que a que se calcula a partir das coordenadas.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  isArray: (nome) => ['Activity', 'Lap', 'Track', 'Trackpoint'].includes(nome),
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tempo(v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function parseTcx(xml: string): ParsedTrack | null {
  let raiz: any;
  try {
    raiz = parser.parse(xml);
  } catch {
    return null;
  }

  const db = raiz?.TrainingCenterDatabase;
  if (!db) return null;

  const atividades = db.Activities?.Activity ?? [];
  const pontos: TrackPoint[] = [];
  let distanciaDeclarada = 0;
  let houveDistancia = false;

  for (const atividade of atividades) {
    for (const volta of atividade.Lap ?? []) {
      // DistanceMeters existe por volta; a soma é a distância da atividade.
      const d = numero(volta.DistanceMeters);
      if (d !== null) {
        distanciaDeclarada += d;
        houveDistancia = true;
      }

      for (const trilho of volta.Track ?? []) {
        for (const p of trilho.Trackpoint ?? []) {
          const pos = p.Position;
          const lat = numero(pos?.LatitudeDegrees);
          const lng = numero(pos?.LongitudeDegrees);
          // Num TCX é normal haver pontos sem posição (o relógio perdeu
          // sinal, ou é um treino de interior com só tempo e frequência
          // cardíaca). Saltam-se, como no GPX.
          if (lat === null || lng === null) continue;

          pontos.push({
            lat,
            lng,
            elevation: numero(p.AltitudeMeters),
            time: tempo(p.Time),
          });
        }
      }
    }
  }

  const primeira = atividades[0];

  return {
    name: typeof primeira?.Notes === 'string' && primeira.Notes !== ''
      ? primeira.Notes
      : null,
    // Sport é "Running", "Biking", "Other"… O mapeamento normaliza.
    rawType: typeof primeira?.['@Sport'] === 'string' && primeira['@Sport'] !== ''
      ? primeira['@Sport']
      : null,
    points: pontos,
    declaredDistance: houveDistancia ? distanciaDeclarada : null,
  };
}
