import { Platform } from 'react-native';

/**
 * Escreve treinos falsos no HealthKit, para poder testar a importação no
 * simulador.
 *
 * PORQUÊ ISTO EXISTE: um Apple Watch não se emparelha com o simulador. O
 * simulador de watchOS tem um armazém de HealthKit próprio que não sincroniza
 * com o do iPhone simulado, não há comando `simctl` para injetar dados de
 * saúde, e a app Saúde não deixa acrescentar treinos à mão. A única forma de
 * pôr um treino no HealthKit do simulador é a app escrevê-lo.
 *
 * O QUE ISTO PROVA: o caminho de leitura inteiro — assinatura da query, nomes
 * dos campos, os enums numéricos de modalidade, o desembrulhar dos `Quantity`,
 * as datas, e a escrita na base de dados.
 *
 * O QUE NÃO PROVA: os dados que um relógio a sério produz. Um treino escrito
 * por nós tem `sourceApp` desta app, não do relógio; não traz a metadata de
 * elevação que o Watch põe; e não exercita o `recordedByUs` no sentido
 * correto. Para isso é mesmo preciso um dispositivo com um relógio.
 *
 * Só corre em __DEV__.
 */

/** HKWorkoutActivityType — os mesmos números que o mapping.ts traduz. */
const TIPOS = {
  running: 37,
  cycling: 13,
  walking: 52,
  yoga: 57,
  /** Não mapeado de propósito: serve para ver o motivo "modalidade desconhecida". */
  archery: 2,
} as const;

export interface SeedResult {
  created: number;
  error?: string;
}

function carregar(): any | null {
  try {
    const mod = require('@kingstinct/react-native-healthkit');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria cinco treinos escalonados nos últimos dias.
 *
 * A composição é deliberada — cobre os casos que o README manda testar:
 *   • corrida e bicicleta com distância → devem entrar
 *   • ioga sem distância               → deve entrar com distance 0
 *   • tiro com arco                    → deve ser descartado (modalidade)
 *   • corrida de 30 segundos           → deve ser descartado (curto demais)
 */
export async function seedHealthKitWorkouts(): Promise<SeedResult> {
  if (!__DEV__) return { created: 0, error: 'só disponível em desenvolvimento' };
  if (Platform.OS !== 'ios') return { created: 0, error: 'só no iOS' };

  const HealthKit = carregar();
  if (!HealthKit) return { created: 0, error: 'módulo do HealthKit não disponível' };

  try {
    // Escrever exige permissão de partilha, que o fluxo normal não pede —
    // a app só lê. O seeder pede-a à parte.
    await HealthKit.requestAuthorization({
      toRead: ['HKWorkoutTypeIdentifier'],
      toShare: ['HKWorkoutTypeIdentifier'],
    });

    const agora = Date.now();
    const hora = 60 * 60 * 1000;
    const dia = 24 * hora;

    const receitas = [
      { tipo: TIPOS.running, hasAtras: dia * 1, minutos: 30, metros: 6000 },
      { tipo: TIPOS.cycling, hasAtras: dia * 2, minutos: 60, metros: 25000 },
      { tipo: TIPOS.yoga, hasAtras: dia * 3, minutos: 45, metros: 0 },
      { tipo: TIPOS.archery, hasAtras: dia * 4, minutos: 40, metros: 0 },
      { tipo: TIPOS.running, hasAtras: dia * 5, minutos: 0.5, metros: 100 },
    ];

    let criados = 0;
    for (const r of receitas) {
      const fim = new Date(agora - r.hasAtras);
      const inicio = new Date(fim.getTime() - r.minutos * 60 * 1000);

      await HealthKit.saveWorkoutSample(
        r.tipo,
        [],
        inicio,
        fim,
        r.metros > 0 ? { distance: r.metros } : undefined,
      );
      criados++;
    }

    return { created: criados };
  } catch (err: any) {
    return { created: 0, error: err?.message ?? 'erro desconhecido' };
  }
}
