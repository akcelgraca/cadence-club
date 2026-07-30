import { create } from 'zustand';
import type { RouteFilters } from '../lib/types';

interface RouteStore {
  // Map view state
  viewport: { center: [number, number]; zoom: number };
  setViewport: (viewport: { center: [number, number]; zoom: number }) => void;

  // Route creation state
  isCreating: boolean;
  startCreating: () => void;
  cancelCreating: () => void;
  draftWaypoints: [number, number][];
  addWaypoint: (coord: [number, number]) => void;
  removeWaypoint: (index: number) => void;
  clearWaypoints: () => void;

  // Filters
  filters: RouteFilters;
  setFilters: (filters: RouteFilters) => void;

  // Selected route
  selectedRouteId: string | null;
  selectRoute: (id: string | null) => void;
  clearSelection: () => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  // Map view state
  viewport: { center: [-9.1393, 38.7223], zoom: 12 }, // Default: Lisbon
  setViewport: (viewport) => set({ viewport }),

  // Route creation
  isCreating: false,
  startCreating: () => set({ isCreating: true, draftWaypoints: [] }),
  cancelCreating: () => set({ isCreating: false, draftWaypoints: [] }),
  draftWaypoints: [],
  addWaypoint: (coord) =>
    set((state) => ({ draftWaypoints: [...state.draftWaypoints, coord] })),
  removeWaypoint: (index) =>
    set((state) => ({
      draftWaypoints: state.draftWaypoints.filter((_, i) => i !== index),
    })),
  clearWaypoints: () => set({ draftWaypoints: [] }),

  // Filters
  filters: {},
  setFilters: (filters) => set({ filters }),

  // Selected route
  selectedRouteId: null,
  selectRoute: (id) => set({ selectedRouteId: id }),
  clearSelection: () => set({ selectedRouteId: null }),
}));
