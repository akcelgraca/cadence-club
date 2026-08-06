import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile, ActivityGoal } from '../lib/types';
import { supabase } from '../services/supabase';
import * as authService from '../services/auth';
import { identifyUser, resetAnalytics, track } from '../lib/analytics';

const PROFILE_KEY = 'auth-profile';
const PENDING_REGISTRATION_KEY = 'pending-registration';

interface AuthState {
  session: { user: { id: string; email?: string } } | null;
  profile: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  createProfile: (profile: {
    username: string;
    full_name: string;
    avatar_url?: string;
    goal?: ActivityGoal;
    first_name?: string;
    last_name?: string;
    phone?: string;
    birth_date?: string;
    gender?: string;
    weight_kg?: number;
    height_cm?: number;
    available_days?: number[];
    preferred_activities?: string[];
    session_duration?: string;
    fitness_level?: string;
    weekly_frequency?: number;
    preferred_time?: string;
    training_focus?: string;
    has_completed_questionnaire?: boolean;
    weekly_km_target?: number | null;
  }) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  savePendingRegistration: (data: {
    username: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    birth_date?: string;
    goal?: ActivityGoal;
    country?: string;
    city?: string;
    gender?: string;
    weight_kg?: number;
    height_cm?: number;
    available_days?: number[];
    preferred_activities?: string[];
    session_duration?: string;
    fitness_level?: string;
    weekly_frequency?: number;
    preferred_time?: string;
    training_focus?: string;
    has_completed_questionnaire?: boolean;
    weekly_km_target?: number | null;
  }) => Promise<void>;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  isOnboarded: false,

  initialize: async () => {
    try {
      // Supabase manages session automatically via AsyncStorage
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (session) {
        // Restore cached profile for fast startup
        const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
        let profile: Profile | null = null;

        if (storedProfile) {
          profile = JSON.parse(storedProfile);
        } else {
          // Fetch from server if not cached
          profile = await authService.getProfile(session.user.id);
          if (profile) {
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
          }
        }

        if (profile) {
          identifyUser(session.user.id);
          set({ session, profile, isLoading: false, isOnboarded: true });
          return;
        }

        // Has session but no profile = needs onboarding
        identifyUser(session.user.id);
    set({ session, isLoading: false, isOnboarded: false });
        return;
      }
    } catch {
      // Ignore errors during initialization
    }
    set({ isLoading: false });
  },

  signUp: async (email: string, password: string) => {
    const data = await authService.signUp(email, password);
    track('signed_up', { method: 'email' });
    if (data.session) {
      identifyUser(data.session.user.id);
      set({ session: data.session });
    }
  },

  signIn: async (email: string, password: string) => {
    const data = await authService.signIn(email, password);

    let profile = await authService.getProfile(data.session.user.id);

    // No profile yet — try to create from pending registration data
    if (!profile) {
      const pendingJson = await AsyncStorage.getItem(PENDING_REGISTRATION_KEY);
      if (pendingJson) {
        try {
          const pending = JSON.parse(pendingJson);
          profile = await authService.createProfile({
            id: data.session.user.id,
            username: pending.username,
            full_name: pending.full_name,
            first_name: pending.first_name,
            last_name: pending.last_name,
            phone: pending.phone,
            birth_date: pending.birth_date,
            goal: pending.goal,
            gender: pending.gender,
            weight_kg: pending.weight_kg,
            height_cm: pending.height_cm,
            available_days: pending.available_days,
            preferred_activities: pending.preferred_activities,
            session_duration: pending.session_duration,
            fitness_level: pending.fitness_level,
            weekly_frequency: pending.weekly_frequency,
            preferred_time: pending.preferred_time,
            training_focus: pending.training_focus,
            has_completed_questionnaire: pending.has_completed_questionnaire,
            weekly_km_target: pending.weekly_km_target,
          });

          // Update country/city if present
          if (profile && (pending.country || pending.city)) {
            await authService.updateProfile(profile.id, {
              country: pending.country || undefined,
              city: pending.city || undefined,
            });
          }

          // Profile created, clear pending data
          await AsyncStorage.removeItem(PENDING_REGISTRATION_KEY);
        } catch {
          // If it fails, keep pending data so user can try again
        }
      }
    }

    if (profile) {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }

    set({
      session: data.session,
      profile,
      isOnboarded: !!profile,
    });
  },

  signInWithGoogle: async () => {
    const data = await authService.signInWithGoogle();
    if (data.session) {
      const profile = await authService.getProfile(data.session.user.id);
      if (profile) {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }

      set({
        session: data.session,
        profile,
        isOnboarded: !!profile,
      });
    }
  },

  signInWithApple: async () => {
    const data = await authService.signInWithApple();
    if (data.session) {
      const profile = await authService.getProfile(data.session.user.id);
      if (profile) {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }

      set({
        session: data.session,
        profile,
        isOnboarded: !!profile,
      });
    }
  },

  createProfile: async (profileData) => {
    const { session } = get();
    if (!session) throw new Error('Not authenticated');

    const profile = await authService.createProfile({
      id: session.user.id,
      ...profileData,
    });

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    track('onboarding_completed', {
      goal: profile.goal ?? null,
      has_questionnaire: !!profile.has_completed_questionnaire,
    });
    set({ profile, isOnboarded: true });
  },

  updateProfile: async (updates) => {
    const { profile } = get();
    if (!profile) throw new Error('No profile');

    // Auto-compute full_name from first_name + last_name
    let resolvedUpdates = { ...updates };
    const firstName = updates.first_name ?? profile.first_name;
    const lastName = updates.last_name ?? profile.last_name;
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const computedName = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (computedName) {
        resolvedUpdates.full_name = computedName;
      }
    }

    const updated = await authService.updateProfile(profile.id, resolvedUpdates);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    set({ profile: updated });
  },

  savePendingRegistration: async (data) => {
    await AsyncStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(data));
  },

  completeOnboarding: () => {
    set({ isOnboarded: true });
  },

  signOut: async () => {
    try {
      const { removePushToken } = await import('../services/push');
      await removePushToken();
    } catch {}

    await authService.signOut();
    resetAnalytics();
    await AsyncStorage.removeItem(PROFILE_KEY);
    await AsyncStorage.removeItem(PENDING_REGISTRATION_KEY);
    set({ session: null, profile: null, isOnboarded: false });
  },
}));
