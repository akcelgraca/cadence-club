import { useMemo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { typography, type Colors } from '../../lib/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
}

export function Avatar({ uri, name, size = 40, radius, borderWidth, borderColor }: AvatarProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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

const makeStyles = (c: Colors) => StyleSheet.create({
  placeholder: { backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' },
  initials: { ...typography.bodyBold, color: c.primaryForeground },
});
