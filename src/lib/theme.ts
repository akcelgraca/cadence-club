/**
 * NÃO existe aqui um `colors` estático.
 *
 * Existiu, e era uma cópia do `lightColors`. Enquanto lá esteve, importá-lo era
 * o caminho mais curto — e cada ficheiro que o fez ficou preso ao tema claro,
 * porque o `StyleSheet.create` é avaliado uma vez, quando o módulo carrega. Ao
 * fim de 93 ficheiros e 1600 usos, era isso e não o `useColors()` que impedia o
 * modo escuro.
 *
 * A paleta em vigor vem sempre do `useColors()`. Um teste garante que não volta.
 */

export const lightColors = {
  /** Qual das duas é. Ler isto é mais honesto do que comparar hex à mão. */
  scheme: 'light',
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

/**
 * Paleta escura.
 *
 * Não é o modo claro invertido. Três decisões que valem a pena explicar:
 *
 * • **O fundo não é preto.** `#101211` tem um resto de verde-azeitona, a mesma
 *   família do `primary`. Preto puro faz o conteúdo flutuar e, em OLED, torna
 *   o *smearing* do scroll bem visível.
 *
 * • **O verde da marca sobe.** O `#7BA823` do modo claro é escuro de mais para
 *   fundo escuro. O `#9ED42F` é o mesmo verde com mais luz: dá 10,7:1 contra o
 *   fundo, contra os 2,7:1 que o original dá no modo claro.
 *
 * • **O texto sobre o verde inverte-se.** Com o verde claro, o branco deixaria
 *   de se ler; o `primaryForeground` passa a ser a cor do fundo.
 *
 * Os marcadores de mapa não mudam: vivem por cima do mapa, não da interface, e
 * o significado de cada cor (água, miradouro, estacionamento) tem de ser o
 * mesmo nos dois modos.
 */
export const darkColors = {
  scheme: 'dark',
  background: '#101211',
  card: '#191C19',
  primary: '#9ED42F',
  primaryForeground: '#101211',
  foreground: '#EDEFEA',
  mutedForeground: '#9AA095',
  border: 'rgba(255, 255, 255, 0.12)',
  destructive: '#F87171',
  destructiveForeground: '#1A1A1A',
  inputBackground: '#20241F',
  tabBarBackground: '#141714',
  tabBarInactive: '#6E756B',
  // GPS signal
  gpsGood: '#4ADE80',
  gpsWeak: '#FBBF24',
  gpsNone: '#F87171',
  // Chart/accent
  chartAccent: '#60A5FA',
  // Status
  success: '#4ADE80',
  warning: '#FBBF24',
  // Route markers — iguais de propósito: são do mapa, não da interface
  markerStart: '#2ecc71',
  markerEnd: '#e74c3c',
  markerWater: '#3498db',
  markerViewpoint: '#9b59b6',
  markerRestroom: '#7f8c8d',
  markerParking: '#2c3e50',
  markerCafe: '#8e44ad',
  markerLandmark: '#f39c12',
  // Overlays
  overlayDark: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',
} as const;

/**
 * O contrato que as duas paletas cumprem.
 *
 * Mapeado para `string` de propósito: com o `as const`, `typeof lightColors`
 * seria o literal `'#FAFAFA'` e a paleta escura não caberia no tipo.
 * Um teste garante que as duas têm exatamente as mesmas chaves.
 */
export type Colors = { readonly [K in keyof typeof lightColors]: string };

/**
 * Qual paleta, dada a preferência do utilizador e o que o sistema diz.
 *
 * Função pura e à parte do hook para poder ser testada sem montar React — a
 * regra tem três entradas e a do meio ('system' com o sistema por responder)
 * é a que se engana com facilidade.
 */
export function resolveTheme(
  preference: 'light' | 'dark' | 'system',
  // `ColorSchemeName` do React Native inclui 'unspecified' — só 'dark' escurece.
  systemScheme: string | null | undefined,
): Colors {
  if (preference === 'dark') return darkColors;
  if (preference === 'light') return lightColors;
  // 'system' — e, enquanto o sistema não responde, claro. É o que a app sempre
  // foi, e escurecer durante um instante no arranque seria pior.
  return systemScheme === 'dark' ? darkColors : lightColors;
}

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
