import type { ActivityType } from '../../lib/types';
import type { ImportSource, HealthSource } from './types';

/**
 * Tradução das modalidades das plataformas para as da app.
 *
 * As duas plataformas identificam a modalidade por **número**, não por nome:
 * `HKWorkoutActivityType` no iOS e `ExerciseType` no Android. Os valores estão
 * aqui em duro de propósito — são contrato público das plataformas e não
 * mudam, e importar os enums obrigaria a carregar o módulo nativo só para
 * mapear, o que rebenta na plataforma errada e nos testes.
 *
 * Os nomes ficam também mapeados porque nem todos os wrappers de JS devolvem
 * o número: alguns entregam a chave do enum já convertida.
 *
 * Só mapeamos o que a app sabe representar. Uma modalidade desconhecida é
 * descartada em vez de forçada a "workout" — inventar o tipo estraga as
 * estatísticas e o cálculo de calorias, que depende da modalidade.
 */

/** HKWorkoutActivityType — @kingstinct/react-native-healthkit, healthkit.generated */
const HEALTHKIT_BY_NUMBER: Record<number, ActivityType> = {
  13: 'cycle',            // cycling
  24: 'walk',             // hiking
  35: 'rowing',           // rowing
  37: 'run',              // running
  46: 'swimming',         // swimming
  48: 'tennis',           // tennis
  52: 'walk',             // walking
  57: 'yoga',             // yoga
};

const HEALTHKIT_BY_NAME: Record<string, ActivityType> = {
  running: 'run',
  walking: 'walk',
  hiking: 'walk',
  cycling: 'cycle',
  swimming: 'swimming',
  rowing: 'rowing',
  paddleSports: 'kayak',
  surfingSports: 'surf',
  traditionalStrengthTraining: 'weight_training',
  functionalStrengthTraining: 'weight_training',
  highIntensityIntervalTraining: 'hiit',
  crossTraining: 'crossfit',
  yoga: 'yoga',
  pilates: 'pilates',
  dance: 'dance',
  cardioDance: 'dance',
  tennis: 'tennis',
  badminton: 'badminton',
  squash: 'squash',
  tableTennis: 'table_tennis',
  soccer: 'football',
  basketball: 'basketball',
  volleyball: 'volleyball',
  snowboarding: 'snowboard',
  downhillSkiing: 'alpine_skiing',
  skatingSports: 'ice_skating',
  sailing: 'sailing',
  wheelchairRunPace: 'wheelchair',
  wheelchairWalkPace: 'wheelchair',
};

/** ExerciseType — react-native-health-connect, constants.d.ts */
const HEALTH_CONNECT_BY_NUMBER: Record<number, ActivityType> = {
  2: 'badminton',
  5: 'basketball',
  8: 'cycle',             // BIKING
  9: 'cycle',             // BIKING_STATIONARY
  16: 'dance',            // DANCING
  36: 'hiit',
  37: 'walk',             // HIKING
  39: 'ice_skating',
  46: 'kayak',            // PADDLING
  48: 'pilates',
  53: 'rowing',
  54: 'rowing',           // ROWING_MACHINE
  56: 'run',              // RUNNING
  57: 'run',              // RUNNING_TREADMILL
  58: 'sailing',
  61: 'alpine_skiing',    // SKIING
  62: 'snowboard',
  64: 'football',         // SOCCER
  66: 'squash',
  70: 'weight_training',  // STRENGTH_TRAINING
  72: 'surf',             // SURFING
  73: 'swimming',         // SWIMMING_OPEN_WATER
  74: 'swimming',         // SWIMMING_POOL
  75: 'table_tennis',
  76: 'tennis',
  78: 'volleyball',
  79: 'walk',             // WALKING
  81: 'weight_training',  // WEIGHTLIFTING
  82: 'wheelchair',
  83: 'yoga',
};

const HEALTH_CONNECT_BY_NAME: Record<string, ActivityType> = {
  RUNNING: 'run',
  RUNNING_TREADMILL: 'run',
  WALKING: 'walk',
  HIKING: 'walk',
  BIKING: 'cycle',
  BIKING_STATIONARY: 'cycle',
  SWIMMING_POOL: 'swimming',
  SWIMMING_OPEN_WATER: 'swimming',
  ROWING: 'rowing',
  ROWING_MACHINE: 'rowing',
  PADDLING: 'kayak',
  SURFING: 'surf',
  STRENGTH_TRAINING: 'weight_training',
  WEIGHTLIFTING: 'weight_training',
  HIGH_INTENSITY_INTERVAL_TRAINING: 'hiit',
  YOGA: 'yoga',
  PILATES: 'pilates',
  DANCING: 'dance',
  TENNIS: 'tennis',
  BADMINTON: 'badminton',
  SQUASH: 'squash',
  TABLE_TENNIS: 'table_tennis',
  SOCCER: 'football',
  BASKETBALL: 'basketball',
  VOLLEYBALL: 'volleyball',
  SNOWBOARDING: 'snowboard',
  SKIING: 'alpine_skiing',
  ICE_SKATING: 'ice_skating',
  SAILING: 'sailing',
  WHEELCHAIR: 'wheelchair',
};

/**
 * Modalidades escritas em ficheiros GPX e TCX.
 *
 * Aqui não há enums: são cadeias livres, e cada exportador escreve à sua
 * maneira. O Strava põe "running"/"cycling" no `<type>` do GPX; o Garmin põe
 * "Running"/"Biking" no atributo `Sport` do TCX; e há exportadores que metem
 * o número do Strava ("9") ou frases inteiras.
 *
 * A normalização do `mapWorkoutType` (minúsculas, sem espaços nem hífenes)
 * trata das variações de caixa, por isso as chaves aqui ficam em minúsculas.
 */
const FILE_BY_NAME: Record<string, ActivityType> = {
  running: 'run',
  run: 'run',
  jogging: 'run',
  trailrunning: 'trail_run',
  trailrun: 'trail_run',
  walking: 'walk',
  walk: 'walk',
  hiking: 'walk',
  hike: 'walk',
  cycling: 'cycle',
  biking: 'cycle',
  bike: 'cycle',
  ride: 'cycle',
  road_biking: 'cycle',
  ebikeride: 'ebike',
  mountainbiking: 'mtb',
  mountainbikeride: 'mtb',
  swimming: 'swimming',
  swim: 'swimming',
  rowing: 'rowing',
  kayaking: 'kayak',
  canoeing: 'canoeing',
  standuppaddling: 'stand_up_paddle',
  surfing: 'surf',
  sailing: 'sailing',
  snowboarding: 'snowboard',
  alpineski: 'alpine_skiing',
  iceskate: 'ice_skating',
  yoga: 'yoga',
  workout: 'workout',
  weighttraining: 'weight_training',
  crossfit: 'crossfit',
  pilates: 'pilates',
  dance: 'dance',
  skateboarding: 'skateboard',
  wheelchair: 'wheelchair',
  football: 'football',
  soccer: 'football',
  basketball: 'basketball',
  volleyball: 'volleyball',
  tennis: 'tennis',
  padel: 'padel',
  squash: 'squash',
  badminton: 'badminton',
};

/**
 * Modalidade da app para um treino externo, ou null se não soubermos
 * representá-la.
 *
 * Aceita número ou nome porque as bibliotecas divergem — e porque um número
 * chegado como string ("56") também tem de funcionar.
 */
/**
 * O caminho inverso: modalidade da app → o número que cada plataforma espera.
 *
 * Não se deriva dos mapas de leitura por inversão, e de propósito: eles são
 * **muitos-para-um** (o `56 RUNNING` e o `57 RUNNING_TREADMILL` dão os dois
 * `run`), portanto inverter obrigava a escolher um e a escolha ficaria
 * escondida numa expressão. Aqui está escrita.
 *
 * Escolhe-se sempre a variante de **exterior**: é o que a app grava, porque
 * grava por GPS.
 *
 * O que não estiver aqui não é escrito na Saúde. Forçar um tipo genérico
 * poluía o histórico de saúde de alguém com treinos mal classificados — e esse
 * histórico não é nosso para estragar.
 */
const APP_PARA_HEALTHKIT: Partial<Record<ActivityType, number>> = {
  cycle: 13,
  ebike: 13,
  mtb: 13,
  walk: 52,
  stroll: 52,
  rowing: 35,
  run: 37,
  trail_run: 37,
  swimming: 46,
  tennis: 48,
  yoga: 57,
};

const APP_PARA_HEALTH_CONNECT: Partial<Record<ActivityType, number>> = {
  badminton: 2,
  basketball: 5,
  cycle: 8,
  ebike: 8,
  mtb: 8,
  dance: 16,
  hiit: 36,
  ice_skating: 39,
  kayak: 46,
  pilates: 48,
  rowing: 53,
  run: 56,
  trail_run: 56,
  sailing: 58,
  alpine_skiing: 61,
  snowboard: 62,
  football: 64,
  squash: 66,
  weight_training: 70,
  surf: 72,
  swimming: 73,
  table_tennis: 75,
  tennis: 76,
  volleyball: 78,
  walk: 79,
  stroll: 79,
  wheelchair: 82,
  yoga: 83,
};

/**
 * O número da plataforma para uma modalidade da app, ou `null` se não houver.
 *
 * `null` significa "não escrever". Ver o comentário acima: um tipo forçado é
 * pior do que a ausência do registo.
 */
export function tipoParaPlataforma(tipo: ActivityType, destino: HealthSource): number | null {
  const mapa = destino === 'healthkit' ? APP_PARA_HEALTHKIT : APP_PARA_HEALTH_CONNECT;
  return mapa[tipo] ?? null;
}

export function mapWorkoutType(
  rawType: number | string,
  source: ImportSource,
): ActivityType | null {
  const deFicheiro = source === 'gpx' || source === 'tcx' || source === 'fit';

  // Ficheiros não trazem enums numéricos que valha a pena traduzir: um número
  // sozinho num GPX não tem tabela conhecida. Fica só o mapa por nome.
  const porNumero = deFicheiro
    ? {}
    : source === 'healthkit' ? HEALTHKIT_BY_NUMBER : HEALTH_CONNECT_BY_NUMBER;
  const porNome = deFicheiro
    ? FILE_BY_NAME
    : source === 'healthkit' ? HEALTHKIT_BY_NAME : HEALTH_CONNECT_BY_NAME;

  if (typeof rawType === 'number') return porNumero[rawType] ?? null;

  // String que é mesmo um número.
  if (/^\d+$/.test(rawType)) return porNumero[Number(rawType)] ?? null;

  const direto = porNome[rawType];
  if (direto) return direto;

  const normalizado = rawType.toLowerCase().replace(/[_\s-]/g, '');
  for (const [chave, tipo] of Object.entries(porNome)) {
    if (chave.toLowerCase().replace(/[_\s-]/g, '') === normalizado) return tipo;
  }
  return null;
}
