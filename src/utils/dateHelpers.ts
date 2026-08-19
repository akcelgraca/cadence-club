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

  if (diffSecs < 60) return 'agora';
  if (diffMins < 60) return `há ${diffMins}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} sem`;
  return date.toLocaleDateString('pt-PT');
}

/**
 * Format date to PT locale date string.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-PT', {
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
