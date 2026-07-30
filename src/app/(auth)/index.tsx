import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../lib/theme';

export default function AuthIndex() {
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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
