import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';

// Placeholder for expo-health-connect integration
// Will be fully implemented in Phase 5

export function useHealthConnect() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const requestAuthorization = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    setIsLoading(true);
    try {
      // const result = await HealthConnect.requestAuthorization(...)
      setIsAuthorized(true);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível aceder ao Health Connect.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isAuthorized, isLoading, requestAuthorization };
}
