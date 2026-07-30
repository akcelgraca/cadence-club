import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  padded: { padding: 16 },
});
