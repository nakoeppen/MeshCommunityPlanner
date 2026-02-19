/**
 * Settings Store
 * Manages user preferences with persistence across sessions
 * Uses zustand persist middleware
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';

// ============================================================================
// Store Interface
// ============================================================================

export interface SettingsState {
  settings: Settings;
  loading: boolean;
  error: string | null;

  // Actions
  updateSettings: (updates: Partial<Settings>) => void;
  setColorPalette: (palette: Settings['color_palette']) => void;
  setUnitSystem: (system: Settings['unit_system']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  settings: {
    unit_system: 'metric' as const,
    color_palette: 'viridis' as const,
    map_cache_limit_mb: 500,
    terrain_cache_limit_mb: 1000,
    total_cache_limit_mb: 2000,
    sun_hours_peak: 4,
    battery_autonomy_days: 3,
    signal_server_concurrency: 2,
  },
  loading: false,
  error: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      updateSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...updates,
          },
        })),

      setColorPalette: (palette) =>
        set((state) => ({
          settings: {
            ...state.settings,
            color_palette: palette,
          },
        })),

      setUnitSystem: (system) =>
        set((state) => ({
          settings: {
            ...state.settings,
            unit_system: system,
          },
        })),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'mesh-planner-settings',
      // Only persist the settings object, not loading/error state
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
