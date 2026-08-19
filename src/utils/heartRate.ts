/**
 * Zonas de treino a partir do batimento cardíaco.
 *
 * É isto que transforma um número solto ("148 bpm") em informação útil: se o
 * treino foi leve, moderado ou duro *para aquela pessoa*. Duas pessoas ao
 * mesmo ritmo podem estar em zonas diferentes, e é isso que o ritmo sozinho
 * nunca diz.
 */

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface ZoneRange {
  zone: HeartRateZone;
  /** Percentagem do máximo em que a zona começa (inclusive). */
  fromPercent: number;
  /** Onde acaba (exclusive, exceto na zona 5). */
  toPercent: number;
  minBpm: number;
  maxBpm: number;
  i18nKey: string;
}

/**
 * Fronteiras das cinco zonas, em percentagem do máximo.
 *
 * Modelo de cinco zonas percentuais, o mais usado e o mais fácil de explicar.
 * Há modelos melhores — os baseados no limiar de lactato são mais precisos —
 * mas exigem um teste de esforço que ninguém aqui vai fazer.
 */
const LIMITES: { zone: HeartRateZone; from: number; to: number; i18nKey: string }[] = [
  { zone: 1, from: 0.50, to: 0.60, i18nKey: 'hr_zone_1' },
  { zone: 2, from: 0.60, to: 0.70, i18nKey: 'hr_zone_2' },
  { zone: 3, from: 0.70, to: 0.80, i18nKey: 'hr_zone_3' },
  { zone: 4, from: 0.80, to: 0.90, i18nKey: 'hr_zone_4' },
  { zone: 5, from: 0.90, to: 1.00, i18nKey: 'hr_zone_5' },
];

/**
 * Máximo estimado a partir da idade.
 *
 * Usa Tanaka (208 − 0,7 × idade) e não o clássico 220 − idade. O 220 − idade
 * nunca foi derivado de dados: apareceu num gráfico dos anos 70 e ficou.
 * Subestima o máximo de quem tem mais de 40 anos, o que empurra essas pessoas
 * para zonas mais altas do que as reais — precisamente ao contrário do que
 * convém a quem está a começar.
 *
 * Continua a ser uma estimativa com uns 10 bpm de desvio. Quem souber o seu
 * valor deve indicá-lo no perfil.
 */
export function estimateMaxHeartRate(ageYears: number): number {
  if (!Number.isFinite(ageYears) || ageYears <= 0) return 190;
  const idade = Math.min(100, Math.max(10, ageYears));
  return Math.round(208 - 0.7 * idade);
}

/** Idade em anos a partir da data de nascimento. Null se não der para saber. */
export function ageFromBirthDate(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const nascimento = new Date(birthDate);
  if (!Number.isFinite(nascimento.getTime())) return null;

  let idade = now.getFullYear() - nascimento.getFullYear();
  const fezAnos =
    now.getMonth() > nascimento.getMonth() ||
    (now.getMonth() === nascimento.getMonth() && now.getDate() >= nascimento.getDate());
  if (!fezAnos) idade--;

  return idade > 0 && idade < 120 ? idade : null;
}

/**
 * Máximo a usar nos cálculos: o medido, se existir; senão o estimado pela
 * idade; senão um valor de recurso.
 */
export function resolveMaxHeartRate(
  profileMax: number | null | undefined,
  birthDate: string | null | undefined,
): number {
  if (profileMax && profileMax >= 120 && profileMax <= 240) return profileMax;
  const idade = ageFromBirthDate(birthDate);
  return idade ? estimateMaxHeartRate(idade) : 190;
}

/** As cinco zonas, já convertidas em batimentos. */
export function heartRateZones(maxHeartRate: number): ZoneRange[] {
  return LIMITES.map(({ zone, from, to, i18nKey }) => ({
    zone,
    fromPercent: from,
    toPercent: to,
    minBpm: Math.round(maxHeartRate * from),
    // A zona acaba um batimento antes da seguinte começar, para não haver
    // um bpm que pertença a duas.
    maxBpm: zone === 5 ? Math.round(maxHeartRate) : Math.round(maxHeartRate * to) - 1,
    i18nKey,
  }));
}

/**
 * Zona de um batimento. Null abaixo dos 50% do máximo — não é treino, é
 * estar sentado, e chamar-lhe "zona 1" dava crédito a quem não o ganhou.
 */
export function zoneForHeartRate(bpm: number, maxHeartRate: number): HeartRateZone | null {
  if (!Number.isFinite(bpm) || bpm <= 0 || maxHeartRate <= 0) return null;
  const fracao = bpm / maxHeartRate;
  if (fracao < LIMITES[0].from) return null;

  for (const limite of LIMITES) {
    if (fracao < limite.to) return limite.zone;
  }
  // Acima do máximo estimado — acontece, e continua a ser zona 5.
  return 5;
}
