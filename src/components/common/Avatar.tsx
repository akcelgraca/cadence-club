import { View, Image, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
}

export function Avatar({ uri, name, size = 40, radius, borderWidth, borderColor }: AvatarProps) {
  const borderRadius = radius ?? size / 2;

  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  if (uri) {
    return (
      <View style={[{ width: size, height: size, borderRadius, overflow: 'hidden', borderWidth, borderColor }]}>
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius, borderWidth, borderColor }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  initials: { ...typography.bodyBold, color: colors.primaryForeground },
});
