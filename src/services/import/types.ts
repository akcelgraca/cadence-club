/**
 * Importação de ficheiros de treino (GPX, TCX).
 *
 * PORQUÊ ISTO EXISTE: sem importar histórico, mudar do Strava custa ao
 * utilizador todas as atividades que já tem. É a barreira número um à adoção.
 *
 * O QUE REAPROVEITA: quase tudo. Um ficheiro é convertido em `ExternalWorkout`
 * e entregue ao `planImport` do módulo de saúde, que já sabe deduplicar (por
 * id externo e por sobreposição temporal), mapear modalidades e descartar
 * treinos curtos demais. Essa parte tem 22 testes e foi validada em simulador.
 *
 * O QUE ACRESCENTA: o traçado. A sincronização com a Saúde nunca traz pontos
 * de GPS — ficam no relógio — e por isso as atividades importadas de lá não
 * têm mapa, splits nem deteção de troços. Um ficheiro GPX traz os pontos
 * todos, portanto uma atividade importada de ficheiro é tão completa como uma
 * gravada na app. Também passa a estar sujeita às zonas de privacidade, o que
 * está certo.
 */

/** Um ponto do traçado, tal como vem do ficheiro. */
export interface TrackPoint {
  lat: number;
  lng: number;
  /** Metros. Null quando o ficheiro não traz altimetria. */
  elevation: number | null;
  /** Batimento no instante do ponto, quando o ficheiro o traz. */
  heartRate: number | null;
  /** ISO 8601. Null em ficheiros sem tempos (rotas, não treinos). */
  time: string | null;
}

/** O que se consegue tirar de um ficheiro, antes de virar treino. */
export interface ParsedTrack {
  /** Nome da atividade, quando o ficheiro o traz. */
  name: string | null;
  /**
   * Modalidade tal como está escrita no ficheiro ("running", "9", "Ride"…).
   * Null quando não é declarada — nesse caso assume-se corrida, que é o caso
   * mais comum e o que o utilizador consegue corrigir depois.
   */
  rawType: string | null;
  points: TrackPoint[];
  /**
   * Distância declarada no ficheiro, em metros. O TCX costuma trazê-la; o GPX
   * quase nunca. Quando existe é preferível à calculada, porque o dispositivo
   * que gravou sabia mais do que nós (roda, passada, filtros).
   */
  declaredDistance: number | null;
}

/** Formatos que sabemos ler. */
export type ImportFormat = 'gpx' | 'tcx';

/** Porque é que um ficheiro não deu atividade nenhuma. */
export type ImportFailure =
  | 'unsupported_format'  // extensão que não conhecemos
  | 'malformed'           // não é XML válido, ou não tem a estrutura esperada
  | 'no_points'           // ficheiro válido mas sem pontos de traçado
  | 'no_timestamps';      // pontos sem tempo: é uma rota, não um treino

export interface ImportOutcome {
  /** Quantas atividades entraram. Hoje é sempre 0 ou 1. */
  imported: number;
  /** Descartadas pelas defesas do planImport (já importada, sobreposta…). */
  skipped: number;
  /** Motivo, quando o ficheiro não chegou sequer a ser considerado. */
  failure?: ImportFailure;
  error?: string;
}
