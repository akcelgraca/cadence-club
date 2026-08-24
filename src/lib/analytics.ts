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

/**
 * Só conta como chave real uma *project API key* do PostHog. Começam sempre
 * por `phc_`, e é essa a verificação: comparar com o valor de exemplo do
 * `.env` deixava passar a chave vazia, e deixava passar sobretudo o engano
 * mais comum — copiar a *personal API key* (`phx_`), que é lida do sítio
 * errado das definições, é aceite sem queixa pelo SDK e não entrega um único
 * evento.
 */
const KEY = POSTHOG_API_KEY.trim();
export const ANALYTICS_ENABLED = /^phc_[A-Za-z0-9_-]{20,}$/.test(KEY);

/**
 * O cliente nasce desligado quando não há chave. Travar só o `track()` não
 * chegava: o `PostHogProvider` faz autocapture de ecrãs e de ciclo de vida por
 * sua conta, e sem o `disabled` ficava a tentar entregar esses eventos a uma
 * chave inválida, com retries, enquanto a app estivesse aberta.
 */
export const posthog = new PostHog(KEY, {
  host: POSTHOG_HOST,
  disabled: !ANALYTICS_ENABLED,
  // Em desenvolvimento vale mais ver o evento aparecer no painel em segundos
  // do que poupar pedidos — é assim que se confirma que a chave está boa.
  ...(__DEV__ ? { flushAt: 1 } : {}),
});

// `NODE_ENV === 'test'` de fora: nos testes a chave nunca está lá, e o aviso
// enchia a saída do jest de ruído sem que ninguém o pudesse resolver.
if (__DEV__ && !ANALYTICS_ENABLED && process.env.NODE_ENV !== 'test') {
  // Barulhento de propósito. O estado antigo — sem chave, sem erro, sem dados —
  // custa um mês de calendário a descobrir, porque a retenção a 30 dias só
  // começa a contar no dia em que o primeiro evento chega.
  console.warn(
    '[analytics] EXPO_PUBLIC_POSTHOG_KEY em falta ou inválida: nada está a ser ' +
      'recolhido. Põe a project API key (phc_…) no .env e reinicia com `npx expo start -c`.',
  );
}

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

  /**
   * O paywall foi visto. Com o `premium_purchased`, dá a taxa de conversão —
   * a pergunta que decide se o preço está certo.
   */
  paywall_viewed: undefined;

  /** Compra concluída na loja. O direito só existe depois do webhook. */
  premium_purchased: { plan: string };

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
  if (!ANALYTICS_ENABLED) return;
  const [event, properties] = args;
  try {
    posthog.capture(event as string, properties as PostHogEventProperties | undefined);
  } catch {
    // ignorado de propósito
  }
}

/**
 * Foi agora que esta conta nasceu?
 *
 * Com email a pergunta não se põe: há um `signUp` e um `signIn`, e sabe-se qual
 * é qual. Com o Google e a Apple é a **mesma chamada** para entrar e para se
 * registar — o `signInWithOAuth` devolve uma sessão nos dois casos, sem dizer
 * qual foi. Sem responder a isto, o `signed_up` só existia para o email, e a
 * ativação por método de registo não se conseguia medir.
 *
 * **Comparam-se dois carimbos do servidor, nunca o relógio do telemóvel.** Numa
 * conta acabada de criar, o GoTrue escreve `created_at` e `last_sign_in_at` no
 * mesmo pedido, com milissegundos de diferença; numa entrada de quem já existia,
 * o `created_at` é de outro dia. A tentação era comparar o `created_at` com
 * `Date.now()`, mas o relógio de um telemóvel pode estar horas ao lado — e aí
 * ou se perdiam registos ou se inventavam.
 *
 * ⚠️ **Só serve em entradas interativas.** Quem se registou pelo Google e nunca
 * mais voltou a entrar fica com os dois carimbos iguais **para sempre**: aplicar
 * isto ao restauro de sessão no arranque dispararia um `signed_up` de cada vez
 * que abrisse a app. Por isso o `initialize` não lhe toca.
 */
const MARGEM_MESMO_PEDIDO_MS = 10_000;

export function isNovoRegisto(user: {
  created_at?: string | null;
  last_sign_in_at?: string | null;
}): boolean {
  if (!user.created_at) return false;
  // Antes da primeira entrada ficar registada não há com que comparar, e uma
  // conta sem entrada nenhuma só pode ter acabado de nascer.
  if (!user.last_sign_in_at) return true;

  const criada = Date.parse(user.created_at);
  const entrou = Date.parse(user.last_sign_in_at);
  // Uma data que não se percebe não é motivo para inventar um registo.
  if (Number.isNaN(criada) || Number.isNaN(entrou)) return false;

  return Math.abs(entrou - criada) < MARGEM_MESMO_PEDIDO_MS;
}

/**
 * O `signed_up` do Google e da Apple, disparado só quando a conta é mesmo nova.
 *
 * Existe como função em vez de um `if` em cada sítio pela mesma razão que o
 * `onSessionStarted` existe: acrescentar um método de entrada e esquecer um
 * deles é o erro que este projeto já cometeu uma vez.
 */
export function trackSignUpIfNew(
  user: { created_at?: string | null; last_sign_in_at?: string | null },
  method: 'google' | 'apple',
): void {
  if (isNovoRegisto(user)) track('signed_up', { method });
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
  if (!ANALYTICS_ENABLED) return;
  try {
    posthog.identify(userId);
  } catch {
    // ignorado de propósito
  }
}

/** Fim de sessão: desliga os eventos seguintes desta pessoa. */
export function resetAnalytics(): void {
  if (!ANALYTICS_ENABLED) return;
  try {
    posthog.reset();
  } catch {
    // ignorado de propósito
  }
}
