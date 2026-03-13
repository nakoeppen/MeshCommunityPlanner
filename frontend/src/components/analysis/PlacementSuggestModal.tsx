/**
 * PlacementSuggestModal Component
 * Suggests optimal locations for new mesh nodes based on existing network
 * coverage gaps. Results appear as ghost markers on the map.
 *
 * Guided 1-2-3 step flow:
 *   Step 1 — Node Range (auto-calculated from radio config, read-only)
 *   Step 2 — Search Area (user-configurable search parameters)
 *   Step 3 — Results (suggestions with accept/clear actions)
 */

import { useState, useEffect, useCallback } from 'react';
import { useMapStore, type PlacementSuggestion } from '../../stores/mapStore';
import { useDraggable } from '../../hooks/useDraggable';
import { useNumberInput } from '../../hooks/useNumberInput';
import './PlacementSuggestModal.css';

interface PlacementSuggestModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ latitude: number; longitude: number; uuid: string; name: string }>;
  nodeRangeM: number;
  nodeRangeDescription: string;
  onSuggest: (params: {
    existing_nodes: Array<{ latitude: number; longitude: number; name: string }>;
    bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
    coverage_radius_m: number;
    grid_resolution_m: number;
    max_candidates: number;
  }) => Promise<PlacementSuggestion[]>;
  onAcceptNode: (lat: number, lon: number, name: string) => Promise<void>;
}

function scoreColorClass(score: number): string {
  if (score > 0.7) return 'score-green';
  if (score > 0.4) return 'score-yellow';
  return 'score-red';
}

export function PlacementSuggestModal({
  isOpen,
  onClose,
  nodes,
  nodeRangeM,
  nodeRangeDescription,
  onSuggest,
  onAcceptNode,
}: PlacementSuggestModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs (Step 2 — Search Area)
  const searchArea = useNumberInput(3000, 500, 20000);
  const [gridResolution, setGridResolution] = useState(200);
  const [maxCandidates, setMaxCandidates] = useState(5);

  // Results
  const [suggestions, setSuggestions] = useState<PlacementSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      searchArea.reset(3000);
      setGridResolution(200);
      setMaxCandidates(5);
      setSuggestions([]);
      setIsLoading(false);
      setAcceptingIndex(null);
      resetDrag();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resetDrag]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Close handler: clear suggestions from map store
  const handleClose = useCallback(() => {
    useMapStore.getState().clearPlacementSuggestions();
    useMapStore.getState().clearPlacementSearchBounds();
    setSuggestions([]);
    onClose();
  }, [onClose]);

  // Compute bounds from existing nodes with padding based on searchArea.
  const computeBounds = useCallback(() => {
    if (nodes.length === 0) {
      return { min_lat: 0, min_lon: 0, max_lat: 0, max_lon: 0 };
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const n of nodes) {
      if (n.latitude < minLat) minLat = n.latitude;
      if (n.latitude > maxLat) maxLat = n.latitude;
      if (n.longitude < minLon) minLon = n.longitude;
      if (n.longitude > maxLon) maxLon = n.longitude;
    }

    // Padding based on user-configurable search area
    const midLat = (minLat + maxLat) / 2;
    const padM = Math.max(searchArea.value, 2000);
    const padLat = padM / 111_320;
    const padLon = padM / (111_320 * Math.cos((midLat * Math.PI) / 180));

    return {
      min_lat: minLat - padLat,
      min_lon: minLon - padLon,
      max_lat: maxLat + padLat,
      max_lon: maxLon + padLon,
    };
  }, [nodes, searchArea.value]);

  // Get suggestions from API
  const handleGetSuggestions = useCallback(async () => {
    if (nodes.length === 0) return;
    setIsLoading(true);
    setSuggestions([]);
    useMapStore.getState().clearPlacementSuggestions();

    try {
      const existingNodes = nodes.map((n) => ({
        latitude: n.latitude,
        longitude: n.longitude,
        name: n.name,
      }));
      const bounds = computeBounds();
      // Push search bounds to map store for visualisation
      useMapStore.getState().setPlacementSearchBounds(bounds);
      const results = await onSuggest({
        existing_nodes: existingNodes,
        bounds,
        coverage_radius_m: nodeRangeM,
        grid_resolution_m: gridResolution,
        max_candidates: maxCandidates,
      });
      setSuggestions(results);
      useMapStore.getState().setPlacementSuggestions(results, nodeRangeM);
    } catch {
      // Error is handled by the caller; keep empty state
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, nodeRangeM, gridResolution, maxCandidates, computeBounds, onSuggest]);

  // Accept a single suggestion
  const handleAccept = useCallback(async (index: number) => {
    const s = suggestions[index];
    if (!s) return;
    setAcceptingIndex(index);
    try {
      await onAcceptNode(s.latitude, s.longitude, `Suggested Node ${index + 1}`);
      const updated = suggestions.filter((_, i) => i !== index);
      setSuggestions(updated);
      useMapStore.getState().setPlacementSuggestions(updated);
    } finally {
      setAcceptingIndex(null);
    }
  }, [suggestions, onAcceptNode]);

  // Accept all remaining suggestions
  const handleAcceptAll = useCallback(async () => {
    for (let i = suggestions.length - 1; i >= 0; i--) {
      const s = suggestions[i];
      setAcceptingIndex(i);
      try {
        await onAcceptNode(s.latitude, s.longitude, `Suggested Node ${i + 1}`);
      } finally {
        setAcceptingIndex(null);
      }
    }
    setSuggestions([]);
    useMapStore.getState().clearPlacementSuggestions();
  }, [suggestions, onAcceptNode]);

  // Clear all suggestions
  const handleClear = useCallback(() => {
    setSuggestions([]);
    useMapStore.getState().clearPlacementSuggestions();
    useMapStore.getState().clearPlacementSearchBounds();
  }, []);

  if (!isOpen) return null;

  const canSubmit = nodes.length > 0 && !isLoading;

  // Format node range for display
  const rangeDisplay = nodeRangeM >= 1000
    ? `${(nodeRangeM / 1000).toFixed(1)} km`
    : `${nodeRangeM} m`;

  return (
    <div
      className="place-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Automatic Node Placement Suggestions"
    >
      <div
        className="place-modal"
        ref={modalRef}
        style={dragStyle}
      >
        {/* Header — drag handle */}
        <div className="place-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="place-title">Node Placement Suggestions
              <span className="place-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="place-summary">
              Find optimal locations for new mesh nodes in 3 steps
            </p>
          </div>
          <button className="place-close" type="button" onClick={handleClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="place-body">

          {/* ── Step 1: Node Range (read-only, auto-calculated) ── */}
          <div className="place-step">
            <div className="place-step-header">
              <span className="place-step-number">1</span>
              <span className="place-step-title">Node Range</span>
            </div>
            <div className="place-range-display" title="Auto-calculated from your network radio configuration (device, antenna, modem preset)">
              {rangeDisplay}
            </div>
            <span className="place-range-description" title={nodeRangeDescription}>
              {nodeRangeDescription}
            </span>
          </div>

          {/* ── Step 2: Search Area (user-configurable) ── */}
          <div className="place-step">
            <div className="place-step-header">
              <span className="place-step-number">2</span>
              <span className="place-step-title">Search Area</span>
            </div>
            <div className="place-inputs-row">
              <div className="place-field">
                <label htmlFor="place-search-area" title="How far beyond existing nodes to search for placement gaps">Search Area (m)</label>
                <input
                  id="place-search-area"
                  type="number"
                  min={500}
                  max={20000}
                  step={500}
                  value={searchArea.display}
                  onChange={searchArea.handleChange}
                  onBlur={searchArea.handleBlur}
                  title="How far beyond existing nodes to search for gaps (500-20000m)"
                />
              </div>

              <div className="place-field">
                <label htmlFor="place-grid-resolution" title="Spacing between candidate evaluation points — finer grids find better locations but take longer to compute">Grid Resolution</label>
                <select
                  id="place-grid-resolution"
                  value={gridResolution}
                  onChange={(e) => setGridResolution(parseInt(e.target.value))}
                  title="Distance between candidate grid points — smaller values are more precise but slower to compute"
                >
                  <option value={100}>100m (fine)</option>
                  <option value={200}>200m (default)</option>
                  <option value={500}>500m (coarse)</option>
                  <option value={1000}>1000m (fast)</option>
                </select>
              </div>

              <div className="place-field">
                <label htmlFor="place-max-candidates" title="Maximum number of new node locations to suggest — the algorithm returns the top-scoring candidates">Max Candidates ({maxCandidates})</label>
                <div className="place-slider-group">
                  <input
                    id="place-max-candidates"
                    type="range"
                    min={1}
                    max={10}
                    value={maxCandidates}
                    onChange={(e) => setMaxCandidates(parseInt(e.target.value))}
                    aria-label="Maximum number of suggested nodes"
                    title={`Maximum suggestions to return: ${maxCandidates}. Higher values give more options but may include lower-quality locations`}
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxCandidates}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= 10) setMaxCandidates(v);
                    }}
                    className="place-number-sm"
                    aria-label="Max candidates count"
                    title="Enter number of suggestions (1-10)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 3: Results ── */}
          <div className="place-step">
            <div className="place-step-header">
              <span className="place-step-number">3</span>
              <span className="place-step-title">Results</span>
            </div>

            {/* Submit / action buttons */}
            <div className="place-btn-row">
              <button
                className="place-btn-primary"
                type="button"
                onClick={handleGetSuggestions}
                disabled={!canSubmit}
                title={nodes.length === 0 ? 'Add at least one node to the map first' : 'Analyze coverage and suggest new node locations'}
              >
                {isLoading ? 'Analyzing...' : 'Get Suggestions'}
              </button>
              {suggestions.length > 0 && (
                <>
                  <button
                    className="place-btn-success"
                    type="button"
                    onClick={handleAcceptAll}
                    disabled={acceptingIndex !== null}
                    title="Accept all suggestions and add them as nodes"
                  >
                    Accept All ({suggestions.length})
                  </button>
                  <button
                    className="place-btn-danger"
                    type="button"
                    onClick={handleClear}
                    disabled={isLoading}
                    title="Clear all suggestions"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Loading spinner */}
            {isLoading && (
              <div className="place-spinner">Analyzing coverage gaps...</div>
            )}

            {/* Empty state */}
            {!isLoading && suggestions.length === 0 && nodes.length === 0 && (
              <div className="place-empty">
                Add at least one node to the map before requesting placement suggestions.
              </div>
            )}

            {!isLoading && suggestions.length === 0 && nodes.length > 0 && (
              <div className="place-empty">
                Click <strong>Get Suggestions</strong> to find optimal
                node placement locations based on your existing {nodes.length} node{nodes.length !== 1 ? 's' : ''}.
              </div>
            )}

            {/* Results */}
            {suggestions.length > 0 && (
              <div className="place-results">
                <h3 className="place-results-title">
                  Suggestions ({suggestions.length})
                </h3>
                <div className="place-suggestion-list">
                  {suggestions.map((s, idx) => (
                    <div key={`${s.latitude}-${s.longitude}-${idx}`} className="place-suggestion-item">
                      <div className={`place-score-badge ${scoreColorClass(s.score)}`} title={`Placement quality score: ${(s.score * 100).toFixed(0)}% — green (>70%) is excellent, yellow (40-70%) is moderate, red (<40%) is marginal`}>
                        {s.score.toFixed(2)}
                      </div>
                      <div className="place-suggestion-detail">
                        <span className="place-coords" title="Latitude and longitude of the suggested node location">
                          {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                        </span>
                        <span className="place-coverage" title="Additional area that would gain coverage if a node is placed here">
                          +{s.coverage_gain_km2.toFixed(2)} km&sup2; coverage gain
                        </span>
                        <span className="place-reason" title="Why this location was recommended">{s.reason}</span>
                      </div>
                      <div className="place-actions">
                        <button
                          className="place-btn-success"
                          type="button"
                          onClick={() => handleAccept(idx)}
                          disabled={acceptingIndex !== null}
                          title="Accept this suggestion and add as a new node"
                        >
                          {acceptingIndex === idx ? 'Adding...' : 'Accept'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
