import { Platform } from 'react-native';
import type { ExternalWorkout, HealthAdapter } from './types';

/**
 * Ligação ao código nativo.
 *
 * Os nomes dos campos foram verificados contra as tipagens instaladas
 * (@kingstinct/react-native-healthkit v14, react-native-health-connect v4).
 * O que continua por verificar é o **comportamento em dispositivo** — ver o
 * README do módulo para os casos a testar à mão.
 *
 * Os módulos são carregados com require() dentro de try, à imagem do que
 * useShareActivity já faz com o expo-media-library: em Expo Go ou num build
 * sem os módulos nativos, `isAvailable()` devolve false em vez de a app
 * rebentar. Um import no topo do ficheiro carregaria o módulo do iOS no
 * Android e vice-versa.
 *
 * O require() tem de ser uma string literal em cada callsite — o Metro
 * analisa o grafo de módulos estaticamente e rejeita require(variável).
 * Por isso `carregar` recebe uma função que faz o require, não o nome.
 */

function carregar(loader: () => any): any | null {
  try {
    const mod = loader();
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/** Quantity do HealthKit: { quantity, unit }. Zero quando não vem. */
function quantidade(q: any): number {
  const n = Number(q?.quantity);
  return Number.isFinite(n) ? n : 0;
}

// ── iOS ──────────────────────────────────────────────────────────────────────

/** ObjectTypeIdentifier — o que pedimos para ler. */
const HEALTHKIT_READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

export const healthKitAdapter: HealthAdapter = {
  source: 'healthkit',

  async isAvailable() {
    if (Platform.OS !== 'ios') return false;
    const HealthKit = carregar(() => require('@kingstinct/react-native-healthkit'));
    if (!HealthKit) return false;
    try {
      // isHealthDataAvailable é síncrono nesta versão; o Async existe também.
      return HealthKit.isHealthDataAvailable() === true;
    } catch {
      return false;
    }
  },

  async hasPermissions() {
    const HealthKit = carregar(() => require('@kingstinct/react-native-healthkit'));
    if (!HealthKit) return false;
    try {
      // A Apple não revela se a LEITURA foi concedida — por design, para não
      // se poder inferir que alguém escondeu um tipo de dados. O melhor que dá
      // é tentar ler: sem permissão vem uma lista vazia, sem erro.
      const amostra = await HealthKit.queryWorkoutSamples({ limit: 1 });
      return Array.isArray(amostra);
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const HealthKit = carregar(() => require('@kingstinct/react-native-healthkit'));
    if (!HealthKit) return false;
    try {
      // requestAuthorization devolve true quando o diálogo foi apresentado,
      // não quando o utilizador aceitou — daí confirmar a seguir com uma
      // leitura real.
      await HealthKit.requestAuthorization({ toRead: HEALTHKIT_READ, toShare: [] });
      return await this.hasPermissions();
    } catch {
      return false;
    }
  },

  async readWorkouts(since: Date): Promise<ExternalWorkout[]> {
    const HealthKit = carregar(() => require('@kingstinct/react-native-healthkit'));
    if (!HealthKit) return [];

    const amostras = await HealthKit.queryWorkoutSamples({
      filter: { startDate: since },
      // limit não é opcional; <= 0 significa "todos".
      limit: 0,
      ascending: true,
    });

    return (amostras ?? []).map((w: any): ExternalWorkout => ({
      externalId: String(w.uuid ?? ''),
      // Enum numérico (running = 37, …). O mapeamento aceita número ou nome.
      rawType: w.workoutActivityType,
      startTime: new Date(w.startDate).toISOString(),
      endTime: new Date(w.endDate).toISOString(),
      distance: quantidade(w.totalDistance),
      duration: quantidade(w.duration),
      elevationGain: quantidade(w.metadata?.HKElevationAscended),
      avgHeartRate: null,
      sourceApp: w.sourceRevision?.source?.name ?? null,
    })).filter((w: ExternalWorkout) => w.externalId);
  },
};

// ── Android ──────────────────────────────────────────────────────────────────

const HEALTH_CONNECT_READ = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
];

/** SdkAvailabilityStatus.SDK_AVAILABLE */
const SDK_AVAILABLE = 3;

export const healthConnectAdapter: HealthAdapter = {
  source: 'healthconnect',

  async isAvailable() {
    if (Platform.OS !== 'android') return false;
    const HC = carregar(() => require('react-native-health-connect'));
    if (!HC) return false;
    try {
      // Os outros valores significam que o Health Connect não está instalado
      // ou precisa de atualização — casos reais em Android abaixo do 14.
      return (await HC.getSdkStatus()) === SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  async hasPermissions() {
    const HC = carregar(() => require('react-native-health-connect'));
    if (!HC) return false;
    try {
      await HC.initialize();
      const concedidas = await HC.getGrantedPermissions();
      return (concedidas ?? []).some((p: any) => p.recordType === 'ExerciseSession');
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const HC = carregar(() => require('react-native-health-connect'));
    if (!HC) return false;
    try {
      await HC.initialize();
      const concedidas = await HC.requestPermission(HEALTH_CONNECT_READ);
      return (concedidas ?? []).some((p: any) => p.recordType === 'ExerciseSession');
    } catch {
      return false;
    }
  },

  async readWorkouts(since: Date): Promise<ExternalWorkout[]> {
    const HC = carregar(() => require('react-native-health-connect'));
    if (!HC) return [];

    await HC.initialize();
    const { records } = await HC.readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: since.toISOString(),
        endTime: new Date().toISOString(),
      },
    });

    return (records ?? []).map((r: any): ExternalWorkout => {
      const inicio = new Date(r.startTime);
      const fim = new Date(r.endTime);
      return {
        externalId: String(r.metadata?.id ?? ''),
        // exerciseType é numérico (RUNNING = 56, BIKING = 8, …).
        rawType: r.exerciseType,
        startTime: inicio.toISOString(),
        endTime: fim.toISOString(),
        // A distância vive num registo Distance separado do ExerciseSession.
        // Sem uma segunda leitura fica a zero, e a app trata isso como treino
        // sem distância em vez de inventar um valor.
        distance: 0,
        duration: Math.max(0, (fim.getTime() - inicio.getTime()) / 1000),
        elevationGain: 0,
        avgHeartRate: null,
        sourceApp: r.metadata?.dataOrigin ?? null,
      };
    }).filter((w: ExternalWorkout) => w.externalId);
  },
};

/** O adaptador da plataforma onde a app está a correr. */
export function currentAdapter(): HealthAdapter | null {
  if (Platform.OS === 'ios') return healthKitAdapter;
  if (Platform.OS === 'android') return healthConnectAdapter;
  return null;
}
