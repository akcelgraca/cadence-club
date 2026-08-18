import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { track as analytics } from '../../lib/analytics';
import { planImport } from '../health/dedup';
import type { ActivityWindow } from '../health/types';
import { parseGpx } from './parseGpx';
import { parseTcx } from './parseTcx';
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
export async function fileFingerprint(conteudo: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    conteudo,
  );
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
 * Importa um ficheiro de treino já lido para memória.
 *
 * Recebe o conteúdo em texto, não um caminho: quem chama é que sabe de onde
 * veio (seletor de ficheiros, partilha, mais tarde um zip), e assim isto
 * fica testável sem tocar no sistema de ficheiros.
 */
export async function importTrackFile(
  fileName: string,
  conteudo: string,
): Promise<ImportOutcome> {
  const vazio: ImportOutcome = { imported: 0, skipped: 0 };

  const formato = detectFormat(fileName);
  if (!formato) return { ...vazio, failure: 'unsupported_format' };

  let traçado: ParsedTrack | null;
  try {
    traçado = formato === 'gpx' ? parseGpx(conteudo) : parseTcx(conteudo);
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
    const janelas = await lerJanelas(treino.startTime, treino.endTime);
    const { toImport, skipped } = planImport([treino], janelas, formato);
    const descartados = Object.values(skipped).reduce((a, b) => a + b, 0);

    if (toImport.length === 0) return { imported: 0, skipped: descartados };

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { ...vazio, error: 'sessão expirada' };

    const { workout, type } = toImport[0];

    const { data: atividade, error } = await supabase
      .from('activities')
      .insert({
        user_id: user.user.id,
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

    return { imported: 1, skipped: descartados };
  } catch (err: any) {
    return { ...vazio, error: err?.message ?? 'erro desconhecido' };
  }
}
