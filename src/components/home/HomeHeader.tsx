import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '../common/Avatar';
import type { Profile } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { useAppTranslation } from '../../hooks/useAppTranslation';

function getGreetingKey(): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'greeting_morning';
  if (hour < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}

interface HomeHeaderProps {
  profile: Profile;
}

export function HomeHeader({ profile }: HomeHeaderProps) {
  const c = useColors();
  const { t } = useAppTranslation();
  const styles = useMemo(() => createStyles(c), [c]);

  const displayName = (() => {
    const parts = profile.full_name?.split(' ') || [];
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
    return parts[0] || '';
  })();

  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        <Text style={styles.greeting}>{t(getGreetingKey())}</Text>
        <Text style={styles.name}>{displayName}</Text>
      </View>
      <View style={styles.avatarGroup}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.full_name}
          size={48}
          radius={14}
          borderWidth={2}
          borderColor={c.primary}
        />
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
    },
    textGroup: { flex: 1 },
    greeting: {
      fontFamily: 'Barlow_500Medium',
      fontSize: 14,
      color: c.mutedForeground,
    },
    name: {
      fontFamily: 'BarlowCondensed_900Black',
      fontSize: 44,
      color: c.foreground,
      textTransform: 'uppercase',
      lineHeight: 44,
    },
    avatarGroup: { position: 'relative' },
    proBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: c.primary,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
    proBadgeText: {
      fontFamily: 'BarlowCondensed_900Black',
      fontSize: 9,
      color: c.primaryForeground,
    },
  });
}
