import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layer, LayerPreset, LayerType } from '../types/layer';

interface LayerState {
  // State
  layers: Map<string, Layer>;
  activeLayerIds: Set<string>;
  layerOrder: string[];
  layerOpacity: Map<string, number>;
  presets: LayerPreset[];

  // Actions - Layer Management
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  toggleLayer: (layerId: string) => void;
  setOpacity: (layerId: string, opacity: number) => void;
  reorderLayers: (oldIndex: number, newIndex: number) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;

  // Actions - Preset Management
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  updatePreset: (presetId: string, updates: Partial<LayerPreset>) => void;

  // Selectors
  getLayersByType: (type: LayerType) => Layer[];
  getVisibleLayers: () => Layer[];
  getLayer: (layerId: string) => Layer | undefined;

  // Utilities
  reset: () => void;
}

const initialState = {
  layers: new Map<string, Layer>(),
  activeLayerIds: new Set<string>(),
  layerOrder: [] as string[],
  layerOpacity: new Map<string, number>(),
  presets: [] as LayerPreset[],
};

// Helper function to generate unique IDs
const generateId = () => {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useLayerStore = create<LayerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Layer Management
      addLayer: (layer) =>
        set((state) => {
          const layers = new Map(state.layers);
          layers.set(layer.id, layer);

          const activeLayerIds = new Set(state.activeLayerIds);
          if (layer.visible) {
            activeLayerIds.add(layer.id);
          }

          const layerOpacity = new Map(state.layerOpacity);
          layerOpacity.set(layer.id, layer.opacity);

          return {
            layers,
            activeLayerIds,
            layerOrder: [...state.layerOrder, layer.id],
            layerOpacity,
          };
        }),

      removeLayer: (layerId) =>
        set((state) => {
          const layers = new Map(state.layers);
          layers.delete(layerId);

          const activeLayerIds = new Set(state.activeLayerIds);
          activeLayerIds.delete(layerId);

          const layerOpacity = new Map(state.layerOpacity);
          layerOpacity.delete(layerId);

          return {
            layers,
            activeLayerIds,
            layerOrder: state.layerOrder.filter((id) => id !== layerId),
            layerOpacity,
          };
        }),

      toggleLayer: (layerId) =>
        set((state) => {
          // Check if layer exists
          if (!state.layers.has(layerId)) {
            return state;
          }

          const activeLayerIds = new Set(state.activeLayerIds);
          if (activeLayerIds.has(layerId)) {
            activeLayerIds.delete(layerId);
          } else {
            activeLayerIds.add(layerId);
          }
          return { activeLayerIds };
        }),

      setOpacity: (layerId, opacity) =>
        set((state) => {
          const layerOpacity = new Map(state.layerOpacity);
          layerOpacity.set(layerId, opacity);
          return { layerOpacity };
        }),

      reorderLayers: (oldIndex, newIndex) =>
        set((state) => {
          // Validate indices
          if (
            oldIndex < 0 ||
            oldIndex >= state.layerOrder.length ||
            newIndex < 0
          ) {
            return state;
          }

          const layerOrder = [...state.layerOrder];
          const [removed] = layerOrder.splice(oldIndex, 1);
          layerOrder.splice(newIndex, 0, removed);
          return { layerOrder };
        }),

      updateLayer: (layerId, updates) =>
        set((state) => {
          const layers = new Map(state.layers);
          const layer = layers.get(layerId);
          if (layer) {
            layers.set(layerId, { ...layer, ...updates });
          }
          return { layers };
        }),

      // Preset Management
      savePreset: (name) =>
        set((state) => {
          const preset: LayerPreset = {
            id: generateId(),
            name,
            layers: state.layerOrder,
            visibility: Object.fromEntries(
              Array.from(state.layers.values()).map((layer) => [
                layer.id,
                state.activeLayerIds.has(layer.id),
              ])
            ),
            opacity: Object.fromEntries(state.layerOpacity),
            order: state.layerOrder,
            createdAt: Date.now(),
          };
          return { presets: [...state.presets, preset] };
        }),

      loadPreset: (presetId) =>
        set((state) => {
          const preset = state.presets.find((p) => p.id === presetId);
          if (!preset) return state;

          const activeLayerIds = new Set<string>();
          Object.entries(preset.visibility).forEach(([layerId, visible]) => {
            if (visible) activeLayerIds.add(layerId);
          });

          const layerOpacity = new Map(Object.entries(preset.opacity));

          return {
            activeLayerIds,
            layerOpacity,
            layerOrder: preset.order,
          };
        }),

      deletePreset: (presetId) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
        })),

      updatePreset: (presetId, updates) =>
        set((state) => ({
          presets: state.presets.map((preset) =>
            preset.id === presetId ? { ...preset, ...updates } : preset
          ),
        })),

      // Selectors
      getLayersByType: (type) => {
        const state = get();
        return Array.from(state.layers.values()).filter(
          (layer) => layer.type === type
        );
      },

      getVisibleLayers: () => {
        const state = get();
        return Array.from(state.layers.values()).filter((layer) =>
          state.activeLayerIds.has(layer.id)
        );
      },

      getLayer: (layerId) => {
        return get().layers.get(layerId);
      },

      // Utilities
      reset: () => set(initialState),
    }),
    {
      name: 'layer-store',
      partialize: (state) => ({
        presets: state.presets,
      }),
    }
  )
);
