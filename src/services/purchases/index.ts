import { Platform } from 'react-native';
import { supabase } from '../supabase';

/**
 * Compras dentro da app, via RevenueCat.
 *
 * PORQUÊ REVENUECAT: a validação de recibos contra a Apple e a Google, as
 * renovações, os períodos de graça e os reembolsos são a parte que mais
 * costuma correr mal, e é toda do lado do servidor. O RevenueCat trata disso
 * e avisa o nosso webhook. Grátis até 2500 USD/mês de receita, 1% acima.
 *
 * QUEM DECIDE O ACESSO NÃO É ISTO. Este módulo só *inicia* a compra. Quem
 * escreve em `subscriptions` é o webhook, com a service role; a app lê o
 * estado com `getMySubscription()`. Se fosse a app a decidir, bastava um
 * cliente modificado para se dar premium.
 *
 * ⚠️ ESTADO: não configurado. `react-native-purchases` ainda não está
 * instalado, e não pode ser testado sem conta paga da Apple e sem produtos
 * criados no App Store Connect / Play Console. Tudo aqui degrada em silêncio
 * enquanto isso não existir — `isAvailable()` devolve false e a interface não
 * oferece a compra.
 */

/** Identificador do direito no RevenueCat. Tem de bater com o painel deles. */
export const ENTITLEMENT_ID = 'premium';

/**
 * Chaves públicas do RevenueCat, por plataforma.
 *
 * São chaves de SDK, feitas para viver no cliente — não são segredos. O
 * segredo é o do webhook, que vive só no servidor.
 */
const API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};

/** Carrega o SDK nativo sem partir a app quando ele não existe. */
function carregar(): any | null {
  try {
    const mod = require('react-native-purchases');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

function chave(): string {
  return Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;
}

/** Há SDK instalado e chave configurada? */
export function isAvailable(): boolean {
  return carregar() !== null && chave() !== '';
}

let configurado = false;

/**
 * Liga o SDK à conta do utilizador.
 *
 * O `appUserID` é o id do Supabase, de propósito: é o que permite ao webhook
 * ligar a compra a uma conta. Sem isto, o RevenueCat inventa um id anónimo e
 * a compra fica órfã — o webhook reconhece esse caso e ignora-o.
 */
export async function configure(userId: string): Promise<boolean> {
  const Purchases = carregar();
  if (!Purchases || !chave()) return false;

  try {
    if (!configurado) {
      await Purchases.configure({ apiKey: chave(), appUserID: userId });
      configurado = true;
    } else {
      // Trocar de conta na mesma sessão: sem isto, a compra ia para o
      // utilizador anterior.
      await Purchases.logIn(userId);
    }
    return true;
  } catch {
    return false;
  }
}

/** Fecha a sessão do SDK — chamar no logout. */
export async function reset(): Promise<void> {
  const Purchases = carregar();
  if (!Purchases || !configurado) return;
  try {
    await Purchases.logOut();
  } catch {
    // Falhar aqui não pode impedir o logout da app.
  }
}

export interface Plan {
  /** Identificador do pacote no RevenueCat. */
  id: string;
  /** Preço já formatado na moeda do utilizador, pela loja. */
  price: string;
  /** 'monthly' | 'annual' | outro, conforme configurado. */
  period: string;
  /** O objeto original do SDK, para passar de volta ao comprar. */
  raw: unknown;
}

/**
 * Planos disponíveis.
 *
 * Os preços vêm da loja, já formatados e na moeda certa — nunca escrever
 * preços à mão na app: variam por país e a Apple obriga a mostrar o real.
 */
export async function getPlans(): Promise<Plan[]> {
  const Purchases = carregar();
  if (!Purchases) return [];

  try {
    const offerings = await Purchases.getOfferings();
    const pacotes = offerings?.current?.availablePackages ?? [];
    return pacotes.map((p: any) => ({
      id: p.identifier,
      price: p.product?.priceString ?? '',
      period: p.packageType ?? '',
      raw: p,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

/**
 * Compra um plano.
 *
 * Devolver `ok: true` significa que a loja aceitou o pagamento — **não** que
 * o utilizador já é premium do lado do servidor. O direito só existe depois
 * de o webhook escrever, o que costuma demorar segundos. Quem chama deve
 * voltar a ler `getMySubscription()`, e é isso que `refreshEntitlement` faz.
 */
export async function purchase(plan: Plan): Promise<PurchaseResult> {
  const Purchases = carregar();
  if (!Purchases) return { ok: false, cancelled: false, error: 'indisponível' };

  try {
    await Purchases.purchasePackage(plan.raw);
    return { ok: true };
  } catch (err: any) {
    // Desistir de comprar não é um erro a mostrar como erro.
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, error: err?.message ?? 'erro desconhecido' };
  }
}

/**
 * Repõe compras anteriores.
 *
 * Obrigatório pela App Store: sem um botão destes, a app é rejeitada em
 * revisão. Serve a quem reinstalou ou mudou de telemóvel.
 */
export async function restore(): Promise<boolean> {
  const Purchases = carregar();
  if (!Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

/**
 * Força o servidor a reavaliar o direito, depois de uma compra.
 *
 * O webhook pode ainda não ter chegado quando a loja devolve o controlo. Em
 * vez de mostrar "não és premium" a quem acabou de pagar, tenta algumas
 * vezes, com pausas.
 */
export async function refreshEntitlement(tentativas = 5): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    const { data } = await supabase.rpc('is_premium');
    if (data === true) return true;
    // Espera crescente: 1s, 2s, 3s… O webhook costuma chegar na primeira.
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return false;
}
