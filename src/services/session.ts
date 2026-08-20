import { identifyUser, resetAnalytics } from '../lib/analytics';
import { configure as ligarCompras, reset as desligarCompras } from './purchases';

/**
 * Ligar e desligar os serviços externos que precisam de saber quem está a usar
 * a app.
 *
 * Existe por causa de um erro que já custou caro noutras apps: cada serviço
 * ficava ligado num sítio diferente do `authStore`, e bastava acrescentar uma
 * forma nova de entrar — o Google, a Apple — para um deles ficar de fora sem
 * ninguém dar por isso. Com um par de funções, esquecer-se de uma é esquecer-se
 * das duas, e isso nota-se logo.
 *
 * O que está em jogo em cada uma:
 *
 * • **Analytics.** Sem `identify`, cada abertura da app parece um utilizador
 *   novo e a retenção deixa de significar o que quer que seja.
 *
 * • **Compras.** O `appUserID` do RevenueCat tem de ser o id do Supabase. Se o
 *   SDK não for configurado, ele inventa um id anónimo, e o webhook —
 *   corretamente — recusa-se a ligar essa compra a uma conta (ver
 *   `uuidValido()` em `supabase/functions/revenuecat-webhook`). Traduzido: a
 *   pessoa paga e não recebe nada, e o registo da compra não aponta para
 *   ninguém.
 */
export function onSessionStarted(userId: string): void {
  identifyUser(userId);
  // Sem `await` de propósito: nenhum ecrã deve esperar pelo SDK de compras
  // para aparecer, e o módulo já degrada em silêncio quando não está instalado.
  void ligarCompras(userId);
}

export async function onSessionEnded(): Promise<void> {
  resetAnalytics();
  await desligarCompras();
}
