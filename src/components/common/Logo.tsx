import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../../hooks/useColors';
import { typography } from '../../lib/theme';

/**
 * A marca, dentro da app.
 *
 * O desenho é o mesmo de `assets/brand/mark.svg` e o dos ícones gerados por
 * `scripts/build-brand-assets.mjs` — as três cópias existem porque o SVG é o
 * mestre editável, o script produz os PNG das lojas e isto é o que a app
 * desenha em tempo real. Mudar o traço obriga a mudar os três.
 *
 * A cor vem do `useColors()`, por isso a marca acompanha o tema sozinha:
 * `#527F17` no claro, `#9ED42F` no escuro. Passar `color` só faz sentido por
 * cima de fotografia ou de mapa, onde nenhuma das duas se lê.
 */

/**
 * O `viewBox` é a caixa da tinta (77 unidades da grelha de 100), não a grelha
 * inteira. Assim `size` é mesmo a altura do que se vê, e o alinhamento com o
 * texto ao lado deixa de depender de margens invisíveis.
 */
const INK = '11.5 11.5 77 77';

interface LogoProps {
  /** Altura do símbolo, em pontos. O nome dimensiona-se a partir daqui. */
  size?: number;
  /** `mark` é só o símbolo — para cabeçalhos estreitos e avatares. */
  variant?: 'lockup' | 'mark';
  color?: string;
}

export function Logo({ size = 40, variant = 'lockup', color }: LogoProps) {
  const c = useColors();
  const tint = color ?? c.primary;
  const styles = useMemo(() => makeStyles(size, tint), [size, tint]);

  const mark = (
    <Svg width={size} height={size} viewBox={INK}>
      <Path
        d="M 74.136 72.505 A 33 33 0 1 1 74.136 27.495"
        fill="none"
        stroke={tint}
        strokeWidth={11}
        strokeLinecap="round"
      />
      <Path
        d="M 32 50 H 42 L 48 38 L 55 62 L 60 50 H 68"
        fill="none"
        stroke={tint}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  if (variant === 'mark') return mark;

  return (
    <View style={styles.lockup} accessibilityRole="image" accessibilityLabel="Cadence Club">
      {mark}
      {/* As duas palavras levam o mesmo peso e a mesma cor: é uma marca, não duas. */}
      <View>
        <Text style={styles.word}>CADENCE</Text>
        <Text style={styles.word}>CLUB</Text>
      </View>
    </View>
  );
}

const makeStyles = (size: number, tint: string) =>
  StyleSheet.create({
    lockup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: size * 0.22,
    },
    word: {
      ...typography.headline,
      color: tint,
      fontSize: size * 0.52,
      // Entrelinha apertada: em versaletes condensados o espaço por omissão
      // afasta as duas palavras ao ponto de deixarem de se ler como uma só.
      lineHeight: size * 0.62,
      letterSpacing: size * 0.026,
      // Sem isto o Android acrescenta espaço por baixo e desalinha do símbolo.
      includeFontPadding: false,
    },
  });
