import { Image, ImageStyle } from 'react-native';
import { getActivityImage } from '../../lib/activityImages';
import { useColors } from '../../hooks/useColors';

interface ActivityIconProps {
  activityKey: string;
  size?: number;
  /** Force a specific variant. Auto-detected from theme if omitted. */
  variant?: 'black' | 'white';
  /** Tint color applied to the image (useful for selected/primary states). */
  tintColor?: string;
  style?: ImageStyle;
}

export function ActivityIcon({ activityKey, size = 24, variant, tintColor, style }: ActivityIconProps) {
  const c = useColors();
  const isDark = (c.background as string) === '#0c0c0c';
  const resolvedVariant = variant ?? (isDark ? 'white' : 'black');
  const source = getActivityImage(activityKey, resolvedVariant);

  if (!source) return null;

  return (
    <Image
      source={source}
      style={[
        { width: size, height: size, tintColor: tintColor },
        style,
      ]}
      resizeMode="contain"
    />
  );
}
