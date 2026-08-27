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

/**
 * Batimento arredondado, ou null.
 *
 * A CHECK da base de dados só aceita 30-240; valores fora disso são artefactos
 * do sensor e não vale a pena guardá-los.
 */
function arredondaBpm(q: any): number | null {
  const n = Number(q?.quantity);
  if (!Number.isFinite(n)) return null;
  const bpm = Math.round(n);
  return bpm >= 30 && bpm <= 240 ? bpm : null;
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

/**
 * HKAuthorizationRequestStatus.unnecessary — o diálogo já foi apresentado.
 * Os outros valores são `unknown = 0` e `shouldRequest = 1`. Fica em número
 * literal de propósito: importar o enum obrigava a carregar a biblioteca no
 * topo do ficheiro, e todo o módulo depende de ela ser carregada só quando
 * existe (ver `carregar`).
 */
const AUTH_REQUEST_UNNECESSARY = 2;

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
      // se poder inferir que alguém escondeu um tipo de dados. O que revela é
      // se ainda FALTA perguntar, e isso chega para o caso que interessa:
      // nunca dizer "ligado" a quem nunca foi perguntado.
      //
      // A versão anterior fazia `Array.isArray(await queryWorkoutSamples())`,
      // que devolvia true SEMPRE — sem permissão vem lista vazia, e uma lista
      // vazia continua a ser um array. Era o defeito do stub antigo por outra
      // via.
      //
      // O que isto continua a NÃO apanhar: quem concedeu e depois revogou.
      // O estado passa a `unnecessary` na mesma, e a leitura devolve vazio,
      // indistinguível de "não há treinos". Esse caso não é detetável em iOS;
      // trata-se na interface, com a dica em `health_sync_check_permissions`.
      const status = await HealthKit.getRequestStatusForAuthorization({
        toRead: HEALTHKIT_READ,
        toShare: [],
      });
      return status === AUTH_REQUEST_UNNECESSARY;
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

    // O batimento vem por treino, numa chamada extra a cada um. Falhar aqui
    // não pode perder o treino — sem batimento a atividade entra na mesma.
    const comBatimento = await Promise.all(
      (amostras ?? []).map(async (w: any) => {
        try {
          const hr = await w.getStatistic?.('HKQuantityTypeIdentifierHeartRate', 'count/min');
          return {
            avg: arredondaBpm(hr?.averageQuantity),
            max: arredondaBpm(hr?.maximumQuantity),
          };
        } catch {
          return { avg: null, max: null };
        }
      }),
    );

    return (amostras ?? []).map((w: any, i: number): ExternalWorkout => ({
      externalId: String(w.uuid ?? ''),
      // Enum numérico (running = 37, …). O mapeamento aceita número ou nome.
      rawType: w.workoutActivityType,
      startTime: new Date(w.startDate).toISOString(),
      endTime: new Date(w.endDate).toISOString(),
      distance: quantidade(w.totalDistance),
      duration: quantidade(w.duration),
      elevationGain: quantidade(w.metadata?.HKElevationAscended),
      avgHeartRate: comBatimento[i]?.avg ?? null,
      maxHeartRate: comBatimento[i]?.max ?? null,
      sourceApp: w.sourceRevision?.source?.name ?? null,
    })).filter((w: ExternalWorkout) => w.externalId);
  },
};

// ── Android ──────────────────────────────────────────────────────────────────

/**
 * Média e máximo das amostras de batimento dentro de um intervalo.
 *
 * Exportada para ser testável: é a única parte do adaptador do Android que
 * tem lógica a sério, e é fácil de enganar — amostras fora do intervalo do
 * treino contaminariam a média com batimentos de repouso.
 */
export function resumoBatimento(
  amostras: { t: number; bpm: number }[],
  inicioMs: number,
  fimMs: number,
): { avg: number | null; max: number | null } {
  const dentro = amostras.filter((a) => a.t >= inicioMs && a.t <= fimMs && a.bpm >= 30 && a.bpm <= 240);
  if (dentro.length === 0) return { avg: null, max: null };

  const soma = dentro.reduce((s, a) => s + a.bpm, 0);
  return {
    avg: Math.round(soma / dentro.length),
    max: Math.round(Math.max(...dentro.map((a) => a.bpm))),
  };
}

/**
 * Metros, a partir do que o Health Connect devolver.
 *
 * O valor chega como `{ value, unit }` — a biblioteca aceita metros,
 * quilómetros, milhas e pés. Assumir metros funcionaria até ao dia em que uma
 * app escrevesse em quilómetros, e aí uma maratona entrava como 42 metros: um
 * número absurdo mas plausível o suficiente para ninguém reparar numa lista.
 */
export function metrosDe(distancia: any): number {
  if (typeof distancia === 'number') return distancia;
  const valor = Number(distancia?.value);
  if (!Number.isFinite(valor)) return 0;
  switch (String(distancia?.unit ?? 'meters').toLowerCase()) {
    case 'kilometers': case 'km': return valor * 1000;
    case 'miles': case 'mi': return valor * 1609.344;
    case 'feet': case 'ft': return valor * 0.3048;
    default: return valor;   // metros
  }
}

/**
 * Distância percorrida dentro de um intervalo, em metros.
 *
 * O Health Connect guarda a distância em registos `Distance` **separados** do
 * `ExerciseSession` — daí ela ter ficado a zero desde que a sincronização
 * existe. Cada registo é um troço com início, fim e total, e uma sessão de
 * corrida costuma ter dezenas deles.
 *
 * **A parte que engana é a sobreposição.** Um registo pode começar antes do
 * treino ou acabar depois — quem carrega no "iniciar" três segundos atrasado
 * produz exatamente isso. Contá-lo inteiro atribuía a este treino metros
 * percorridos noutro, e dois treinos seguidos somariam mais do que a pessoa
 * andou. Conta-se **a fração sobreposta**, assumindo velocidade constante
 * dentro do troço, que é o mais que se pode assumir sem inventar.
 *
 * Exportada para ser testável: é lógica a sério e é fácil de enganar.
 */
export function distanciaNoIntervalo(
  registos: { inicio: number; fim: number; metros: number }[],
  inicioMs: number,
  fimMs: number,
): number {
  let total = 0;
  for (const r of registos) {
    if (!Number.isFinite(r.metros) || r.metros <= 0) continue;

    const duracao = r.fim - r.inicio;

    // Um registo instantâneo (início igual ao fim) não dá para repartir, e tem
    // de ser tratado ANTES da sobreposição: para ele `ate === de`, e a guarda
    // de baixo descartá-lo-ia. O comentário dizia que contava inteiro e o
    // código descartava-o — apanhado por um teste que exercia esse caso.
    if (duracao <= 0) {
      if (r.inicio >= inicioMs && r.inicio <= fimMs) total += r.metros;
      continue;
    }

    const de = Math.max(r.inicio, inicioMs);
    const ate = Math.min(r.fim, fimMs);
    if (ate <= de) continue;  // não se tocam

    total += r.metros * ((ate - de) / duracao);
  }
  return Math.round(total);
}

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
    const agora = new Date().toISOString();
    const janela = {
      operator: 'between' as const,
      startTime: since.toISOString(),
      endTime: agora,
    };

    const { records } = await HC.readRecords('ExerciseSession', { timeRangeFilter: janela });

    // O batimento vive num registo HeartRate separado do ExerciseSession, com
    // as amostras todas do período. Lê-se uma vez e reparte-se pelos treinos
    // conforme o intervalo de cada um — ler por treino seriam N chamadas.
    let amostrasHr: { t: number; bpm: number }[] = [];
    try {
      const hr = await HC.readRecords('HeartRate', { timeRangeFilter: janela });
      amostrasHr = (hr.records ?? []).flatMap((r: any) =>
        (r.samples ?? []).map((a: any) => ({
          t: new Date(a.time).getTime(),
          bpm: Number(a.beatsPerMinute),
        })),
      ).filter((a: any) => Number.isFinite(a.t) && Number.isFinite(a.bpm));
    } catch {
      // Sem permissão de batimento, os treinos entram sem ele.
    }

    // A distância vive em registos `Distance` separados, com a mesma forma: uma
    // leitura para a janela toda, repartida depois por treino. Ler por treino
    // seriam N chamadas à ponte nativa.
    let registosDistancia: { inicio: number; fim: number; metros: number }[] = [];
    try {
      const d = await HC.readRecords('Distance', { timeRangeFilter: janela });
      registosDistancia = (d.records ?? [])
        .map((r: any) => ({
          inicio: new Date(r.startTime).getTime(),
          fim: new Date(r.endTime).getTime(),
          // O valor vem com unidade declarada. Assumir metros seria ler um
          // maratona de 42 km como 42 metros no dia em que viesse em km.
          metros: metrosDe(r.distance),
        }))
        .filter((r: any) => Number.isFinite(r.inicio) && Number.isFinite(r.fim));
    } catch {
      // Sem permissão de distância, fica a zero — como antes desta alteração.
    }

    return (records ?? []).map((r: any): ExternalWorkout => {
      const inicio = new Date(r.startTime);
      const fim = new Date(r.endTime);
      const { avg, max } = resumoBatimento(amostrasHr, inicio.getTime(), fim.getTime());
      return {
        externalId: String(r.metadata?.id ?? ''),
        // exerciseType é numérico (RUNNING = 56, BIKING = 8, …).
        rawType: r.exerciseType,
        startTime: inicio.toISOString(),
        endTime: fim.toISOString(),
        distance: distanciaNoIntervalo(registosDistancia, inicio.getTime(), fim.getTime()),
        duration: Math.max(0, (fim.getTime() - inicio.getTime()) / 1000),
        elevationGain: 0,
        avgHeartRate: avg,
        maxHeartRate: max,
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
