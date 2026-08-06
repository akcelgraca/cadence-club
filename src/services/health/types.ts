import type { ActivityType } from '../../lib/types';

/**
 * Um treino lido do HealthKit ou do Health Connect, já normalizado.
 *
 * Os dois sistemas têm formatos diferentes; os adaptadores traduzem para isto
 * e tudo o resto — mapeamento, deduplicação, importação — trabalha só sobre
 * esta forma. É o que permite testar a parte que interessa sem um dispositivo.
 */
export interface ExternalWorkout {
  /** HKWorkout.uuid no iOS, metadata.id no Android. Chave da deduplicação. */
  externalId: string;
  /**
   * Tipo tal como vem da plataforma. As duas usam enums **numéricos**
   * (HKWorkoutActivityType, ExerciseType), mas há wrappers que entregam o
   * nome — o mapeamento aceita as duas formas.
   */
  rawType: number | string;
  startTime: string;
  endTime: string;
  /** Metros. Zero em modalidades sem distância. */
  distance: number;
  /** Segundos. */
  duration: number;
  /** Metros de subida acumulada, quando a plataforma os der. */
  elevationGain: number;
  /** Batimento médio, quando existir. */
  avgHeartRate: number | null;
  /**
   * Nome da app que gravou o treino.
   * Serve para não reimportar o que a própria app escreveu na Saúde.
   */
  sourceApp: string | null;
}

export type HealthSource = 'healthkit' | 'healthconnect';

/**
 * O que um adaptador de plataforma tem de saber fazer.
 *
 * Manter isto pequeno é deliberado: é a única parte que depende de código
 * nativo e que não consigo verificar sem dispositivo. Tudo o que puder viver
 * fora daqui, vive.
 */
export interface HealthAdapter {
  readonly source: HealthSource;
  /** O módulo nativo existe e a plataforma suporta-o? */
  isAvailable(): Promise<boolean>;
  /** Já temos permissão de leitura concedida? */
  hasPermissions(): Promise<boolean>;
  /** Pede permissão. Devolve se ficou concedida. */
  requestPermissions(): Promise<boolean>;
  /** Treinos começados a partir de `since`. */
  readWorkouts(since: Date): Promise<ExternalWorkout[]>;
}

/** Janela de uma atividade já registada, para detetar sobreposições. */
export interface ActivityWindow {
  startTime: string;
  endTime: string | null;
  source: string;
  externalId: string | null;
}

export interface ImportCandidate {
  workout: ExternalWorkout;
  type: ActivityType;
}

export interface SyncOutcome {
  imported: number;
  skipped: number;
  /** Motivo por que cada um foi descartado — útil para perceber queixas. */
  skippedReasons: Record<SkipReason, number>;
  error?: string;
}

export type SkipReason =
  | 'already_imported'   // mesmo external_id
  | 'overlaps_existing'  // já existe uma atividade no mesmo intervalo
  | 'recorded_by_us'     // foi a própria app que escreveu isto na Saúde
  | 'too_short'          // ruído: treinos de segundos
  | 'unknown_type';      // modalidade que a app não representa
