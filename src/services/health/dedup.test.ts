import {
  planImport, overlapSeconds, overlapsExisting, recordedByUs, MIN_DURATION_SECONDS,
} from './dedup';
import type { ActivityWindow, ExternalWorkout } from './types';

function workout(overrides: Partial<ExternalWorkout> = {}): ExternalWorkout {
  return {
    externalId: 'hk-1',
    rawType: 'running',
    startTime: '2026-08-03T08:00:00.000Z',
    endTime: '2026-08-03T08:30:00.000Z',
    distance: 6000,
    duration: 1800,
    elevationGain: 40,
    avgHeartRate: 148,
    sourceApp: 'Apple Watch',
    ...overrides,
  };
}

function janela(overrides: Partial<ActivityWindow> = {}): ActivityWindow {
  return {
    startTime: '2026-08-03T08:00:00.000Z',
    endTime: '2026-08-03T08:30:00.000Z',
    source: 'app',
    externalId: null,
    ...overrides,
  };
}

describe('overlapSeconds', () => {
  it('conta os segundos em comum', () => {
    expect(overlapSeconds(
      '2026-08-03T08:00:00Z', '2026-08-03T08:30:00Z',
      '2026-08-03T08:20:00Z', '2026-08-03T08:50:00Z',
    )).toBe(600);
  });

  it('devolve 0 para intervalos que não se tocam', () => {
    expect(overlapSeconds(
      '2026-08-03T08:00:00Z', '2026-08-03T08:30:00Z',
      '2026-08-03T09:00:00Z', '2026-08-03T09:30:00Z',
    )).toBe(0);
  });

  it('devolve 0 quando apenas encostam', () => {
    expect(overlapSeconds(
      '2026-08-03T08:00:00Z', '2026-08-03T08:30:00Z',
      '2026-08-03T08:30:00Z', '2026-08-03T09:00:00Z',
    )).toBe(0);
  });

  it('trata a ausência de fim como instante', () => {
    expect(overlapSeconds(
      '2026-08-03T08:00:00Z', '2026-08-03T08:30:00Z',
      '2026-08-03T08:10:00Z', null,
    )).toBe(0);
  });

  it('não estoira com datas inválidas', () => {
    expect(overlapSeconds('não é data', '2026-08-03T08:30:00Z', '2026-08-03T08:00:00Z', null)).toBe(0);
  });
});

describe('overlapsExisting', () => {
  it('apanha a mesma corrida gravada na app e no relógio', () => {
    // O caso que o id externo nunca apanha: dois registos diferentes do mesmo
    // treino. Para o utilizador é uma corrida só.
    const doRelogio = workout({ startTime: '2026-08-03T08:01:00.000Z', endTime: '2026-08-03T08:29:00.000Z' });
    expect(overlapsExisting(doRelogio, [janela()])).toBe(true);
  });

  it('deixa passar treinos seguidos no mesmo dia', () => {
    const tarde = workout({ startTime: '2026-08-03T18:00:00.000Z', endTime: '2026-08-03T18:30:00.000Z' });
    expect(overlapsExisting(tarde, [janela()])).toBe(false);
  });

  it('julga a sobreposição em proporção, não em minutos absolutos', () => {
    // 10 min em comum decidem num treino de 15 min...
    const curto = workout({
      startTime: '2026-08-03T08:20:00.000Z', endTime: '2026-08-03T08:35:00.000Z', duration: 900,
    });
    expect(overlapsExisting(curto, [janela()])).toBe(true);

    // ...e não decidem num de 3 horas.
    const longo = workout({
      startTime: '2026-08-03T08:20:00.000Z', endTime: '2026-08-03T11:20:00.000Z', duration: 10800,
    });
    expect(overlapsExisting(longo, [janela()])).toBe(false);
  });

  it('não vê sobreposição sem atividades existentes', () => {
    expect(overlapsExisting(workout(), [])).toBe(false);
  });
});

describe('recordedByUs', () => {
  it('reconhece o que a própria app escreveu na Saúde', () => {
    expect(recordedByUs(workout({ sourceApp: 'Cadence Club' }))).toBe(true);
    expect(recordedByUs(workout({ sourceApp: '  cadence  ' }))).toBe(true);
  });

  it('não reclama treinos de outras apps', () => {
    expect(recordedByUs(workout({ sourceApp: 'Strava' }))).toBe(false);
    expect(recordedByUs(workout({ sourceApp: null }))).toBe(false);
  });
});

describe('planImport', () => {
  it('importa um treino novo do relógio', () => {
    const { toImport, skipped } = planImport([workout()], [], 'healthkit');

    expect(toImport).toHaveLength(1);
    expect(toImport[0].type).toBe('run');
    expect(Object.values(skipped).every((n) => n === 0)).toBe(true);
  });

  it('não reimporta o que já tem o mesmo id', () => {
    const existente = [janela({ source: 'healthkit', externalId: 'hk-1' })];
    const { toImport, skipped } = planImport([workout()], existente, 'healthkit');

    expect(toImport).toEqual([]);
    expect(skipped.already_imported).toBe(1);
  });

  it('descarta o mesmo treino repetido dentro do lote', () => {
    const { toImport, skipped } = planImport([workout(), workout()], [], 'healthkit');

    expect(toImport).toHaveLength(1);
    expect(skipped.already_imported).toBe(1);
  });

  it('não reimporta o que a própria app escreveu na Saúde', () => {
    // Sem isto, cada corrida gravada aqui voltava como se viesse do relógio.
    const { toImport, skipped } = planImport(
      [workout({ sourceApp: 'Cadence Club' })], [], 'healthkit',
    );

    expect(toImport).toEqual([]);
    expect(skipped.recorded_by_us).toBe(1);
  });

  it('descarta arranques acidentais de segundos', () => {
    const { toImport, skipped } = planImport(
      [workout({ duration: MIN_DURATION_SECONDS - 1, endTime: '2026-08-03T08:00:59.000Z' })],
      [], 'healthkit',
    );

    expect(toImport).toEqual([]);
    expect(skipped.too_short).toBe(1);
  });

  it('descarta modalidades que a app não representa', () => {
    // Forçar tudo a "workout" estragava as estatísticas e as calorias, que
    // dependem da modalidade.
    const { toImport, skipped } = planImport(
      [workout({ rawType: 'archery' })], [], 'healthkit',
    );

    expect(toImport).toEqual([]);
    expect(skipped.unknown_type).toBe(1);
  });

  it('descarta o que se sobrepõe a uma atividade já gravada', () => {
    const { toImport, skipped } = planImport([workout()], [janela()], 'healthkit');

    expect(toImport).toEqual([]);
    expect(skipped.overlaps_existing).toBe(1);
  });

  it('mapeia os enums numéricos das plataformas', () => {
    // As duas plataformas identificam a modalidade por número. Mapear só
    // nomes não acertaria num único treino real.
    const ios = planImport([workout({ rawType: 37 })], [], 'healthkit');
    expect(ios.toImport[0]?.type).toBe('run');

    // Os números não coincidem entre plataformas: 56 é RUNNING no Health
    // Connect e 8 é BIKING; no HealthKit, 37 é running e 13 é cycling.
    const androidCorrida = planImport([workout({ rawType: 56, externalId: 'hc-1' })], [], 'healthconnect');
    expect(androidCorrida.toImport[0]?.type).toBe('run');

    const androidBike = planImport([workout({ rawType: 8, externalId: 'hc-2' })], [], 'healthconnect');
    expect(androidBike.toImport[0]?.type).toBe('cycle');

    // E o mesmo número significa coisas diferentes em cada plataforma.
    const iosBike = planImport([workout({ rawType: 13, externalId: 'hk-2' })], [], 'healthkit');
    expect(iosBike.toImport[0]?.type).toBe('cycle');
  });

  it('lida com o Health Connect e os seus nomes de modalidade', () => {
    const { toImport } = planImport(
      [workout({ rawType: 'BIKING', externalId: 'hc-1' })], [], 'healthconnect',
    );

    expect(toImport).toHaveLength(1);
    expect(toImport[0].type).toBe('cycle');
  });

  it('separa o que entra do que fica em cada motivo', () => {
    const lote = [
      workout({ externalId: 'a' }),
      workout({ externalId: 'b', sourceApp: 'Cadence Club' }),
      workout({ externalId: 'c', rawType: 'archery' }),
      workout({ externalId: 'd', duration: 10, endTime: '2026-08-03T08:00:10.000Z' }),
      workout({ externalId: 'e' }),
    ];

    const { toImport, skipped } = planImport(lote, [], 'healthkit');

    // 'a' entra; 'e' tem o mesmo horário e sobrepõe-se... mas ainda não
    // existe nada gravado, por isso a sobreposição só é avaliada contra o
    // que já está na base de dados.
    expect(toImport.map((c) => c.workout.externalId)).toEqual(['a', 'e']);
    expect(skipped.recorded_by_us).toBe(1);
    expect(skipped.unknown_type).toBe(1);
    expect(skipped.too_short).toBe(1);
  });

  it('devolve tudo a zero com lote vazio', () => {
    const { toImport, skipped } = planImport([], [janela()], 'healthkit');
    expect(toImport).toEqual([]);
    expect(Object.values(skipped).every((n) => n === 0)).toBe(true);
  });
});
