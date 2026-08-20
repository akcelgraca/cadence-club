import i18n from '../lib/i18n';

/**
 * A etiqueta de locale que corresponde ao idioma da app.
 *
 * Estava `'pt-PT'` escrito à mão em oito sítios, o que dava datas e meses em
 * português a quem tem a app em inglês — e não havia como dar por isso a olhar
 * para cada um deles isoladamente.
 */
export function localeTag(): string {
  return i18n.language?.startsWith('en') ? 'en-GB' : 'pt-PT';
}

/**
 * Nomes dos meses no idioma em vigor.
 *
 * Pelo `Intl` e não por uma lista escrita à mão: havia quatro listas de meses
 * espalhadas pelo código, todas em português, e uma delas com "Marco" sem
 * cedilha. Calculado a cada chamada porque o idioma muda dentro da app, sem
 * reiniciar.
 */
export function monthNames(style: 'short' | 'long' = 'long'): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag(), { month: style });
  return Array.from({ length: 12 }, (_, m) => {
    const nome = fmt.format(new Date(2000, m, 1));
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  });
}

/**
 * Format seconds into a display time string (HH:MM:SS or MM:SS).
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format a date string to a relative time (e.g., "há 2h", "há 3 dias").
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return i18n.t('time_now');
  if (diffMins < 60) return i18n.t('time_minutes', { n: diffMins });
  if (diffHours < 24) return i18n.t('time_hours', { n: diffHours });
  if (diffDays < 7) return i18n.t('time_days', { n: diffDays });
  if (diffDays < 30) return i18n.t('time_weeks', { n: Math.floor(diffDays / 7) });
  return date.toLocaleDateString(localeTag());
}

/**
 * Format date to PT locale date string.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(localeTag(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Segunda-feira da semana de `date`, à meia-noite local.
 *
 * A semana começa à segunda porque é assim que o plano de treino a conta
 * (`training_plans.week_start`). Estava definido em dois sítios; ficar num só
 * evita que o resumo da semana e o plano discordem sobre onde ela começa.
 */
export function startOfWeek(date: Date = new Date()): Date {
  const dia = date.getDay();
  // getDay(): 0 = domingo. Domingo pertence à semana que começou há 6 dias.
  const recuo = dia === 0 ? -6 : 1 - dia;
  const segunda = new Date(date);
  segunda.setDate(date.getDate() + recuo);
  segunda.setHours(0, 0, 0, 0);
  return segunda;
}

/** A mesma segunda-feira, em "YYYY-MM-DD" local. */
export function startOfWeekISODate(date: Date = new Date()): string {
  const d = startOfWeek(date);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
