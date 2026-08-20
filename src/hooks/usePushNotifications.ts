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

        // `referenceId` é o campo geral; o `activityId` só existe para as
        // notificações antigas, enviadas antes de haver tipos que não fossem
        // atividades. Uma delas pode estar na bandeja do telemóvel há dias.
        const ref = data?.referenceId ?? data?.activityId;

        switch (data?.type) {
          case 'kudo':
          case 'comment':
            if (ref) router.push(`/activity/${ref}`);
            else router.push('/notifications');
            break;
          case 'follow':
            if (data?.actorId) router.push(`/profile/${data.actorId}`);
            else router.push('/notifications');
            break;
          case 'badge':
          case 'streak':
            router.push('/(tabs)/profile');
            break;
          case 'club_request':
          case 'club_accepted':
          case 'event':
            if (ref) router.push(`/club/${ref}`);
            else router.push('/notifications');
            break;
          case 'message':
            if (ref) router.push(`/messages/${ref}`);
            else router.push('/notifications');
            break;
          default:
            router.push('/notifications');
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, []);
}
