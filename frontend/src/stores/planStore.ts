/**
 * Plan Store
 * Manages current plan, nodes, coverage results, and topology
 * Uses zustand with temporal middleware for undo/redo
 */

import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  Plan,
  Node,
  CoverageResult,
  TopologyGraph,
  ResilienceMetrics,
} from '../types';

// ============================================================================
// Store Interface
// ============================================================================

export interface PlanState {
  // Current plan
  current_plan: Plan | null;
  nodes: Node[];
  dirty: boolean;

  // Coverage & propagation results (cached for current plan)
  coverage_results: Map<string, CoverageResult>;

  // Topology (cached for current plan)
  topology_graph: TopologyGraph | null;
  resilience_metrics: ResilienceMetrics | null;

  // Actions
  setPlan: (plan: Plan) => void;
  updatePlan: (updates: Partial<Plan>) => void;
  clearPlan: () => void;

  addNode: (node: Node) => void;
  updateNode: (node_id: string, updates: Partial<Node>) => void;
  removeNode: (node_id: string) => void;
  setNodes: (nodes: Node[]) => void;

  setCoverageResult: (node_id: string, result: CoverageResult) => void;
  clearCoverageResults: () => void;

  setTopology: (graph: TopologyGraph, metrics: ResilienceMetrics) => void;
  clearTopology: () => void;

  markDirty: () => void;
  clearDirty: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  current_plan: null,
  nodes: [],
  dirty: false,
  coverage_results: new Map<string, CoverageResult>(),
  topology_graph: null,
  resilience_metrics: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const usePlanStore = create<PlanState>()(
  temporal(
    (set, get) => ({
      ...initialState,

      // Plan actions
      setPlan: (plan) =>
        set({
          current_plan: plan,
          nodes: [], // Clear nodes when switching plans
          dirty: false,
        }),

      updatePlan: (updates) =>
        set((state) => {
          if (!state.current_plan) return state;
          return {
            current_plan: { ...state.current_plan, ...updates },
            dirty: true,
          };
        }),

      clearPlan: () => set(initialState),

      // Node actions
      addNode: (node) =>
        set((state) => ({
          nodes: [...state.nodes, node],
          dirty: true,
        })),

      updateNode: (node_id, updates) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === node_id ? { ...node, ...updates } : node
          ),
          dirty: true,
        })),

      removeNode: (node_id) =>
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== node_id),
          dirty: true,
        })),

      setNodes: (nodes) =>
        set({
          nodes,
          dirty: true,
        }),

      // Coverage actions
      setCoverageResult: (node_id, result) =>
        set((state) => {
          const newResults = new Map(state.coverage_results);
          newResults.set(node_id, result);
          return { coverage_results: newResults };
        }),

      clearCoverageResults: () =>
        set({
          coverage_results: new Map(),
        }),

      // Topology actions
      setTopology: (graph, metrics) =>
        set({
          topology_graph: graph,
          resilience_metrics: metrics,
        }),

      clearTopology: () =>
        set({
          topology_graph: null,
          resilience_metrics: null,
        }),

      // Dirty flag actions
      markDirty: () => set({ dirty: true }),

      clearDirty: () => set({ dirty: false }),

      // Reset store to initial state
      reset: () => set(initialState),
    }),
    {
      limit: 50,
      equality: (pastState, currentState) =>
        pastState.nodes?.length === currentState.nodes?.length &&
        pastState.current_plan?.id === currentState.current_plan?.id,
    }
  )
);
