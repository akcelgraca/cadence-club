import { create } from 'zustand';
import type { ActivityType, ActivityState, RunType, SurfaceType } from '../lib/types';

interface GpsPoint {
  lat: number;
  lng: number;
  elevation: number | null;
  timestamp: string;
}

interface ActivityRecording {
  type: ActivityType | null;
  runType: RunType | null;
  state: ActivityState;
  countdown: number;
  startTime: string | null;
  elapsedTime: number; // segundos
  distance: number; // metros
  currentPace: number | null; // segundos/km
  avgPace: number | null;
  elevationGain: number;
  points: GpsPoint[];
  currentLocation: { lat: number; lng: number } | null;
  gpsSignal: 'none' | 'weak' | 'good';
  mood: number | null;
  title: string;
  description: string;
  isPublic: boolean;
  surfaceType: SurfaceType | null;
  equipmentId: string | null;
  selectedRouteId: string | null;
  selectedRouteName: string | null;
  selectedRoutePath: [number, number][] | null;
  totalPausedDuration: number; // ms acumulados em pausa
  pauseStartTime: number | null;

  // Actions
  selectType: (type: ActivityType, runType?: RunType) => void;
  selectRoute: (routeId: string, name: string, path: [number, number][]) => void;
  clearRoute: () => void;
  startCountdown: () => void;
  tickCountdown: () => void;
  startRecording: () => void;
  updateMetrics: (metrics: {
    elapsedTime: number;
    distance: number;
    currentPace: number | null;
    avgPace: number | null;
    elevationGain: number;
  }) => void;
  addPoint: (point: GpsPoint) => void;
  updateLocation: (location: { lat: number; lng: number }) => void;
  setGpsSignal: (signal: 'none' | 'weak' | 'good') => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  setMood: (mood: number | null) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setVisibility: (isPublic: boolean) => void;
  setSurfaceType: (surfaceType: SurfaceType | null) => void;
  setEquipmentId: (equipmentId: string | null) => void;
  reset: () => void;
  restoreState: (state: Partial<ActivityRecording>) => void;
}

const initialState = {
  type: null,
  runType: null,
  state: 'idle' as ActivityState,
  countdown: 3,
  startTime: null,
  elapsedTime: 0,
  distance: 0,
  currentPace: null,
  avgPace: null,
  elevationGain: 0,
  points: [],
  currentLocation: null,
  gpsSignal: 'none' as const,
  mood: null,
  title: '',
  description: '',
  isPublic: true,
  surfaceType: null,
  equipmentId: null,
  selectedRouteId: null,
  selectedRouteName: null,
  selectedRoutePath: null,
  totalPausedDuration: 0,
  pauseStartTime: null,
};

export const useActivityStore = create<ActivityRecording>((set) => ({
  ...initialState,

  selectType: (type, runType) => set({ type, runType: runType ?? null }),

  selectRoute: (routeId, name, path) =>
    set({ selectedRouteId: routeId, selectedRouteName: name, selectedRoutePath: path }),

  clearRoute: () => set({ selectedRouteId: null, selectedRouteName: null, selectedRoutePath: null }),

  startCountdown: () => set({ state: 'countdown', countdown: 3 }),

  tickCountdown: () =>
    set((s) => {
      if (s.countdown <= 1) {
        return { countdown: 0, state: 'recording', startTime: new Date().toISOString() };
      }
      return { countdown: s.countdown - 1 };
    }),

  startRecording: () =>
    set({ state: 'recording', startTime: new Date().toISOString(), elapsedTime: 0 }),

  updateMetrics: (metrics) =>
    set({
      elapsedTime: metrics.elapsedTime,
      distance: metrics.distance,
      currentPace: metrics.currentPace,
      avgPace: metrics.avgPace,
      elevationGain: metrics.elevationGain,
    }),

  addPoint: (point) =>
    set((s) => ({
      points: [...s.points, point],
    })),

  updateLocation: (location) => set({ currentLocation: location }),

  setGpsSignal: (signal) => set({ gpsSignal: signal }),

  pause: () => set({ state: 'paused', pauseStartTime: Date.now() }),

  resume: () =>
    set((s) => ({
      state: 'recording',
      totalPausedDuration: s.totalPausedDuration + (Date.now() - (s.pauseStartTime ?? Date.now())),
      pauseStartTime: null,
    })),

  finish: () => set({ state: 'finished' }),

  setMood: (mood) => set({ mood }),

  setTitle: (title) => set({ title }),

  setDescription: (description) => set({ description }),

  setVisibility: (isPublic) => set({ isPublic: isPublic }),

  setSurfaceType: (surfaceType) => set({ surfaceType }),

  setEquipmentId: (equipmentId) => set({ equipmentId }),

  reset: () => set(initialState),

  restoreState: (savedState) => set({ ...savedState }),
}));
