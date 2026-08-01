import { create } from 'zustand';
import type { ActivityCategory } from '../lib/types';

interface FeedFilter {
  category: ActivityCategory | 'all';
  following: boolean;
  searchQuery: string;
}

interface FeedState {
  filter: FeedFilter;
  /** Há atividades novas de outros utilizadores desde o último refresh (realtime). */
  hasNewActivities: boolean;
  setFilter: (filter: Partial<FeedFilter>) => void;
  resetFilter: () => void;
  setHasNewActivities: (value: boolean) => void;
}

const defaultFilter: FeedFilter = {
  category: 'all',
  following: false,
  searchQuery: '',
};

export const useFeedStore = create<FeedState>((set) => ({
  filter: defaultFilter,
  hasNewActivities: false,
  setFilter: (filter) => set((s) => ({ filter: { ...s.filter, ...filter } })),
  resetFilter: () => set({ filter: defaultFilter }),
  setHasNewActivities: (hasNewActivities) => set({ hasNewActivities }),
}));
