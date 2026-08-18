import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  gatingEnabled, getMySubscription, FREE_STATE, type SubscriptionState,
} from '../services/subscription';

/** Chaves premium — a lista do que fica atrás do paywall, num sítio só. */
export type PremiumFeature =
  | 'map_3d'          // vista 3D e relevo
  | 'map_styles'      // satélite e ar livre
  | 'trends'          // estatísticas e tendências além de 3 meses
  | 'segment_history' // histórico completo de passagens nos troços
  | 'photo_gallery'   // galeria acima do limite gratuito
  | 'export';         // exportação dos dados

/** Meses de histórico que o plano gratuito mostra nas tendências. */
export const FREE_HISTORY_MONTHS = 3;

/** Fotos por atividade no plano gratuito (o limite da app são 6). */
export const FREE_PHOTO_LIMIT = 2;

/**
 * Estado premium do utilizador atual.
 *
 * O gating do lado do cliente é só para o ecrã — quem decide a sério é o
 * servidor, através de has_entitlement(). Isto serve para mostrar o cadeado
 * e abrir o paywall, não para proteger dados.
 */
export function usePremium() {
  const userId = useAuthStore((s) => s.profile?.id);

  const { data, isLoading } = useQuery<SubscriptionState>({
    queryKey: ['subscription', userId],
    queryFn: getMySubscription,
    enabled: !!userId,
    // A subscrição muda raramente, mas tem de acompanhar uma compra acabada
    // de fazer — daí não ser cache infinita.
    staleTime: 60_000,
  });

  /**
   * O gating está ligado?
   *
   * Quem manda é o servidor, através da flag `premium_gating` (migração 045).
   * Deixar isto do lado da app significaria ter de publicar versão nova para
   * ligar ou desligar a monetização — e, pior, não haveria como voltar atrás
   * depressa se corresse mal.
   *
   * Enquanto a flag estiver a false, `can()` devolve sempre true e a app
   * comporta-se como sempre se comportou. As mesmas verificações estão
   * também no servidor: isto aqui é só para mostrar o cadeado.
   */
  const { data: gatingLigado } = useQuery<boolean>({
    queryKey: ['premium-gating'],
    queryFn: gatingEnabled,
    // Muda uma vez na vida da app; não vale a pena perguntar a toda a hora.
    staleTime: 10 * 60_000,
  });

  const state = data ?? FREE_STATE;
  // Em dúvida, deixa passar. Falhar a ler a flag não pode fechar a app a
  // quem já a usava — o servidor impõe os limites de qualquer forma.
  const fechado = gatingLigado === true;

  return {
    ...state,
    isLoading,
    /** O paywall está a valer? Serve para decidir se se mostra o cadeado. */
    gatingEnabled: fechado,
    can: (_feature: PremiumFeature) => !fechado || state.isPremium,
  };
}
