import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Speech from 'expo-speech';
import { useActivityStore } from '../store/activityStore';
import { useSettingsStore } from '../store/settingsStore';
import { GPS_INTERVAL, GPS_DISTANCE_THRESHOLD, MIN_ACTIVITY_DURATION, MIN_ACTIVITY_DISTANCE, AUTO_PAUSE_SPEED_THRESHOLD, AUTO_PAUSE_DELAY_MS } from '../lib/constants';
import { haversineDistance } from '../utils/geo';

const BACKGROUND_TRACKING_TASK = 'BACKGROUND_LOCATION_TRACKING';

// Define the background location task
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const loc = locations[locations.length - 1];
  const point = {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    elevation: loc.coords.altitude ?? null,
    timestamp: new Date(loc.timestamp).toISOString(),
  };

  // Update store from background
  useActivityStore.getState().addPoint(point);
  useActivityStore.getState().updateLocation({ lat: point.lat, lng: point.lng });
  useActivityStore.getState().setGpsSignal('good');
});

export function useLocationTracker() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const paceWindowRef = useRef<Array<{ time: number; distance: number }>>([]);
  const startTimeRef = useRef<number>(0);
  const lastSpeedRef = useRef<number>(0);
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedKmRef = useRef<number>(0);

  const trackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request permissions
  useEffect(() => {
    (async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à localização.');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        setHasPermission(true);
      } else {
        // Foreground only is OK for MVP
        setHasPermission(true);
      }
    })();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  // Calculate moving average pace using the last 30s of data
  const calculatePace = useCallback((totalDistance: number, totalElapsed: number) => {
    const now = Date.now();
    const windowStart = now - 30000; // 30 seconds ago

    paceWindowRef.current.push({ time: now, distance: totalDistance });
    // Keep only entries from the last 30s
    paceWindowRef.current = paceWindowRef.current.filter((e) => e.time >= windowStart);

    if (paceWindowRef.current.length < 2) return null;

    const first = paceWindowRef.current[0];
    const last = paceWindowRef.current[paceWindowRef.current.length - 1];
    const windowDistance = last.distance - first.distance;
    const windowTime = (last.time - first.time) / 1000; // seconds

    if (windowDistance < 1 || windowTime < 1) return null;
    // seconds per km
    return (windowTime / windowDistance) * 1000;
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!hasPermission) return;

    const isFreshStart = startTimeRef.current === 0;

    useActivityStore.getState().setGpsSignal('weak');
    if (isFreshStart) {
      startTimeRef.current = Date.now();
    }
    lastPointRef.current = null;
    paceWindowRef.current = [];
    if (isFreshStart) {
      lastAnnouncedKmRef.current = 0;
    }

    try {
      // Start foreground tracking
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: GPS_DISTANCE_THRESHOLD,
          timeInterval: GPS_INTERVAL,
        },
        (location) => {
          const point = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            elevation: location.coords.altitude ?? null,
            timestamp: new Date(location.timestamp).toISOString(),
          };

          useActivityStore.getState().addPoint(point);
          useActivityStore.getState().updateLocation({ lat: point.lat, lng: point.lng });
          useActivityStore.getState().setGpsSignal('good');

          // Calculate distance
          let totalDistance = useActivityStore.getState().distance;
          if (lastPointRef.current) {
            const segmentDist = haversineDistance(
              lastPointRef.current.lat, lastPointRef.current.lng,
              point.lat, point.lng
            );
            if (segmentDist > 0 && segmentDist < 100) { // Filter GPS jumps
              totalDistance += segmentDist;
            }
          }
          lastPointRef.current = { lat: point.lat, lng: point.lng };

          // Calculate elapsed time, subtracting any paused duration
          const totalPausedMs = useActivityStore.getState().totalPausedDuration;
          const elapsed = (Date.now() - startTimeRef.current - totalPausedMs) / 1000;

          // Calculate pace
          const currentPace = calculatePace(totalDistance, elapsed);
          const avgPace = totalDistance > 10 ? (elapsed / totalDistance) * 1000 : null;

          // Calculate elevation gain
          const elevationGain = useActivityStore.getState().elevationGain;
          const currentElevation = location.coords.altitude ?? 0;
          const lastElevation = useActivityStore.getState().points.length > 1
            ? (useActivityStore.getState().points[useActivityStore.getState().points.length - 2].elevation ?? 0)
            : currentElevation;
          const elevationDelta = currentElevation - lastElevation;
          const totalElevationGain = elevationGain + (elevationDelta > 0 ? elevationDelta : 0);

          // Only update metrics while actively recording (not paused)
          if (useActivityStore.getState().state === 'recording') {
            useActivityStore.getState().updateMetrics({
              elapsedTime: elapsed,
              distance: totalDistance,
              currentPace,
              avgPace,
              elevationGain: totalElevationGain,
            });
          }

          // --- Auto-pause detection ---
          const settings = useSettingsStore.getState().settings;
          const speed = location.coords.speed ?? 0;
          lastSpeedRef.current = speed;

          if (settings.autoPause && useActivityStore.getState().state === 'recording') {
            if (speed < AUTO_PAUSE_SPEED_THRESHOLD) {
              if (!autoPauseTimerRef.current) {
                autoPauseTimerRef.current = setTimeout(() => {
                  if (lastSpeedRef.current < AUTO_PAUSE_SPEED_THRESHOLD
                    && useActivityStore.getState().state === 'recording') {
                    useActivityStore.getState().pause();
                  }
                  autoPauseTimerRef.current = null;
                }, AUTO_PAUSE_DELAY_MS);
              }
            } else {
              if (autoPauseTimerRef.current) {
                clearTimeout(autoPauseTimerRef.current);
                autoPauseTimerRef.current = null;
              }
            }
          }

          // --- Voice feedback per km ---
          if (settings.voiceFeedback) {
            const kmCompleted = Math.floor(totalDistance / 1000);
            if (kmCompleted > lastAnnouncedKmRef.current) {
              lastAnnouncedKmRef.current = kmCompleted;
              const paceMin = currentPace ? Math.floor(currentPace / 60) : 0;
              const paceSec = currentPace ? Math.floor(currentPace % 60) : 0;
              const paceStr = currentPace ? `${paceMin}'${paceSec.toString().padStart(2, '0')}` : '--';
              const text = `${kmCompleted} quilometro${kmCompleted > 1 ? 's' : ''}. Ritmo ${paceStr}.`;
              Speech.speak(text, { language: 'pt-PT' });
            }
          }
        }
      );

      // Start background tracking
      const isBgAvailable = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      if (!isBgAvailable) {
        await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: GPS_DISTANCE_THRESHOLD,
          timeInterval: GPS_INTERVAL,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Cadence Club',
            notificationBody: 'A gravar a tua atividade...',
            notificationColor: '#4A90D9',
          },
        });
      }

      setIsTracking(true);
    } catch (err) {
      useActivityStore.getState().setGpsSignal('none');
      // Still set tracking as true even without GPS - user can manually stop
      setIsTracking(true);
    }
  }, [hasPermission, calculatePace]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }

    // Clear auto-pause timer
    if (autoPauseTimerRef.current) {
      clearTimeout(autoPauseTimerRef.current);
      autoPauseTimerRef.current = null;
    }

    try {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    } catch {
      // Ignore if not started
    }

    setIsTracking(false);
  }, []);

  // Check if activity is valid (minimum duration and distance)
  const isValidActivity = useCallback(() => {
    const { elapsedTime, distance } = useActivityStore.getState();
    return elapsedTime >= MIN_ACTIVITY_DURATION && distance >= MIN_ACTIVITY_DISTANCE;
  }, []);

  return {
    hasPermission,
    isTracking,
    startTracking,
    stopTracking,
    isValidActivity,
  };
}
