import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getMySubscription, FREE_STATE, type SubscriptionState } from '../services/subscription';

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

  const state = data ?? FREE_STATE;

  return {
    ...state,
    isLoading,
    /**
     * Enquanto não houver paywall lançado, tudo está aberto. Trocar isto por
     * `state.isPremium` é o interruptor que liga a monetização — e só deve
     * acontecer no dia em que a migração de gating for aplicada.
     */
    can: (_feature: PremiumFeature) => true,
  };
}
