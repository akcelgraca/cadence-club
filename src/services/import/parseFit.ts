import { Decoder, Stream } from '@garmin/fitsdk';
import type { ParsedTrack, TrackPoint } from './types';

/**
 * Leitor de FIT (Flexible and Interoperable Data Transfer).
 *
 * É o formato que o Strava exporta para tudo o que foi gravado num
 * dispositivo — e, num arquivo do Strava, a maioria dos ficheiros. Sem isto, a
 * importação em lote traz as atividades introduzidas à mão e deixa de fora
 * precisamente aquelas que a pessoa mais quer trazer.
 *
 * Ao contrário do GPX e do TCX, é **binário**: mensagens com definições
 * próprias, tipos numéricos e escalas. Não se lê com um parser de XML, e por
 * isso usa-se o SDK oficial da Garmin — que trabalha sobre `Uint8Array` e não
 * depende de nada do Node, o que o torna utilizável em React Native.
 *
 * O que o FIT dá e o GPX não: a modalidade declarada pelo dispositivo, a
 * distância medida por ele (roda, passada, filtros próprios) e o batimento
 * cardíaco por ponto sem depender de extensões de fabricante.
 */

/**
 * As coordenadas do FIT vêm em *semicírculos*, não em graus.
 *
 * É um inteiro de 32 bits com sinal a cobrir a volta ao mundo, o que dá cerca
 * de 1 cm de resolução. A conversão é a razão entre 180 graus e 2^31.
 */
const GRAUS_POR_SEMICIRCULO = 180 / 2 ** 31;

function coordenada(semicirculos: unknown): number | null {
  if (typeof semicirculos !== 'number' || !Number.isFinite(semicirculos)) return null;
  const graus = semicirculos * GRAUS_POR_SEMICIRCULO;
  // Um sensor sem fix escreve zeros ou valores fora do mundo real.
  if (graus < -90 || graus > 90) return null;
  return graus;
}

function longitude(semicirculos: unknown): number | null {
  if (typeof semicirculos !== 'number' || !Number.isFinite(semicirculos)) return null;
  const graus = semicirculos * GRAUS_POR_SEMICIRCULO;
  if (graus < -180 || graus > 180) return null;
  return graus;
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** O SDK devolve `Date` nos campos de tempo; aqui só interessa o ISO. */
function tempo(v: unknown): string | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : v.toISOString();
  }
  if (typeof v === 'string' && v !== '') {
    const t = new Date(v);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  return null;
}

/**
 * Lê um ficheiro FIT.
 *
 * Recebe bytes e não texto: um FIT lido como string vem corrompido, porque os
 * seus bytes não são UTF-8 válido. É por isso que o `importTrackFile` aceita
 * `Uint8Array` além de `string`.
 *
 * Devolve null quando o ficheiro não é um FIT válido — a verificação é do
 * próprio SDK, que confere o cabeçalho e o CRC.
 */
export function parseFit(bytes: Uint8Array): ParsedTrack | null {
  let mensagens: any;
  try {
    const stream = Stream.fromByteArray(bytes);
    if (!Decoder.isFIT(stream)) return null;

    const decoder = new Decoder(stream);
    // `mesgListener` e afins ficam por omissão; interessa só o resultado.
    const { messages, errors } = decoder.read();
    // Um FIT truncado a meio decodifica na mesma até onde deu. Aproveita-se o
    // que houver: metade de um treino é melhor do que nada, e a defesa da
    // duração mínima trata do que for curto de mais.
    if (errors?.length > 0 && !messages?.recordMesgs?.length) return null;
    mensagens = messages;
  } catch {
    return null;
  }

  const registos: any[] = mensagens?.recordMesgs ?? [];
  const pontos: TrackPoint[] = [];

  for (const r of registos) {
    const lat = coordenada(r.positionLat);
    const lng = longitude(r.positionLong);
    // Registos sem posição existem aos milhares — são leituras de sensores
    // entre pontos de GPS. Não são pontos de traçado.
    if (lat === null || lng === null) continue;

    pontos.push({
      lat,
      lng,
      // `enhancedAltitude` tem mais alcance e melhor resolução; o `altitude`
      // simples fica como alternativa nos ficheiros mais antigos.
      elevation: numero(r.enhancedAltitude) ?? numero(r.altitude),
      heartRate: numero(r.heartRate),
      time: tempo(r.timestamp),
    });
  }

  // A sessão traz o resumo que o dispositivo calculou. É preferível ao que se
  // deduz das coordenadas, pelo mesmo motivo que no TCX.
  const sessao: any = mensagens?.sessionMesgs?.[0];
  const desporto: string | null =
    (typeof sessao?.sport === 'string' && sessao.sport) ||
    (typeof sessao?.subSport === 'string' && sessao.subSport) ||
    null;

  return {
    // O FIT não tem campo de nome de atividade; quem o quiser dá-lho depois.
    name: null,
    rawType: desporto,
    points: pontos,
    declaredDistance: numero(sessao?.totalDistance),
  };
}
