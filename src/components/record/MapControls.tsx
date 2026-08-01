import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_STYLES, type MapboxStyleKey } from '../map/MapViewWrapper';
import { colors } from '../../lib/theme';
import { styles } from './recordStyles';

const STYLE_LABELS: Record<MapboxStyleKey, string> = {
  dark: 'Escuro',
  light: 'Claro',
  streets: 'Ruas',
  satellite: 'Satélite',
  outdoors: 'Ar livre',
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
          accessibilityLabel="Estilo do mapa"
        >
          <Ionicons name="layers-outline" size={18} color={colors.foreground} />
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
            color={showTerrain ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mapControlBtn, show3D && styles.mapControlBtnActive]}
          onPress={onToggle3D}
          activeOpacity={0.7}
          accessibilityLabel="Vista 3D"
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={show3D ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={onCenterOnUser}
          activeOpacity={0.7}
          accessibilityLabel="Centrar em mim"
        >
          <Ionicons name="locate-outline" size={18} color={colors.foreground} />
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
                {STYLE_LABELS[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}
