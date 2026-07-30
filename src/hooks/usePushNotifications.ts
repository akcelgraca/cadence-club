import { useEffect, useRef } from 'react';
import { router } from 'expo-router';

let Notifications: typeof import('expo-notifications') | null = null;

try {
  Notifications = require('expo-notifications');
} catch {
  // expo-notifications native module not available (e.g., Expo Go)
}

let registerForPushNotifications: (() => Promise<string | null>) | null = null;
let savePushToken: ((token: string) => Promise<void>) | null = null;

if (Notifications) {
  try {
    const push = require('../services/push');
    registerForPushNotifications = push.registerForPushNotifications;
    savePushToken = push.savePushToken;
  } catch {
    // Push service unavailable
  }
}

export function usePushNotifications() {
  const notificationResponseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!Notifications || !registerForPushNotifications || !savePushToken) return;

    // Register for push token
    registerForPushNotifications().then((token: string | null) => {
      if (token) {
        savePushToken!(token);
      }
    });

    // Handle notification tap (app was in background or killed)
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;

        // Navigate based on notification type
        if (data?.type === 'kudo' || data?.type === 'comment') {
          if (data?.activityId) {
            router.push(`/activity/${data.activityId}`);
          }
        } else if (data?.type === 'follow') {
          if (data?.actorId) {
            router.push(`/profile/${data.actorId}`);
          }
        } else if (data?.type === 'badge' || data?.type === 'streak') {
          router.push('/(tabs)/profile');
        } else {
          // Default: open notifications
          router.push('/notifications');
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, []);
}
