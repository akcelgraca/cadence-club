import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import { POSTHOG_API_KEY, POSTHOG_HOST } from './constants';

/**
 * Analytics.
 *
 * Poucos eventos, com nomes estáveis. A tentação é medir tudo; o resultado
 * disso é um painel que ninguém abre. Estes seis respondem às perguntas que
 * decidem o produto:
 *
 *   • as pessoas voltam?            → app_opened (retenção a 1/7/30 dias)
 *   • chegam a gravar alguma coisa? → signed_up → onboarding_completed → activity_recorded
 *   • o que usam do que é premium?  → premium_feature_used, repartido por `feature`
 *   • alguém traz alguém?          → activity_shared
 *
 * REGRA DE PRIVACIDADE: daqui nunca sai nada que identifique uma pessoa ou um
 * sítio. Sem coordenadas, sem moradas, sem títulos de atividade (que são texto
 * livre), sem nomes nem emails. O identificador é o id do Supabase, que é
 * pseudónimo. Ver `track()` — os tipos existem precisamente para não haver a
 * tentação de acrescentar um campo destes à pressa.
 */

const ENABLED = POSTHOG_API_KEY !== 'your-posthog-key';

export const posthog = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });

/** Propriedades permitidas em cada evento. Nada de texto livre do utilizador. */
type EventMap = {
  /** Abertura da app. É a base do cálculo de retenção. */
  app_opened: undefined;

  signed_up: { method: 'email' | 'google' | 'apple' };
  onboarding_completed: { goal: string | null; has_questionnaire: boolean };

  /** O momento em que a app entrega valor. */
  activity_recorded: {
    type: string;
    /** Arredondado ao km — o valor exato não acrescenta nada e é mais identificável. */
    distance_km: number;
    duration_min: number;
    /** true quando ficou na fila offline em vez de subir logo. */
    queued_offline: boolean;
    has_photos: boolean;
  };

  /** Uso do que está (ou vai estar) atrás do paywall. Alimenta o preço. */
  premium_feature_used: {
    feature: 'map_3d' | 'map_styles' | 'trends' | 'segment_history' | 'photo_gallery' | 'export';
  };

  /** O laço de crescimento: quem partilha traz gente. */
  activity_shared: { destination: 'instagram_stories' | 'system' | 'gallery' };
};

/**
 * Regista um evento. Silencioso em erro — uma falha de analytics nunca pode
 * partir um ecrã, muito menos o de gravação.
 */
export function track<K extends keyof EventMap>(
  ...args: EventMap[K] extends undefined ? [event: K] : [event: K, properties: EventMap[K]]
): void {
  if (!ENABLED) return;
  const [event, properties] = args;
  try {
    posthog.capture(event as string, properties as PostHogEventProperties | undefined);
  } catch {
    // ignorado de propósito
  }
}

/**
 * Liga os eventos a uma pessoa. Sem isto não há retenção — cada abertura da
 * app parecia um utilizador novo.
 *
 * Só o id. O email fica de fora: para responder às perguntas que temos, o
 * pseudónimo chega, e menos dados pessoais fora de casa é menos superfície
 * de RGPD.
 */
export function identifyUser(userId: string): void {
  if (!ENABLED) return;
  try {
    posthog.identify(userId);
  } catch {
    // ignorado de propósito
  }
}

/** Fim de sessão: desliga os eventos seguintes desta pessoa. */
export function resetAnalytics(): void {
  if (!ENABLED) return;
  try {
    posthog.reset();
  } catch {
    // ignorado de propósito
  }
}
