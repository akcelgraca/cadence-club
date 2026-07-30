import { Platform } from 'react-native';

// Placeholder for health sync service
// Will be implemented in Phase 5 with expo-healthkit and expo-health-connect

export async function syncHealthData(): Promise<number> {
  if (Platform.OS === 'ios') {
    // TODO: Sync from HealthKit
    return 0;
  }
  if (Platform.OS === 'android') {
    // TODO: Sync from Health Connect
    return 0;
  }
  return 0;
}

export async function getHealthSyncStatus(): Promise<{
  isConnected: boolean;
  lastSync: string | null;
  workoutsImported: number;
}> {
  return {
    isConnected: false,
    lastSync: null,
    workoutsImported: 0,
  };
}
