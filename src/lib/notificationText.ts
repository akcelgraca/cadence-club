import type { Notification } from './types';
import { textoDoCracha } from './badgeText';

/**
 * O texto de uma notificação, no idioma de quem lê.
 *
 * A base de dados guarda a chave e os parâmetros (migração 051), nunca a
 * frase — se guardasse a frase, ficaria em português para sempre, que é o que
 * acontecia até agora.
 *
 * Duas defesas, e nenhuma é teórica:
 *
 *   • **linhas sem chave** — tudo o que foi criado antes da 051. Cai no texto
 *     português que lá está, que é exatamente o que essas pessoas já viam.
 *   • **chave que não existe no dicionário** — o i18next devolveria a própria
 *     chave, e o utilizador via `notif_kudo` no ecrã. Com o `defaultValue`, vê
 *     a frase portuguesa. Feia para um inglês, mas legível; a chave em bruto
 *     não é nem uma coisa nem outra.
 */
export function notificationText(
  n: Pick<Notification, 'message' | 'message_key' | 'message_params'>,
  t: (chave: string, opcoes?: Record<string, unknown>) => string,
  idioma: string,
): string {
  if (!n.message_key) return n.message;

  const params: Record<string, unknown> = { ...(n.message_params ?? {}) };

  // O crachá chega como CHAVE desde a migração 053, não como nome. Interpolar
  // sem traduzir punha `badge_early_bird` dentro da frase — o oposto do que a
  // 053 foi corrigir.
  if (typeof params.badge === 'string') {
    params.badge = textoDoCracha(params.badge, t);
  }

  // A data chega em ISO de propósito — ver o comentário da migração 051. Com
  // o en-GB de hoje o resultado é igual ao português; o que se ganha é o
  // formato deixar de estar congelado na base de dados.
  if (typeof params.starts_at === 'string') {
    params.date = formatarDataDoEvento(params.starts_at, idioma);
  }

  return t(n.message_key, { ...params, defaultValue: n.message });
}

/** Dia, mês e hora — sem ano, que numa notificação de evento é ruído. */
export function formatarDataDoEvento(iso: string, idioma: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-GB' : 'pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
