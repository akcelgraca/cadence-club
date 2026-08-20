import { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { type Colors } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
  },
  padded: { padding: 16 },
});
