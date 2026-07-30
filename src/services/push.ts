import { Platform } from 'react-native';
import { supabase } from './supabase';

function getNotifications() {
  try {
    const Notifications = require('expo-notifications');

    // Configure how notifications are shown when app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return Notifications;
  } catch {
    return null;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '176e0b6a-21b6-4cc2-92aa-144a32cfbbf1',
    });

    // Android channel setup
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Notificacoes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c8f73a',
      });
    }

    return token.data;
  } catch (error) {
    console.warn('[Push] Failed to register:', error);
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', user.user.id);
  } catch (error) {
    console.warn('[Push] Failed to save token:', error);
  }
}

export async function removePushToken(): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('id', user.user.id);
  } catch {
    // ignore on logout
  }
}
