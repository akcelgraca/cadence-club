/**
 * O nome e a descrição de um crachá, traduzidos.
 *
 * Desde a migração 053 a base de dados guarda a **chave** (`badge_early_bird`),
 * não o texto. Antes disso guardava português, e português era o que toda a
 * gente via — a 051 tinha deixado isto por resolver de propósito, porque o nome
 * ia como parâmetro da notificação e um inglês recebia
 * "You unlocked the badge: Madrugador!".
 *
 * **O recurso importa.** Uma linha por converter, ou um crachá acrescentado sem
 * chave no dicionário, faria o i18next devolver a própria chave — e o
 * utilizador via `badge_early_bird` no ecrã. Aqui, vê o que estiver na coluna.
 */
export function textoDoCracha(
  valor: string | null | undefined,
  t: (chave: string, opcoes?: Record<string, unknown>) => string,
): string {
  if (!valor) return '';
  // Só se traduz o que tem forma de chave nossa; o resto é texto antigo.
  if (!/^badge_[a-z0-9_]+$/.test(valor)) return valor;
  return t(valor, { defaultValue: valor });
}
