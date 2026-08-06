import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserSettings } from '../lib/types';

const SETTINGS_KEY = 'user-settings';

const DEFAULTS: UserSettings = {
  intensity: 'moderado',
  unitSystem: 'metric',
  notifications: {
    boosts: true,
    comments: true,
    follows: true,
    streaks: true,
    badges: true,
  },
  showStats: true,
  autoPause: true,
  voiceFeedback: true,
  defaultActivityPrivacy: 'everyone',
  gpsAccuracy: 'high',
  theme: 'light',
  defaultMapStyle: 'light',
  language: 'pt',
  weeklySummaryNotifications: true,
  trainingReminderNotifications: true,
};

interface SettingsState {
  settings: UserSettings;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULTS,
  isLoading: true,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          settings: { ...DEFAULTS, ...parsed, notifications: { ...DEFAULTS.notifications, ...(parsed.notifications || {}) } },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    const { settings } = get();
    const merged: UserSettings = {
      ...settings,
      ...partial,
      notifications: partial.notifications
        ? { ...settings.notifications, ...partial.notifications }
        : settings.notifications,
    };
    set({ settings: merged });
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  },

  resetSettings: async () => {
    set({ settings: DEFAULTS });
    await AsyncStorage.removeItem(SETTINGS_KEY);
  },
}));
