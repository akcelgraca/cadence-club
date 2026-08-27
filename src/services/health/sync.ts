import { supabase } from '../supabase';
import { track } from '../../lib/analytics';
import { planImport, type PlanOptions } from './dedup';
import { currentAdapter } from './adapters';
import type { ActivityWindow, HealthSource, SyncOutcome } from './types';
import type { ActivityType } from '../../lib/types';

// Schema: supabase/migrations/043_health_sync.sql

/** Primeira sincronização: até onde recuar. Mais do que isto é histórico morto. */
const PRIMEIRA_SINCRONIZACAO_DIAS = 30;

/**
 * Margem para trás a partir da última sincronização.
 *
 * Os relógios nem sempre entregam os treinos por ordem, e um treino gravado
 * offline pode aparecer na Saúde horas depois de ter acontecido. Sem esta
 * margem, esses treinos nunca mais eram vistos.
 */
const MARGEM_HORAS = 12;

async function lerEstado(source: HealthSource): Promise<Date> {
  const { data } = await supabase
    .from('health_sync_state')
    .select('last_synced_at')
    .eq('source', source)
    .maybeSingle();

  if (data?.last_synced_at) {
    const desde = new Date(data.last_synced_at);
    desde.setHours(desde.getHours() - MARGEM_HORAS);
    return desde;
  }

  const inicio = new Date();
  inicio.setDate(inicio.getDate() - PRIMEIRA_SINCRONIZACAO_DIAS);
  return inicio;
}

async function gravarEstado(
  source: HealthSource,
  ultimoTreino: string | null,
  importados: number,
  erro?: string,
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase.from('health_sync_state').upsert(
    {
      user_id: user.user.id,
      source,
      ...(ultimoTreino ? { last_synced_at: ultimoTreino } : {}),
      last_attempt_at: new Date().toISOString(),
      last_error: erro ?? null,
      imported_count: importados,
    },
    { onConflict: 'user_id,source' },
  );
}

/** Atividades já registadas na janela, para detetar sobreposições. */
async function lerJanelas(desde: Date): Promise<ActivityWindow[]> {
  const { data, error } = await supabase.rpc('get_activity_windows', {
    p_from: desde.toISOString(),
    p_to: new Date().toISOString(),
  });
  if (error || !data) return [];

  return (data as any[]).map((r) => ({
    startTime: r.start_time,
    endTime: r.end_time,
    source: r.source,
    externalId: r.external_id,
  }));
}

/**
 * Lê os treinos novos da plataforma e importa o que faltar.
 *
 * Seguro para chamar repetidamente: o que já cá está não volta a entrar, e o
 * que falhar fica para a próxima. Nunca atira — devolve o resultado, porque
 * isto corre em segundo plano e não deve poder partir um ecrã.
 */
export async function syncHealthWorkouts(options: PlanOptions = {}): Promise<SyncOutcome> {
  const vazio: SyncOutcome = {
    imported: 0,
    skipped: 0,
    skippedReasons: {
      already_imported: 0, overlaps_existing: 0,
      recorded_by_us: 0, too_short: 0, unknown_type: 0,
    },
  };

  const adapter = currentAdapter();
  if (!adapter) return vazio;

  try {
    if (!(await adapter.isAvailable())) return vazio;
    if (!(await adapter.hasPermissions())) return vazio;

    const desde = await lerEstado(adapter.source);
    const [treinos, janelas] = await Promise.all([
      adapter.readWorkouts(desde),
      lerJanelas(desde),
    ]);

    const { toImport, skipped } = planImport(treinos, janelas, adapter.source, options);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return vazio;

    let importados = 0;
    let ultimoTreino: string | null = null;

    for (const { workout, type } of toImport) {
      const { error } = await supabase.from('activities').insert({
        user_id: user.user.id,
        type,
        distance: workout.distance,
        duration: workout.duration,
        elevation_gain: workout.elevationGain,
        avg_pace: workout.distance > 0 ? workout.duration / (workout.distance / 1000) : null,
        avg_heart_rate: workout.avgHeartRate,
        max_heart_rate: workout.maxHeartRate,
        start_time: workout.startTime,
        end_time: workout.endTime,
        // Um treino importado não tem traçado — o GPS fica no relógio. Sem
        // route_summary não há nada para as zonas de privacidade cortarem.
        route_summary: null,
        // Privado por omissão: ninguém escolheu partilhar isto.
        is_public: false,
        source: adapter.source,
        external_id: workout.externalId,
        state: 'finished',
      });

      // A restrição única na base de dados é a última defesa: se duas
      // sincronizações correrem ao mesmo tempo, uma delas falha aqui e isso
      // está certo.
      if (error) continue;

      importados++;
      if (!ultimoTreino || workout.startTime > ultimoTreino) ultimoTreino = workout.startTime;

      track('activity_recorded', {
        type,
        distance_km: Math.round(workout.distance / 1000),
        duration_min: Math.round(workout.duration / 60),
        queued_offline: false,
        has_photos: false,
      });
    }

    await gravarEstado(adapter.source, ultimoTreino, importados);

    const descartados = Object.values(skipped).reduce((a, b) => a + b, 0);
    return { imported: importados, skipped: descartados, skippedReasons: skipped };
  } catch (err: any) {
    await gravarEstado(adapter.source, null, 0, err?.message ?? 'erro desconhecido').catch(() => {});
    return { ...vazio, error: err?.message ?? 'erro desconhecido' };
  }
}

/** Pede permissão e, se for concedida, faz logo a primeira importação. */
export async function connectHealth(): Promise<{ connected: boolean; outcome?: SyncOutcome }> {
  const adapter = currentAdapter();
  if (!adapter || !(await adapter.isAvailable())) return { connected: false };

  const concedida = await adapter.requestPermissions();
  if (!concedida) return { connected: false };

  return { connected: true, outcome: await syncHealthWorkouts() };
}

export async function isHealthAvailable(): Promise<boolean> {
  const adapter = currentAdapter();
  return adapter ? adapter.isAvailable() : false;
}

export async function isHealthConnected(): Promise<boolean> {
  const adapter = currentAdapter();
  if (!adapter || !(await adapter.isAvailable())) return false;
  return adapter.hasPermissions();
}

/**
 * Devolve à Saúde um treino gravado na app.
 *
 * A app leu da Saúde durante meses sem nunca lhe devolver nada. Quem grava aqui
 * e usa o relógio para o resto ficava com o histórico partido em dois — e a
 * Saúde é onde a maioria das pessoas espera ver tudo junto.
 *
 * **Nunca lança, e nunca bloqueia.** É chamado depois de a atividade já estar
 * guardada: uma falha a escrever não pode custar a corrida, e o utilizador não
 * pode ficar à espera do módulo nativo para ver o resumo. Quem chama não deve
 * esperar por isto.
 */
export async function writeBackWorkout(activity: {
  type: ActivityType;
  start_time: string;
  end_time: string | null;
  distance: number;
  duration: number;
  source: string;
}): Promise<boolean> {
  // Só o que foi gravado AQUI. Devolver à Saúde um treino que veio da Saúde
  // era escrever uma cópia do que já lá está — e a deduplicação da leitura
  // seguinte teria de a apanhar por sobreposição, que é a defesa mais fraca
  // das duas.
  if (activity.source !== 'app') return false;

  const adaptador = currentAdapter();
  if (!adaptador) return false;

  try {
    if (!(await adaptador.isAvailable())) return false;
    // Não se pede permissão aqui. Pedi-la no fim de uma corrida seria um
    // diálogo do sistema em cima de quem acabou de correr, e a resposta a
    // frio é quase sempre "não". Pede-se nas Definições, com contexto.
    if (!(await adaptador.canWrite())) return false;

    const fim = activity.end_time
      ?? new Date(new Date(activity.start_time).getTime() + activity.duration * 1000).toISOString();

    return await adaptador.writeWorkout({
      type: activity.type,
      startTime: activity.start_time,
      endTime: fim,
      distance: activity.distance,
    });
  } catch {
    return false;
  }
}
