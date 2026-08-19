import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { typography, type Colors } from '../../lib/theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.container}>
      <Ionicons name="file-tray-outline" size={48} color={c.mutedForeground} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && (
        <Button title={action.label} onPress={action.onPress} variant="primary" size="md" />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { ...typography.bodyBold, fontSize: 18, textAlign: 'center', marginBottom: 8, color: c.foreground },
  subtitle: { ...typography.body, fontSize: 14, color: c.mutedForeground, textAlign: 'center', marginBottom: 20 },
});
