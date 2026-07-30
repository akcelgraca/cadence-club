import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, typography } from '../../lib/theme';

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
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={styles.title}>Algo correu mal</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'Ocorreu um erro inesperado.'}
          </Text>
          <Button title="Tentar novamente" onPress={this.handleRetry} variant="primary" />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.background },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { ...typography.bodyBold, fontSize: 18, marginBottom: 8, color: colors.foreground },
  message: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: 20 },
});
