import { create } from 'zustand';

export type SocialTab = 'feed' | 'clubs' | 'messages';

interface SocialState {
  activeTab: SocialTab;
  unreadMessages: number;
  unreadClubs: number;
  setActiveTab: (tab: SocialTab) => void;
  setUnreadMessages: (n: number) => void;
  setUnreadClubs: (n: number) => void;
}

export const useSocialStore = create<SocialState>((set) => ({
  activeTab: 'feed',
  unreadMessages: 0,
  unreadClubs: 0,
  setActiveTab: (activeTab) => set({ activeTab }),
  setUnreadMessages: (unreadMessages) => set({ unreadMessages }),
  setUnreadClubs: (unreadClubs) => set({ unreadClubs }),
}));
