/**
 * Importação de ficheiros de treino (GPX, TCX, FIT).
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

/**
 * Formatos que sabemos ler.
 *
 * O `fit` é binário e os outros dois são XML — quem lê tem de saber a
 * diferença, e é por isso que o `importTrackFile` aceita bytes além de texto.
 */
export type ImportFormat = 'gpx' | 'tcx' | 'fit';

/** Porque é que um ficheiro não deu atividade nenhuma. */
export type ImportFailure =
  | 'unsupported_format'  // extensão que não conhecemos
  | 'malformed'           // não é XML válido, ou não tem a estrutura esperada
  | 'no_points'           // ficheiro válido mas sem pontos de traçado
  | 'no_timestamps'       // pontos sem tempo: é uma rota, não um treino
  // Os dois seguintes são erros de quem chama, não do ficheiro: entregar um
  // FIT como texto (vem corrompido) ou um XML como bytes.
  | 'needs_bytes'
  | 'needs_text';

export interface ImportOutcome {
  /** Quantas atividades entraram. Hoje é sempre 0 ou 1. */
  imported: number;
  /** Descartadas pelas defesas do planImport (já importada, sobreposta…). */
  skipped: number;
  /** Motivo, quando o ficheiro não chegou sequer a ser considerado. */
  failure?: ImportFailure;
  /**
   * A janela da atividade criada, quando houve uma.
   *
   * Serve a quem importa em lote: junta-a às janelas conhecidas e o ficheiro
   * seguinte passa a ser deduplicado contra esta, sem ir à base de dados.
   */
  janela?: import('../health/types').ActivityWindow;
  error?: string;
}

/** Como vai a importação de um arquivo, para a interface mostrar. */
export interface ArchiveProgress {
  /** Ficheiros já processados (importados, descartados ou falhados). */
  done: number;
  total: number;
  imported: number;
}

/**
 * Resultado de importar um arquivo inteiro.
 *
 * Ao contrário de um ficheiro só, aqui interessa a contagem por motivo: num
 * arquivo do Strava é normal haver dezenas de ficheiros sem traçado (treinos
 * de ginásio introduzidos à mão), e isso não é um erro — é informação.
 */
export interface ArchiveOutcome {
  /** Entradas de atividade encontradas no arquivo. */
  total: number;
  imported: number;
  /** Descartadas pelas defesas: já lá estavam, ou sobrepõem-se. */
  skipped: number;
  failed: number;
  /** Quantas falharam por cada motivo. */
  failures: Partial<Record<ImportFailure, number>>;
  /** O utilizador interrompeu a meio. O que entrou até aí fica. */
  cancelled: boolean;
  error?: string;
}
