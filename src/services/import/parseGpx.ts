import { XMLParser } from 'fast-xml-parser';
import type { ParsedTrack, TrackPoint } from './types';

/**
 * Leitor de GPX.
 *
 * O GPX é XML e não tem esquema fixo na prática — cada exportador enfeita à
 * sua maneira. O que é garantido é `<trkpt lat lon>` dentro de `<trkseg>`; o
 * resto (`<ele>`, `<time>`, `<type>`, `<name>`) aparece ou não.
 *
 * Usa-se o `fast-xml-parser` e não o DOM porque em React Native não há DOM.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Sem isto, um único <trkpt> vem como objeto e vários como array — e o
  // código teria de tratar os dois casos em cada nível.
  isArray: (nome) => ['trk', 'trkseg', 'trkpt'].includes(nome),
  // Deixar os valores como texto: as coordenadas são convertidas à mão, e a
  // conversão automática estraga tempos ISO e nomes que parecem números.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Aceita só o que é um número real e finito. */
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza um tempo para ISO, ou null se não for data válida. */
function tempo(v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Extrai o traçado de um GPX.
 *
 * Devolve null quando o conteúdo não é XML válido ou não tem `<gpx>` — o
 * chamador distingue isso de "válido mas sem pontos", que é outro caso.
 */
export function parseGpx(xml: string): ParsedTrack | null {
  let raiz: any;
  try {
    raiz = parser.parse(xml);
  } catch {
    return null;
  }

  const gpx = raiz?.gpx;
  if (!gpx) return null;

  const trilhos = gpx.trk ?? [];
  const pontos: TrackPoint[] = [];

  for (const trilho of trilhos) {
    for (const segmento of trilho.trkseg ?? []) {
      for (const p of segmento.trkpt ?? []) {
        const lat = numero(p['@lat']);
        const lng = numero(p['@lon']);
        // Um ponto sem coordenadas não é ponto. Salta-se em vez de rejeitar o
        // ficheiro inteiro: um único registo corrompido a meio de uma corrida
        // não devia custar a atividade toda.
        if (lat === null || lng === null) continue;

        pontos.push({
          lat,
          lng,
          elevation: numero(p.ele),
          time: tempo(p.time),
        });
      }
    }
  }

  // O nome e a modalidade vivem no primeiro <trk>; alguns exportadores põem o
  // nome só no <metadata>.
  const primeiro = trilhos[0];
  const nome = primeiro?.name ?? gpx.metadata?.name ?? null;

  return {
    name: typeof nome === 'string' && nome !== '' ? nome : null,
    rawType: typeof primeiro?.type === 'string' && primeiro.type !== ''
      ? primeiro.type
      : null,
    points: pontos,
    // O GPX não tem campo de distância — calcula-se a partir dos pontos.
    declaredDistance: null,
  };
}
