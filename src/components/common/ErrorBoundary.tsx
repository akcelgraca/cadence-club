import React, { useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
// Componente de classe: não pode usar hooks, por isso lê a instância do i18n.
import i18n from '../../lib/i18n';
import { typography, type Colors } from '../../lib/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * O ecrã de falha, à parte da classe.
 *
 * Um componente de classe não pode chamar hooks, e é o `useColors()` que diz
 * qual é a paleta. Sem esta separação, o único ecrã que a pessoa vê quando
 * tudo o resto correu mal seria o único a aparecer sempre em claro — branco a
 * toda a largura, de noite, logo a seguir a um crash.
 */
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={48} color={c.mutedForeground} />
      <Text style={styles.title}>{i18n.t('error_something_wrong')}</Text>
      <Text style={styles.message}>
        {error?.message ?? i18n.t('error_unexpected')}
      </Text>
      <Button title={i18n.t('retry')} onPress={onRetry} variant="primary" />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: c.background },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { ...typography.bodyBold, fontSize: 18, marginBottom: 8, color: c.foreground },
  message: { ...typography.body, fontSize: 14, color: c.mutedForeground, textAlign: 'center', marginBottom: 20 },
});
