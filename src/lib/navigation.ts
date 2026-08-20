import { router } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Fechar um ecrã sem ficar preso nele.
 *
 * O `router.back()` cru assume que há alguém por baixo na pilha, e nem sempre
 * há. Um reload do Metro, um deep link ou o toque numa notificação reconstroem
 * a pilha a partir do URL: o ecrã que se abriu fica a ser o único. Nesse caso o
 * GO_BACK não é tratado por navegador nenhum — em desenvolvimento vê-se o aviso
 * «GO_BACK was not handled», e em produção vê-se coisa nenhuma: o botão de
 * fechar simplesmente não faz nada e não há como sair sem matar a app.
 *
 * `goBackOr()` volta para trás quando dá, e substitui o ecrã pelo destino de
 * recurso quando não dá. O recurso deve ser o pai natural do ecrã — de onde a
 * pessoa teria vindo se tivesse chegado ali a navegar.
 */
export function goBackOr(fallback: Href = '/(tabs)'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
