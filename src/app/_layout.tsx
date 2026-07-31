import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { ActivityIndicator, View, StatusBar, Text, StyleSheet } from 'react-native';
import { CustomHeader } from '../components/common/CustomHeader';
import { useFonts } from 'expo-font';
import { supabase } from '../services/supabase';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
import Mapbox from '@rnmapbox/maps';
import { configureGoogleSignIn } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useColors } from '../hooks/useColors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { MAPBOX_ACCESS_TOKEN, POSTHOG_API_KEY, POSTHOG_HOST } from '../lib/constants';
import { colors } from '../lib/theme';
import { PostHogProvider } from 'posthog-react-native';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Keep React Query in sync with device network state.
// Uses expo-network when native module is linked (after prebuild);
// falls back to always-online otherwise.
try {
  const NetworkMod = require('expo-network');
  onlineManager.setEventListener((setOnline) => {
    const subscription = NetworkMod.addNetworkStateListener((state: any) => {
      setOnline(!!state.isConnected);
    });
    return () => subscription.remove();
  });
} catch {
  // expo-network native module not linked — React Query stays always-online
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthStore();
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_900Black,
    DMMono_400Regular,
  });

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function AppStack() {
  const c = useColors();
  const { t } = useTranslation();
  const { isConnected } = useNetworkStatus();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar
        barStyle={c.background === '#FAFAFA' ? 'dark-content' : 'light-content'}
        backgroundColor={c.background}
      />
      {!isConnected && (
        <View style={offlineStyles.banner}>
          <Text style={offlineStyles.bannerText}>{t('offline_banner')}</Text>
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          header: (props) => <CustomHeader {...props} />,
          contentStyle: { backgroundColor: c.background },
          cardStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="record"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="activity/[id]"
          options={{ headerShown: true, title: t('activity_detail_screen') }}
        />
        <Stack.Screen
          name="profile/[id]"
          options={{ headerShown: true, title: t('profile_screen_title') }}
        />
        <Stack.Screen
          name="profile/edit"
          options={{ headerShown: true, title: t('edit_profile_title') }}
        />
        <Stack.Screen
          name="profile/settings"
          options={{ headerShown: true, title: t('settings_title') }}
        />
        <Stack.Screen
          name="profile/equipment"
          options={{ headerShown: true, title: t('equipment_list_title') }}
        />
        <Stack.Screen
          name="profile/equipment/add"
          options={{ headerShown: true, title: t('equipment_add_title') }}
        />
        <Stack.Screen
          name="profile/equipment/[id]/edit"
          options={{ headerShown: true, title: t('equipment_edit_title') }}
        />
        <Stack.Screen
          name="map/create"
          options={{ headerShown: true, title: t('map_create_title') }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: t('notifications_screen_title') }}
        />
        <Stack.Screen
          name="profile/settings/picker"
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen
          name="profile/questionnaire"
          options={{ headerShown: true, title: t('settings_training_preferences') }}
        />
        <Stack.Screen
          name="search"
          options={{ headerShown: false }}
        />
      </Stack>
    </View>
  );
}

const offlineStyles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerText: {
    color: colors.primaryForeground,
    fontFamily: 'Barlow_500Medium',
    fontSize: 13,
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const hash = url.split('#')[1] ?? '';
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token') ?? '';
      if (access_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };

    // App opened from a cold start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // App already open, incoming deep link
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  // Set up push notifications
  usePushNotifications();

  return (
    <PostHogProvider apiKey={POSTHOG_API_KEY} options={{ host: POSTHOG_HOST }}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <I18nextProvider i18n={i18n}>
            <AppStack />
          </I18nextProvider>
        </AuthGate>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
