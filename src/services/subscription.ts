import { supabase } from './supabase';

// Schema e funções: supabase/migrations/042_subscriptions.sql
//
// O estado vem sempre do servidor. O telemóvel não escreve aqui e não decide
// nada — quem escreve é o webhook das lojas, com a service role.

export type SubscriptionStore = 'app_store' | 'play_store' | 'stripe' | 'promo';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'grace'
  | 'paused'
  | 'expired'
  | 'refunded';

export interface SubscriptionState {
  isPremium: boolean;
  status: SubscriptionStatus | null;
  store: SubscriptionStore | null;
  productId: string | null;
  /** Fim do período pago. Null em quem nunca subscreveu. */
  currentPeriodEnd: string | null;
  willRenew: boolean;
}

/** Estado de quem nunca pagou — e também aquilo para que degradamos em erro. */
export const FREE_STATE: SubscriptionState = {
  isPremium: false,
  status: null,
  store: null,
  productId: null,
  currentPeriodEnd: null,
  willRenew: false,
};

/**
 * Estado da subscrição de quem está autenticado.
 *
 * Falhar aqui degrada para o plano gratuito em vez de atirar: um erro de rede
 * não pode deixar a app num estado indefinido. O contrário — assumir premium
 * em caso de dúvida — abria a porta a bloquear a rede e ter tudo de graça.
 */
/**
 * O gating premium está ligado no servidor?
 *
 * Flag `premium_gating` em `app_flags` (migração 045). Falhar devolve false —
 * ou seja, app aberta. Em dúvida deixa-se passar: os limites a sério são
 * impostos pelo servidor, e fechar a app por causa de um erro de rede seria
 * pior do que deixar alguém ver tendências a mais.
 */
export async function gatingEnabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc('premium_gating_enabled');
  if (error) return false;
  return data === true;
}

export async function getMySubscription(): Promise<SubscriptionState> {
  const { data, error } = await supabase.rpc('get_my_subscription').single();
  if (error || !data) return FREE_STATE;

  const row = data as any;
  return {
    isPremium: row.is_premium ?? false,
    status: row.status ?? null,
    store: row.store ?? null,
    productId: row.product_id ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    willRenew: row.will_renew ?? false,
  };
}
