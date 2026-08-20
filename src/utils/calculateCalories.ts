import type { Activity } from '../lib/types';

/**
 * Returns MET (Metabolic Equivalent of Task) for a given activity type and pace/speed.
 * Reference: 2011 Compendium of Physical Activities
 */
function getMET(activity: Activity): number {
  const durationHours = activity.duration / 3600;
  if (durationHours <= 0) return 7; // fallback

  const speedKmh = (activity.distance / 1000) / durationHours; // km/h
  const paceMinPerKm = activity.avg_pace ? activity.avg_pace / 60 : 60 / (speedKmh || 0.001);

  switch (activity.type) {
    case 'run':
    case 'trail_run': {
      // MET based on running pace
      if (paceMinPerKm < 4) return 14;
      if (paceMinPerKm < 5) return 13;
      if (paceMinPerKm < 6) return 11;
      if (paceMinPerKm < 7) return 9.8;
      if (paceMinPerKm < 8) return 8.3;
      return 7;
    }
    case 'walk': {
      // Walking MET based on speed
      if (speedKmh < 3.2) return 2.5;
      if (speedKmh < 5.6) return 3.5;
      if (speedKmh < 6.4) return 4.3;
      return 5;
    }
    case 'cycle': {
      // Cycling MET based on speed
      if (speedKmh < 16) return 4;
      if (speedKmh < 19) return 6;
      if (speedKmh < 22) return 8;
      if (speedKmh < 26) return 10;
      if (speedKmh < 30) return 12;
      return 14;
    }
    default:
      return 7;
  }
}

/** Dados da pessoa que tornam a estimativa melhor, quando existirem. */
export interface CalorieContext {
  /** Batimento médio da atividade. É o que distingue esforço de ritmo. */
  avgHeartRate?: number | null;
  ageYears?: number | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
}

/**
 * Calorias por minuto a partir do batimento — fórmula de Keytel (2005).
 *
 * Porquê usar isto quando há batimento: o MET olha só para a modalidade e o
 * ritmo, e assume que toda a gente gasta o mesmo a correr a 5'30". Não gasta.
 * O batimento mede o esforço real da pessoa, e é por isso que a estimativa
 * por MET é a menos fiável das duas.
 *
 * Limites, para não se levar isto demasiado a sério: Keytel foi derivada de
 * uma amostra pequena, em exercício submáximo e em estado estável. Continua a
 * ser uma estimativa — melhor do que o MET, longe de uma medição.
 *
 * Precisa de sexo biológico, que nem toda a gente indica. Sem ele usa-se a
 * média das duas fórmulas, em vez de assumir uma.
 */
function keytelCaloriesPerMinute(
  bpm: number, weightKg: number, ageYears: number,
  gender: CalorieContext['gender'],
): number {
  const homem = (-55.0969 + 0.6309 * bpm + 0.1988 * weightKg + 0.2017 * ageYears) / 4.184;
  const mulher = (-20.4022 + 0.4472 * bpm - 0.1263 * weightKg + 0.0740 * ageYears) / 4.184;

  if (gender === 'male') return homem;
  if (gender === 'female') return mulher;
  return (homem + mulher) / 2;
}

/**
 * Calorias de uma atividade.
 *
 * Usa o batimento quando o há e a idade é conhecida; caso contrário cai no
 * MET × peso × horas, que é o que se consegue sem sensor.
 */
export function calculateActivityCalories(
  activity: Activity,
  weightKg: number,
  context: CalorieContext = {},
): number {
  const durationHours = activity.duration / 3600;
  if (durationHours <= 0) return 0;

  const { avgHeartRate, ageYears, gender } = context;
  if (avgHeartRate && avgHeartRate > 0 && ageYears && ageYears > 0) {
    const porMinuto = keytelCaloriesPerMinute(avgHeartRate, weightKg, ageYears, gender);
    // Keytel devolve valores negativos em batimentos de repouso — nesse caso
    // não houve esforço a contabilizar, e o MET é melhor palpite.
    if (porMinuto > 0) return porMinuto * (activity.duration / 60);
  }

  return getMET(activity) * weightKg * durationHours;
}

/** O que da pessoa não muda entre atividades. */
export interface PersonContext {
  ageYears?: number | null;
  gender?: CalorieContext['gender'];
}

/**
 * Soma as calorias de uma lista de atividades.
 *
 * **É o único sítio que soma calorias.** Antes havia duas contas diferentes
 * para a mesma coisa: esta, por modalidade, e uma no cartão semanal que
 * assumia um MET fixo de 7 para tudo — ioga e corrida a valerem o mesmo. Duas
 * fórmulas dão dois números, e o utilizador vê os dois.
 *
 * A frequência cardíaca vem de cada atividade; a idade e o sexo da pessoa.
 */
export function sumActivityCalories(
  activities: Activity[],
  weightKg: number | undefined | null,
  person: PersonContext = {},
): number {
  const peso = weightKg ?? 70;
  return activities.reduce(
    (total, a) => total + calculateActivityCalories(a, peso, {
      avgHeartRate: a.avg_heart_rate,
      ...person,
    }),
    0,
  );
}

/**
 * Calorias de um mês. Filtro + soma — a conta é a mesma de todo o lado.
 * @param monthYear prefixo ISO "YYYY-MM" (por omissão, o mês corrente)
 */
export function calculateMonthlyCalories(
  activities: Activity[],
  weightKg: number | undefined | null,
  monthYear?: string,
  person: PersonContext = {},
): number {
  const target = monthYear ?? new Date().toISOString().slice(0, 7);
  return sumActivityCalories(
    activities.filter((a) => a.start_time.slice(0, 7) === target),
    weightKg,
    person,
  );
}
