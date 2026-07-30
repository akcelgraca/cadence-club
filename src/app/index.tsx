import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../lib/theme';

export default function Index() {
  const { isLoading, session, isOnboarded } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isOnboarded) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
