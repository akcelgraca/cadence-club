import { Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { session, isOnboarded } = useAuthStore();

  // If authenticated and onboarded, redirect to main app
  if (session && isOnboarded) {
    return <Redirect href="/(tabs)/feed" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
