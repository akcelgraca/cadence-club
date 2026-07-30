import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

let NetworkModule: typeof import('expo-network') | null = null;

// Lazy-load the native module — it may not be linked in dev builds.
// After `npx expo prebuild`, the native module becomes available.
try {
  if (Platform.OS !== 'web') {
    NetworkModule = require('expo-network');
  }
} catch {
  // Native module not linked — assume always online
}

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    if (!NetworkModule) return;

    NetworkModule.getNetworkStateAsync().then((state) => {
      setIsConnected(!!state.isConnected);
      setIsInternetReachable(!!state.isInternetReachable);
    });

    const subscription = NetworkModule.addNetworkStateListener((state) => {
      setIsConnected(!!state.isConnected);
      setIsInternetReachable(!!state.isInternetReachable);
    });

    return () => subscription.remove();
  }, []);

  return { isConnected, isInternetReachable };
}
