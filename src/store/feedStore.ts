import { create } from 'zustand';
import type { ActivityCategory } from '../lib/types';

interface FeedFilter {
  category: ActivityCategory | 'all';
  following: boolean;
  searchQuery: string;
}

interface FeedState {
  filter: FeedFilter;
  setFilter: (filter: Partial<FeedFilter>) => void;
  resetFilter: () => void;
}

const defaultFilter: FeedFilter = {
  category: 'all',
  following: false,
  searchQuery: '',
};

export const useFeedStore = create<FeedState>((set) => ({
  filter: defaultFilter,
  setFilter: (filter) => set((s) => ({ filter: { ...s.filter, ...filter } })),
  resetFilter: () => set({ filter: defaultFilter }),
}));
