import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography } from '../../lib/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const loaderColor =
    variant === 'primary' ? colors.primaryForeground :
    variant === 'danger' ? colors.destructiveForeground :
    variant === 'ghost' ? colors.primary :
    colors.foreground;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`]]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.destructive },
  ghost: { backgroundColor: 'transparent' },
  size_sm: { paddingHorizontal: 12, paddingVertical: 8 },
  size_md: { paddingHorizontal: 16, paddingVertical: 12 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 16 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { ...typography.bodyBold },
  text_primary: { color: colors.primaryForeground, fontSize: 16 },
  text_secondary: { color: colors.foreground, fontSize: 16 },
  text_danger: { color: colors.destructiveForeground, fontSize: 16 },
  text_ghost: { color: colors.mutedForeground, fontSize: 16 },
  text_sm: { fontSize: 13 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 18 },
});
