import { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_STYLES, type MapboxStyleKey } from '../map/MapViewWrapper';
import { type Colors } from '../../lib/theme';
import { makeStyles } from './recordStyles';
import { useTranslation } from 'react-i18next';

/**
 * Altura da pilha de controlos, para quem precise de se desviar dela — a
 * bússola do Mapbox nasce no mesmo canto e ficava por baixo dos botões.
 */
export const MAP_CONTROL_COUNT = 4;
export const MAP_CONTROL_SIZE = 40;
export const MAP_CONTROL_GAP = 8;
export function mapControlsHeight(count = MAP_CONTROL_COUNT): number {
  return count * MAP_CONTROL_SIZE + (count - 1) * MAP_CONTROL_GAP;
}

const STYLE_KEYS: Record<MapboxStyleKey, string> = {
  dark: 'settings_map_dark',
  light: 'settings_map_light',
  streets: 'settings_map_streets',
  satellite: 'settings_map_satellite',
  outdoors: 'settings_map_outdoors',
};

/**
 * Controlos sobre o mapa, agrupados no canto superior direito.
 * Fundo claro com sombra: sobre mapas claros um fundo translúcido escuro
 * com ícones cinzentos fica ilegível.
 */
export function MapControls({
  showTerrain,
  onToggleTerrain,
  showStyleMenu,
  onToggleStyleMenu,
  mapStyle,
  onSelectStyle,
  show3D,
  onToggle3D,
  onCenterOnUser,
}: {
  showTerrain: boolean;
  onToggleTerrain: () => void;
  showStyleMenu: boolean;
  onToggleStyleMenu: () => void;
  mapStyle: MapboxStyleKey;
  onSelectStyle: (key: MapboxStyleKey) => void;
  show3D: boolean;
  onToggle3D: () => void;
  onCenterOnUser: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = insets.top + 8;

  return (
    <>
      {/* Fecha o menu de estilos ao tocar fora */}
      {showStyleMenu && (
        <TouchableOpacity
          style={styles.mapBackdrop}
          activeOpacity={1}
          onPress={onToggleStyleMenu}
        />
      )}

      <View style={[styles.mapControlStack, { top }]}>
        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={onToggleStyleMenu}
          activeOpacity={0.7}
          accessibilityLabel={t('settings_map_style')}
        >
          <Ionicons name="layers-outline" size={18} color={c.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mapControlBtn, showTerrain && styles.mapControlBtnActive]}
          onPress={onToggleTerrain}
          activeOpacity={0.7}
          accessibilityLabel="Relevo"
        >
          <Ionicons
            name="triangle"
            size={17}
            color={showTerrain ? c.primary : c.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mapControlBtn, show3D && styles.mapControlBtnActive]}
          onPress={onToggle3D}
          activeOpacity={0.7}
          accessibilityLabel={t('routes_3d')}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={show3D ? c.primary : c.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={onCenterOnUser}
          activeOpacity={0.7}
          accessibilityLabel={t('map_center_on_me')}
        >
          <Ionicons name="locate-outline" size={18} color={c.foreground} />
        </TouchableOpacity>
      </View>

      {showStyleMenu && (
        <View style={[styles.styleMenu, { top }]}>
          {(Object.keys(MAPBOX_STYLES) as MapboxStyleKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.styleMenuItem, mapStyle === key && styles.styleMenuItemActive]}
              onPress={() => onSelectStyle(key)}
            >
              <Text style={[styles.styleMenuText, mapStyle === key && styles.styleMenuTextActive]}>
                {t(STYLE_KEYS[key] as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}
