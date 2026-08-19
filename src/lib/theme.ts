export const colors = {
  background: '#FAFAFA',
  card: '#FFFFFF',
  primary: '#7BA823',
  primaryForeground: '#FFFFFF',
  foreground: '#1a1a1a',
  mutedForeground: '#6b6b6b',
  border: 'rgba(0, 0, 0, 0.1)',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  inputBackground: '#f3f3f3',
  tabBarBackground: '#FFFFFF',
  tabBarInactive: '#9ca3af',
  // GPS signal
  gpsGood: '#2ecc71',
  gpsWeak: '#f39c12',
  gpsNone: '#e74c3c',
  // Chart/accent
  chartAccent: '#3b82f6',
  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  // Route markers
  markerStart: '#2ecc71',
  markerEnd: '#e74c3c',
  markerWater: '#3498db',
  markerViewpoint: '#9b59b6',
  markerRestroom: '#7f8c8d',
  markerParking: '#2c3e50',
  markerCafe: '#8e44ad',
  markerLandmark: '#f39c12',
  // Overlays
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.05)',
} as const;

export const lightColors = {
  background: '#FAFAFA',
  card: '#FFFFFF',
  primary: '#7BA823',
  primaryForeground: '#FFFFFF',
  foreground: '#1a1a1a',
  mutedForeground: '#6b6b6b',
  border: 'rgba(0, 0, 0, 0.1)',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  inputBackground: '#f3f3f3',
  tabBarBackground: '#f5f5f5',
  tabBarInactive: '#9ca3af',
  // GPS signal
  gpsGood: '#2ecc71',
  gpsWeak: '#f39c12',
  gpsNone: '#e74c3c',
  // Chart/accent
  chartAccent: '#3b82f6',
  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  // Route markers
  markerStart: '#2ecc71',
  markerEnd: '#e74c3c',
  markerWater: '#3498db',
  markerViewpoint: '#9b59b6',
  markerRestroom: '#7f8c8d',
  markerParking: '#2c3e50',
  markerCafe: '#8e44ad',
  markerLandmark: '#f39c12',
  // Overlays
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.05)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const typography = {
  headline: { fontFamily: 'BarlowCondensed_700Bold', textTransform: 'uppercase' as const },
  statNumber: { fontFamily: 'BarlowCondensed_900Black' },
  body: { fontFamily: 'Barlow_400Regular' },
  bodyMedium: { fontFamily: 'Barlow_500Medium' },
  bodyBold: { fontFamily: 'Barlow_600SemiBold' },
  mono: { fontFamily: 'DMMono_400Regular' },
} as const;

export const runTypeColors: Record<string, string> = {
  Leve: '#38bdf8',
  Intenso: '#fb7185',
  Longo: '#a78bfa',
};

/**
 * Cores das zonas de treino, do azul calmo ao vermelho do esforço.
 *
 * A escala é a informação: dá para ler a intensidade sem legenda. Vive aqui
 * porque é usada no detalhe da atividade e na edição do perfil — em dois
 * sítios seria só uma questão de tempo até divergirem.
 */
export const zoneColors: Record<number, string> = {
  1: '#38bdf8',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

export const healthColors = {
  heart: '#fb7185',
  vo2max: '#38bdf8',
  shape: '#c8f73a',
};

/**
 * Convert a hex color to rgba with the given alpha.
 * Supports both 6-char (#RRGGBB) and 3-char (#RGB) hex values.
 */
export function withAlpha(hex: string, alpha: number): string {
  let r: number, g: number, b: number;
  if (hex.length === 4) {
    // #RGB → #RRGGBB
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
