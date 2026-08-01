import i18n from '../../lib/i18n';
import type { SurfaceType, NearbyRoute } from '../../lib/types';

/** Imagens do seletor de humor, indexadas de 1 (muito mal) a 5 (muito bem). */
export const MOOD_IMAGES: Record<number, any> = {
  1: require('../../../assets/images/moods/sentimento-1-muito-mal.png'),
  2: require('../../../assets/images/moods/sentimento-2-mal.png'),
  3: require('../../../assets/images/moods/sentimento-3-neutro.png'),
  4: require('../../../assets/images/moods/sentimento-4-bem.png'),
  5: require('../../../assets/images/moods/sentimento-5-muito-bem.png'),
};

export const SURFACE_TYPES: { key: SurfaceType; label: string; icon: any }[] = [
  { key: 'road', label: i18n.t('route_surface_road'), icon: 'car-sport-outline' },
  { key: 'trail', label: i18n.t('route_surface_trail'), icon: 'leaf-outline' },
  { key: 'mixed', label: i18n.t('route_surface_mixed'), icon: 'shuffle-outline' },
  { key: 'track', label: i18n.t('route_surface_track'), icon: 'ellipse-outline' },
];

/** Tipo unificado para os itens do seletor de rotas (próximas ou pesquisadas). */
export type RoutePickerItem = NearbyRoute;
