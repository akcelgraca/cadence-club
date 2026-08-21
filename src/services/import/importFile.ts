import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { track as analytics } from '../../lib/analytics';
import { planImport } from '../health/dedup';
import type { ActivityWindow } from '../health/types';
import { parseGpx } from './parseGpx';
import { parseTcx } from './parseTcx';
import { parseFit } from './parseFit';
import { routeSummary, trackToWorkout } from './track';
import type { ImportFormat, ImportOutcome, ParsedTrack } from './types';

/**
 * Quantos dias para trás procurar atividades que possam colidir.
 *
 * A defesa da sobreposição temporal precisa de saber o que já lá está. Ler o
 * histórico todo a cada importação seria caro, e um ficheiro que se importa
 * é quase sempre recente ou de uma data concreta — por isso a janela é
 * calculada à volta do próprio ficheiro, não a partir de hoje.
 */
const JANELA_DIAS = 2;

/** Pontos máximos a gravar em activity_points. */
const MAX_PONTOS = 5000;

/** Extensão → formato. Devolve null para o que não sabemos ler. */
export function detectFormat(fileName: string): ImportFormat | null {
  const nome = fileName.toLowerCase();
  if (nome.endsWith('.gpx')) return 'gpx';
  if (nome.endsWith('.tcx')) return 'tcx';
  if (nome.endsWith('.fit')) return 'fit';
  return null;
}

/**
 * Identificador estável para o conteúdo de um ficheiro.
 *
 * Serve de `external_id`, para que reimportar o mesmo ficheiro seja apanhado
 * pela defesa que já existe. Usa-se o conteúdo e não o nome porque o nome
 * muda com facilidade — o Strava numera as exportações, e o mesmo treino
 * descarregado duas vezes sai com nomes diferentes.
 */
export async function fileFingerprint(conteudo: string | Uint8Array): Promise<string> {
  // Bytes e texto têm de passar por caminhos diferentes: o `digestStringAsync`
  // recebe uma string, e passar-lhe um FIT convertido a texto perderia bytes.
  let hash: string;
  if (typeof conteudo === 'string') {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, conteudo);
  } else {
    // A cópia é para o tipo: um `Uint8Array` genérico não satisfaz o
    // `BufferSource` do TypeScript, e o `.buffer` de uma cópia é um
    // `ArrayBuffer` a sério.
    const bytes = new Uint8Array(conteudo);
    const digerido = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes.buffer as ArrayBuffer);
    hash = [...new Uint8Array(digerido)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Prefixo para não colidir com ids vindos do HealthKit, que são UUIDs.
  return `file:${hash.slice(0, 32)}`;
}

/** Reduz os pontos a um máximo, mantendo a ordem e as pontas. */
function amostrar<T>(pontos: T[], maximo: number): T[] {
  if (pontos.length <= maximo) return pontos;
  const passo = (pontos.length - 1) / (maximo - 1);
  const saida: T[] = [];
  for (let i = 0; i < maximo; i++) saida.push(pontos[Math.round(i * passo)]);
  return saida;
}

/** Atividades que se sobrepõem à janela do ficheiro. */
async function lerJanelas(inicio: string, fim: string): Promise<ActivityWindow[]> {
  const de = new Date(new Date(inicio).getTime() - JANELA_DIAS * 86400_000);
  const ate = new Date(new Date(fim).getTime() + JANELA_DIAS * 86400_000);

  const { data } = await supabase
    .from('activities')
    .select('start_time, end_time, source, external_id')
    .gte('start_time', de.toISOString())
    .lte('start_time', ate.toISOString());

  return (data ?? []).map((a: any) => ({
    startTime: a.start_time,
    endTime: a.end_time,
    source: a.source,
    externalId: a.external_id,
  }));
}

/**
 * Contexto que quem importa em lote já tem, e não vale a pena voltar a buscar.
 *
 * Sem isto, importar um arquivo do Strava com 2000 atividades fazia 2000
 * consultas de janela e 2000 chamadas ao `getUser()` — uma por ficheiro,
 * em série. Passar o que já se sabe transforma isso numa consulta só.
 */
export interface ImportContext {
  /** Atividades já existentes, para a defesa da sobreposição temporal. */
  janelas: ActivityWindow[];
  userId: string;
}

/**
 * Importa um ficheiro de treino já lido para memória.
 *
 * Recebe o conteúdo, não um caminho: quem chama é que sabe de onde veio
 * (seletor de ficheiros, partilha, um zip), e assim isto fica testável sem
 * tocar no sistema de ficheiros.
 *
 * Devolve também a janela da atividade criada. Quem importa em lote junta-a às
 * que já tinha, para que o ficheiro seguinte do mesmo arquivo seja
 * deduplicado contra este — um arquivo do Strava traz duplicados dentro de si
 * com frequência, e sem isto passariam todos.
 */
export async function importTrackFile(
  fileName: string,
  conteudo: string | Uint8Array,
  contexto?: ImportContext,
): Promise<ImportOutcome> {
  const vazio: ImportOutcome = { imported: 0, skipped: 0 };

  const formato = detectFormat(fileName);
  if (!formato) return { ...vazio, failure: 'unsupported_format' };

  // Cada leitor quer o conteúdo na forma certa. Um FIT lido como texto vem
  // corrompido — os seus bytes não são UTF-8 válido — e um XML entregue como
  // bytes não é lido por parser nenhum.
  const ehTexto = typeof conteudo === 'string';
  if (formato === 'fit' && ehTexto) return { ...vazio, failure: 'needs_bytes' };
  if (formato !== 'fit' && !ehTexto) return { ...vazio, failure: 'needs_text' };

  let traçado: ParsedTrack | null;
  try {
    traçado =
      formato === 'gpx' ? parseGpx(conteudo as string)
      : formato === 'tcx' ? parseTcx(conteudo as string)
      : parseFit(conteudo as Uint8Array);
  } catch (err: any) {
    return { ...vazio, failure: 'malformed', error: err?.message };
  }
  if (!traçado) return { ...vazio, failure: 'malformed' };
  if (traçado.points.length === 0) return { ...vazio, failure: 'no_points' };

  const externalId = await fileFingerprint(conteudo);
  const treino = trackToWorkout(traçado, externalId);
  // Sem tempos não é um treino, é uma rota planeada. Dizer isso ao utilizador
  // é melhor do que importar uma atividade de duração zero.
  if (!treino) return { ...vazio, failure: 'no_timestamps' };

  try {
    const janelas = contexto?.janelas
      ?? (await lerJanelas(treino.startTime, treino.endTime));
    const { toImport, skipped } = planImport([treino], janelas, formato);
    const descartados = Object.values(skipped).reduce((a, b) => a + b, 0);

    if (toImport.length === 0) return { imported: 0, skipped: descartados };

    let userId = contexto?.userId;
    if (!userId) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { ...vazio, error: 'sessão expirada' };
      userId = user.user.id;
    }

    const { workout, type } = toImport[0];

    const { data: atividade, error } = await supabase
      .from('activities')
      .insert({
        user_id: userId,
        type,
        distance: workout.distance,
        duration: workout.duration,
        elevation_gain: workout.elevationGain,
        avg_pace: workout.distance > 0
          ? workout.duration / (workout.distance / 1000)
          : null,
        start_time: workout.startTime,
        end_time: workout.endTime,
        // Ao contrário da sincronização com a Saúde, aqui há traçado — e por
        // isso mapa, splits e deteção de troços funcionam. Também passa a
        // estar sujeito às zonas de privacidade, que é o comportamento certo.
        route_summary: routeSummary(traçado.points),
        title: traçado.name,
        // Privado por omissão: importar não é publicar.
        is_public: false,
        source: formato,
        external_id: workout.externalId,
        state: 'finished',
      })
      .select()
      .single();

    if (error) return { ...vazio, error: error.message };

    const comTempo = traçado.points.filter((p) => p.time !== null);
    if (comTempo.length > 0) {
      const pontos = amostrar(comTempo, MAX_PONTOS).map((p) => ({
        activity_id: atividade.id,
        lat: p.lat,
        lng: p.lng,
        elevation: p.elevation,
        timestamp: p.time,
      }));
      // Uma falha a gravar pontos não invalida a atividade: fica sem mapa,
      // mas os números estão certos e é melhor do que perder tudo.
      await supabase.from('activity_points').insert(pontos);
    }

    analytics('activity_recorded', {
      type,
      distance_km: Math.round(workout.distance / 1000),
      duration_min: Math.round(workout.duration / 60),
      queued_offline: false,
      has_photos: false,
    });

    return {
      imported: 1,
      skipped: descartados,
      // Para quem está a importar em lote deduplicar o ficheiro seguinte
      // contra este, sem voltar à base de dados.
      janela: {
        startTime: workout.startTime,
        endTime: workout.endTime,
        source: formato,
        externalId: workout.externalId,
      },
    };
  } catch (err: any) {
    return { ...vazio, error: err?.message ?? 'erro desconhecido' };
  }
}
