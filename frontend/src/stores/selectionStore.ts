import { create } from 'zustand';
import type { SelectionMode } from '../types/selection';

interface Node {
  id: number;
  name: string;
  [key: string]: any;
}

interface SelectionState {
  // State
  selectedNodeIds: Set<number>;
  selectionMode: SelectionMode;
  clipboardNodes: Node[];
  selectionHistory: Set<number>[];
  historyIndex: number;

  // Actions - Selection
  selectNode: (id: number, mode: 'add' | 'toggle' | 'replace') => void;
  selectNodes: (ids: number[], mode: 'add' | 'toggle' | 'replace') => void;
  clearSelection: () => void;

  // Actions - Clipboard
  copy: (nodes: Node[]) => void;

  // Actions - Undo/Redo
  undoSelection: () => void;
  redoSelection: () => void;

  // Selectors
  getSelectionCount: () => number;
  isSelected: (id: number) => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Settings
  setSelectionMode: (mode: SelectionMode) => void;

  // Utilities
  reset: () => void;
}

const initialState = {
  selectedNodeIds: new Set<number>(),
  selectionMode: 'click' as SelectionMode,
  clipboardNodes: [] as Node[],
  selectionHistory: [new Set<number>()] as Set<number>[], // Start with empty selection in history
  historyIndex: 0, // Start at index 0
};

export const useSelectionStore = create<SelectionState>((set, get) => ({
  ...initialState,

  // Selection Actions
  selectNode: (id, mode) =>
    set((state) => {
      const selectedNodeIds = new Set(state.selectedNodeIds);

      if (mode === 'replace') {
        selectedNodeIds.clear();
        selectedNodeIds.add(id);
      } else if (mode === 'add') {
        selectedNodeIds.add(id);
      } else if (mode === 'toggle') {
        if (selectedNodeIds.has(id)) {
          selectedNodeIds.delete(id);
        } else {
          selectedNodeIds.add(id);
        }
      }

      // Add to history
      const selectionHistory = state.selectionHistory.slice(0, state.historyIndex + 1);
      selectionHistory.push(new Set(selectedNodeIds));

      return {
        selectedNodeIds,
        selectionHistory,
        historyIndex: selectionHistory.length - 1,
      };
    }),

  selectNodes: (ids, mode) =>
    set((state) => {
      const selectedNodeIds = new Set(state.selectedNodeIds);

      if (mode === 'replace') {
        selectedNodeIds.clear();
        ids.forEach((id) => selectedNodeIds.add(id));
      } else if (mode === 'add') {
        ids.forEach((id) => selectedNodeIds.add(id));
      } else if (mode === 'toggle') {
        ids.forEach((id) => {
          if (selectedNodeIds.has(id)) {
            selectedNodeIds.delete(id);
          } else {
            selectedNodeIds.add(id);
          }
        });
      }

      // Add to history
      const selectionHistory = state.selectionHistory.slice(0, state.historyIndex + 1);
      selectionHistory.push(new Set(selectedNodeIds));

      return {
        selectedNodeIds,
        selectionHistory,
        historyIndex: selectionHistory.length - 1,
      };
    }),

  clearSelection: () =>
    set((state) => {
      const selectionHistory = state.selectionHistory.slice(0, state.historyIndex + 1);
      selectionHistory.push(new Set());

      return {
        selectedNodeIds: new Set(),
        selectionHistory,
        historyIndex: selectionHistory.length - 1,
      };
    }),

  // Clipboard Actions
  copy: (nodes) =>
    set({
      clipboardNodes: nodes,
    }),

  // Undo/Redo
  undoSelection: () =>
    set((state) => {
      if (state.historyIndex > 0) {
        return {
          historyIndex: state.historyIndex - 1,
          selectedNodeIds: new Set(state.selectionHistory[state.historyIndex - 1]),
        };
      }
      return state;
    }),

  redoSelection: () =>
    set((state) => {
      if (state.historyIndex < state.selectionHistory.length - 1) {
        return {
          historyIndex: state.historyIndex + 1,
          selectedNodeIds: new Set(state.selectionHistory[state.historyIndex + 1]),
        };
      }
      return state;
    }),

  // Selectors
  getSelectionCount: () => {
    return get().selectedNodeIds.size;
  },

  isSelected: (id) => {
    return get().selectedNodeIds.has(id);
  },

  canUndo: () => {
    return get().historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.selectionHistory.length - 1;
  },

  // Settings
  setSelectionMode: (mode) => set({ selectionMode: mode }),

  // Utilities
  reset: () => set(initialState),
}));
