import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
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

/** "Sábado, 1 de agosto" — o contexto que falta num ecrã chamado Hoje. */
function todayLabel(locale: string): string {
  const formatted = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

interface HomeHeaderProps {
  profile: Profile;
}

export function HomeHeader({ profile }: HomeHeaderProps) {
  const c = useColors();
  const { t, language } = useAppTranslation();
  const styles = useMemo(() => createStyles(c), [c]);

  const firstName = profile.full_name?.split(' ')[0] ?? '';

  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        <Text style={styles.greeting} numberOfLines={1}>
          {t(getGreetingKey())}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.date} numberOfLines={1}>{todayLabel(language)}</Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.8}
        accessibilityLabel={t('home_open_profile')}
      >
        <Avatar
          uri={profile.avatar_url}
          name={profile.full_name}
          size={44}
          borderWidth={1.5}
          borderColor={c.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    textGroup: { flex: 1, minWidth: 0 },
    greeting: {
      fontFamily: 'BarlowCondensed_900Black',
      fontSize: 26,
      lineHeight: 28,
      color: c.foreground,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    date: {
      fontFamily: 'DMMono_400Regular',
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: 2,
    },
  });
}
