import {
  estimateMaxHeartRate, ageFromBirthDate, resolveMaxHeartRate,
  heartRateZones, zoneForHeartRate,
} from './heartRate';

describe('estimateMaxHeartRate', () => {
  it('usa Tanaka, não o 220 menos a idade', () => {
    // 208 − 0,7 × 30 = 187. O clássico daria 190.
    expect(estimateMaxHeartRate(30)).toBe(187);
    expect(estimateMaxHeartRate(50)).toBe(173);
  });

  it('é mais generoso do que o 220 − idade acima dos 40', () => {
    // É a diferença que importa: o 220 − idade subestima quem tem mais idade
    // e empurra essas pessoas para zonas mais altas do que as reais.
    for (const idade of [45, 55, 65]) {
      expect(estimateMaxHeartRate(idade)).toBeGreaterThan(220 - idade);
    }
  });

  it('cai num valor de recurso com idade inválida', () => {
    expect(estimateMaxHeartRate(0)).toBe(190);
    expect(estimateMaxHeartRate(NaN)).toBe(190);
    expect(estimateMaxHeartRate(-5)).toBe(190);
  });

  it('não extrapola para idades absurdas', () => {
    expect(estimateMaxHeartRate(500)).toBe(estimateMaxHeartRate(100));
    expect(estimateMaxHeartRate(2)).toBe(estimateMaxHeartRate(10));
  });
});

describe('ageFromBirthDate', () => {
  const hoje = new Date('2026-08-18T12:00:00.000Z');

  it('conta anos completos', () => {
    expect(ageFromBirthDate('1990-08-18', hoje)).toBe(36);
    expect(ageFromBirthDate('1990-01-01', hoje)).toBe(36);
  });

  it('não conta o ano de quem ainda não fez anos', () => {
    expect(ageFromBirthDate('1990-08-19', hoje)).toBe(35);
    expect(ageFromBirthDate('1990-12-31', hoje)).toBe(35);
  });

  it('devolve null sem data ou com data inválida', () => {
    expect(ageFromBirthDate(null, hoje)).toBeNull();
    expect(ageFromBirthDate(undefined, hoje)).toBeNull();
    expect(ageFromBirthDate('não é data', hoje)).toBeNull();
  });

  it('devolve null para datas impossíveis', () => {
    expect(ageFromBirthDate('2030-01-01', hoje)).toBeNull();  // futuro
    expect(ageFromBirthDate('1850-01-01', hoje)).toBeNull();
  });
});

describe('resolveMaxHeartRate', () => {
  it('prefere o valor medido ao estimado', () => {
    // Quem fez um teste de esforço sabe melhor do que a fórmula.
    expect(resolveMaxHeartRate(195, '1990-01-01')).toBe(195);
  });

  it('estima pela idade quando não há valor medido', () => {
    const idade = ageFromBirthDate('1990-01-01', new Date('2026-08-18'))!;
    expect(resolveMaxHeartRate(null, '1990-01-01')).toBe(estimateMaxHeartRate(idade));
  });

  it('ignora valores medidos fora do plausível', () => {
    expect(resolveMaxHeartRate(40, null)).toBe(190);
    expect(resolveMaxHeartRate(300, null)).toBe(190);
  });

  it('usa o recurso quando não há nem valor nem data', () => {
    expect(resolveMaxHeartRate(null, null)).toBe(190);
  });
});

describe('heartRateZones', () => {
  const zonas = heartRateZones(200);

  it('devolve cinco zonas', () => {
    expect(zonas.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5]);
  });

  it('converte as percentagens em batimentos', () => {
    expect(zonas[0]).toMatchObject({ minBpm: 100, maxBpm: 119 });
    expect(zonas[2]).toMatchObject({ minBpm: 140, maxBpm: 159 });
    expect(zonas[4]).toMatchObject({ minBpm: 180, maxBpm: 200 });
  });

  it('não deixa um batimento pertencer a duas zonas', () => {
    for (let i = 0; i < zonas.length - 1; i++) {
      expect(zonas[i].maxBpm).toBe(zonas[i + 1].minBpm - 1);
    }
  });
});

describe('zoneForHeartRate', () => {
  const max = 200;

  it('classifica cada zona', () => {
    expect(zoneForHeartRate(105, max)).toBe(1);
    expect(zoneForHeartRate(130, max)).toBe(2);
    expect(zoneForHeartRate(150, max)).toBe(3);
    expect(zoneForHeartRate(170, max)).toBe(4);
    expect(zoneForHeartRate(195, max)).toBe(5);
  });

  it('devolve null abaixo de metade do máximo', () => {
    // Estar sentado não é treino, e chamar-lhe "zona 1" dava crédito a quem
    // não o ganhou.
    expect(zoneForHeartRate(70, max)).toBeNull();
    expect(zoneForHeartRate(99, max)).toBeNull();
  });

  it('trata as fronteiras como início da zona seguinte', () => {
    expect(zoneForHeartRate(100, max)).toBe(1);
    expect(zoneForHeartRate(120, max)).toBe(2);
    expect(zoneForHeartRate(180, max)).toBe(5);
  });

  it('continua na zona 5 acima do máximo estimado', () => {
    // A estimativa erra; alguém a bater 210 com máximo estimado de 200 não
    // pode ficar sem zona.
    expect(zoneForHeartRate(215, max)).toBe(5);
  });

  it('devolve null para valores inválidos', () => {
    expect(zoneForHeartRate(0, max)).toBeNull();
    expect(zoneForHeartRate(NaN, max)).toBeNull();
    expect(zoneForHeartRate(150, 0)).toBeNull();
  });
});
