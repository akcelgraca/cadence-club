import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, typography } from '../../lib/theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="file-tray-outline" size={48} color={colors.mutedForeground} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && (
        <Button title={action.label} onPress={action.onPress} variant="primary" size="md" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { ...typography.bodyBold, fontSize: 18, textAlign: 'center', marginBottom: 8, color: colors.foreground },
  subtitle: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: 20 },
});
