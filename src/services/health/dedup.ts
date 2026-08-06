import { mapWorkoutType } from './mapping';
import type {
  ActivityWindow, ExternalWorkout, HealthSource, ImportCandidate, SkipReason,
} from './types';

/**
 * Decide o que vale a pena importar.
 *
 * Esta é a parte onde os bugs desta funcionalidade realmente vivem. Importar
 * a dobrar é o erro mais visível que uma sincronização de saúde consegue
 * cometer: a pessoa vê a mesma corrida duas vezes, com os números todos a
 * contar em duplicado nas estatísticas.
 */

/** Abaixo disto é ruído — o relógio regista arranques acidentais de segundos. */
export const MIN_DURATION_SECONDS = 60;

/**
 * Duas atividades que se sobreponham mais do que isto são a mesma coisa.
 *
 * Não é 0 de propósito: o relógio e o telemóvel raramente arrancam e param no
 * mesmo segundo, e a mesma corrida pode aparecer com um minuto de diferença
 * nas pontas.
 */
export const OVERLAP_TOLERANCE_RATIO = 0.5;

function toMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Segundos em que dois intervalos se sobrepõem. Zero se não se tocarem. */
export function overlapSeconds(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string | null,
): number {
  const a0 = toMs(aStart), a1 = toMs(aEnd);
  const b0 = toMs(bStart);
  // Sem fim registado, assume-se instantâneo: só colide se estiver lá dentro.
  const b1 = bEnd ? toMs(bEnd) : b0;
  if ([a0, a1, b0, b1].some((v) => !Number.isFinite(v))) return 0;

  const inicio = Math.max(a0, b0);
  const fim = Math.min(a1, b1);
  return fim > inicio ? (fim - inicio) / 1000 : 0;
}

/**
 * O treino já está representado por alguma atividade existente?
 *
 * Sobreposição relativa à duração do treino, não absoluta: 5 minutos em comum
 * são decisivos num treino de 10 minutos e irrelevantes num de 3 horas.
 */
export function overlapsExisting(
  workout: ExternalWorkout,
  existing: ActivityWindow[],
): boolean {
  const duracao = Math.max(1, workout.duration);
  return existing.some((janela) => {
    const comum = overlapSeconds(workout.startTime, workout.endTime, janela.startTime, janela.endTime);
    return comum / duracao >= OVERLAP_TOLERANCE_RATIO;
  });
}

/**
 * Nomes de app que significam "isto fomos nós".
 *
 * Quando a app escrever os treinos na Saúde, eles voltam na leitura seguinte.
 * Sem este filtro, cada corrida gravada aqui era reimportada como se viesse
 * do relógio.
 */
const NOSSAS_APPS = ['cadence club', 'cadence'];

export function recordedByUs(workout: ExternalWorkout): boolean {
  if (!workout.sourceApp) return false;
  const nome = workout.sourceApp.trim().toLowerCase();
  return NOSSAS_APPS.includes(nome);
}

export interface PlanResult {
  toImport: ImportCandidate[];
  skipped: Record<SkipReason, number>;
}

/**
 * Filtra a lista de treinos lidos da plataforma até ao que deve mesmo entrar.
 *
 * A ordem das verificações é a mais barata primeiro, e também a mais
 * informativa: saber que algo foi descartado por "já importado" é diferente
 * de saber que foi por "sobrepõe-se a outro".
 */
export interface PlanOptions {
  /**
   * Aceita treinos que a própria app escreveu na Saúde.
   *
   * Existe só para o seeder de desenvolvimento: no simulador, a única forma
   * de pôr treinos no HealthKit é a app escrevê-los, e sem isto o filtro
   * `recordedByUs` descartava-os todos — o teste não provaria nada.
   * Em produção fica sempre false.
   */
  includeOwnWorkouts?: boolean;
}

export function planImport(
  workouts: ExternalWorkout[],
  existing: ActivityWindow[],
  source: HealthSource,
  options: PlanOptions = {},
): PlanResult {
  const jaImportados = new Set(
    existing.map((j) => j.externalId).filter((id): id is string => !!id),
  );

  const skipped: Record<SkipReason, number> = {
    already_imported: 0,
    overlaps_existing: 0,
    recorded_by_us: 0,
    too_short: 0,
    unknown_type: 0,
  };
  const toImport: ImportCandidate[] = [];

  // Dentro do mesmo lote também pode vir o mesmo treino duas vezes.
  const vistosNesteLote = new Set<string>();

  for (const workout of workouts) {
    if (jaImportados.has(workout.externalId) || vistosNesteLote.has(workout.externalId)) {
      skipped.already_imported++;
      continue;
    }
    if (!options.includeOwnWorkouts && recordedByUs(workout)) {
      skipped.recorded_by_us++;
      continue;
    }
    if (workout.duration < MIN_DURATION_SECONDS) {
      skipped.too_short++;
      continue;
    }

    const type = mapWorkoutType(workout.rawType, source);
    if (!type) {
      skipped.unknown_type++;
      continue;
    }

    if (overlapsExisting(workout, existing)) {
      skipped.overlaps_existing++;
      continue;
    }

    vistosNesteLote.add(workout.externalId);
    toImport.push({ workout, type });
  }

  return { toImport, skipped };
}
