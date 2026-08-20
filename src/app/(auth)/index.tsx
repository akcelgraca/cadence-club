import { useEffect } from 'react';
import { useColors } from '../../hooks/useColors';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { type Colors } from '../../lib/theme';

export default function AuthIndex() {
  const c = useColors();
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  useEffect(() => {
    if (session && !isOnboarded) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(auth)/login');
    }
  }, [session, isOnboarded]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}
