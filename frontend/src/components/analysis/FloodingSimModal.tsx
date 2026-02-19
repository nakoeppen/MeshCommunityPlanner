/**
 * FloodingSimModal Component
 * Simulates BFS message flooding through the mesh network and visualises
 * hop-by-hop wave propagation on the map via the flooding overlay store.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  simulateFlooding,
  computeNetworkHealthScore,
  simulateNodeRemoval,
  type FloodingResult,
  type FloodingConfig,
  type NetworkHealthResult,
} from '../../utils/flooding';
import { parseCodingRateNum } from '../../utils/lora';
import { useMapStore, type LOSOverlay } from '../../stores/mapStore';
import { useDraggable } from '../../hooks/useDraggable';
import { useNumberInput } from '../../hooks/useNumberInput';
import './FloodingSimModal.css';

interface FloodingSimModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; uuid: string; name: string }>;
  losOverlays: LOSOverlay[];
  radioSF: number;      // from network settings
  radioBW: number;      // kHz
  radioCR: string;      // e.g. "4/5"
}

/**
 * Return a CSS class suffix for the hop-number badge colour.
 */
function hopBadgeClass(hop: number): string {
  if (hop <= 5) return `hop-${hop}`;
  return 'hop-default';
}

export function FloodingSimModal({
  isOpen,
  onClose,
  nodes,
  losOverlays,
  radioSF,
  radioBW,
  radioCR,
}: FloodingSimModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // ---- Inputs ----
  const [sourceNodeId, setSourceNodeId] = useState('');
  const payloadInput = useNumberInput(32, 1, 256);
  const delayInput = useNumberInput(50, 10, 500);
  const [animationSpeed, setAnimationSpeed] = useState(800);

  // ---- Output ----
  const [result, setResult] = useState<FloodingResult | null>(null);
  const [healthResult, setHealthResult] = useState<NetworkHealthResult | null>(null);
  const [failureNodeId, setFailureNodeId] = useState('');
  const [failureResult, setFailureResult] = useState<FloodingResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // ---- Reset state on open ----
  useEffect(() => {
    if (isOpen) {
      setSourceNodeId(nodes.length > 0 ? nodes[0].uuid : '');
      payloadInput.reset(32);
      delayInput.reset(50);
      setAnimationSpeed(800);
      setResult(null);
      setHealthResult(null);
      setFailureNodeId('');
      setFailureResult(null);
      setIsSimulating(false);
      resetDrag();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nodes, resetDrag]);

  // ---- Escape key handler ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // ---- Auto-focus first element on open (keyboard accessibility) ----
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const first = modal.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    });
  }, [isOpen]);

  // ---- Focus trap ----
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // If focus is outside modal, pull it in
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // ---- Close handler (clears overlay) ----
  const handleClose = useCallback(() => {
    useMapStore.getState().clearFloodingOverlay();
    onClose();
  }, [onClose]);

  // ---- Simulate ----
  const handleSimulate = useCallback(() => {
    if (!sourceNodeId || nodes.length === 0) return;
    setIsSimulating(true);
    setFailureNodeId('');
    setFailureResult(null);

    // Defer to next tick so spinner renders
    setTimeout(() => {
      const config: FloodingConfig = {
        sourceNodeId,
        messagePayloadBytes: payloadInput.value,
        processingDelayMs: delayInput.value,
      };

      const crNum = parseCodingRateNum(radioCR);
      const allNodeIds = nodes.map((n) => n.uuid);

      const simResult = simulateFlooding(losOverlays, allNodeIds, config, radioSF, radioBW, crNum);
      setResult(simResult);

      // Compute network health score
      const health = computeNetworkHealthScore(losOverlays, allNodeIds);
      setHealthResult(health);

      // Push overlay to map store for visualisation
      useMapStore.getState().setFloodingOverlay({
        sourceNodeId,
        waves: simResult.waves,
        currentWaveIndex: simResult.waves.length - 1,
        isPlaying: false,
        totalTimeMs: simResult.totalTimeMs,
        reachedCount: simResult.reachedNodeIds.length,
        unreachedCount: simResult.unreachedNodeIds.length,
        animationSpeedMs: animationSpeed,
        criticalNodeIds: health.criticalNodes.articulationPoints,
        bridgeLinks: health.criticalNodes.bridges,
      });

      setIsSimulating(false);
    }, 0);
  }, [sourceNodeId, payloadInput.value, delayInput.value, radioCR, radioSF, radioBW, nodes, losOverlays, animationSpeed]);

  // ---- Transport controls ----
  const handlePlay = useCallback(() => {
    const overlay = useMapStore.getState().flooding_overlay;
    if (overlay && overlay.currentWaveIndex >= overlay.waves.length - 1) {
      // At the end — reset to start before playing
      useMapStore.getState().updateFloodingWaveIndex(0);
    }
    useMapStore.getState().setFloodingPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    useMapStore.getState().setFloodingPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    useMapStore.getState().setFloodingPlaying(false);
    useMapStore.getState().updateFloodingWaveIndex(0);
  }, []);

  // ---- Node failure test ----
  const handleFailureTest = useCallback((removedId: string) => {
    setFailureNodeId(removedId);
    if (!removedId || !result) {
      setFailureResult(null);
      return;
    }
    const config: FloodingConfig = {
      sourceNodeId,
      messagePayloadBytes: payloadInput.value,
      processingDelayMs: delayInput.value,
    };
    const crNum = parseCodingRateNum(radioCR);
    const allNodeIds = nodes.map((n) => n.uuid);
    const fResult = simulateNodeRemoval(losOverlays, allNodeIds, removedId, config, radioSF, radioBW, crNum);
    setFailureResult(fResult);
  }, [result, sourceNodeId, payloadInput.value, delayInput.value, radioCR, radioSF, radioBW, nodes, losOverlays]);

  // ---- Animation speed update ----
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseInt(e.target.value);
    setAnimationSpeed(speed);
    const overlay = useMapStore.getState().flooding_overlay;
    if (overlay) {
      useMapStore.getState().setFloodingOverlay({ ...overlay, animationSpeedMs: speed });
    }
  }, []);

  // ---- Resolve node name by uuid ----
  const nodeNameMap = useRef(new Map<string, string>());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.uuid, n.name);
    }
    nodeNameMap.current = map;
  }, [nodes]);

  const resolveNodeName = useCallback(
    (uuid: string): string => nodeNameMap.current.get(uuid) || uuid.slice(0, 8),
    [],
  );

  // ---- Guard ----
  if (!isOpen) return null;

  const floodingOverlay = useMapStore.getState().flooding_overlay;
  const isPlayingNow = floodingOverlay?.isPlaying ?? false;

  return (
    <div
      className="flood-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Flooding Simulation"
    >
      <div className="flood-modal" ref={modalRef} style={dragStyle}>
        {/* ---- Header ---- */}
        <div className="flood-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="flood-title">Flooding Simulation</h2>
            <p className="flood-summary">
              Simulate BFS message propagation through the mesh and visualise hop-by-hop timing
            </p>
            <span className="flood-drag-hint">Drag to move</span>
          </div>
          <button className="flood-close" type="button" onClick={handleClose} title="Close">
            &times;
          </button>
        </div>

        {/* ---- Body ---- */}
        <div className="flood-body">
          {/* Inputs */}
          <div className="flood-inputs-row">
            <div className="flood-field">
              <label htmlFor="flood-source-node">Source Node</label>
              <select
                id="flood-source-node"
                value={sourceNodeId}
                onChange={(e) => setSourceNodeId(e.target.value)}
                title="Select the node that originates the flooded message"
              >
                {nodes.map((n) => (
                  <option key={n.uuid} value={n.uuid}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flood-field">
              <label htmlFor="flood-payload">Payload Size (bytes)</label>
              <div className="flood-slider-group">
                <input
                  id="flood-payload"
                  type="range"
                  min={1}
                  max={256}
                  value={payloadInput.value}
                  onChange={(e) => payloadInput.reset(parseInt(e.target.value))}
                  aria-label="Payload size slider"
                  title={`Payload size: ${payloadInput.value} bytes`}
                />
                <input
                  type="number"
                  min={1}
                  max={256}
                  value={payloadInput.display}
                  onChange={payloadInput.handleChange}
                  onBlur={payloadInput.handleBlur}
                  className="flood-number-sm"
                  aria-label="Payload size bytes"
                  title="Enter payload size in bytes (1-256)"
                />
              </div>
            </div>
          </div>

          <div className="flood-inputs-row">
            <div className="flood-field">
              <label htmlFor="flood-delay">Processing Delay (ms)</label>
              <div className="flood-slider-group">
                <input
                  id="flood-delay"
                  type="range"
                  min={10}
                  max={500}
                  value={delayInput.value}
                  onChange={(e) => delayInput.reset(parseInt(e.target.value))}
                  aria-label="Processing delay slider"
                  title={`Processing delay: ${delayInput.value} ms`}
                />
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={delayInput.display}
                  onChange={delayInput.handleChange}
                  onBlur={delayInput.handleBlur}
                  className="flood-number-sm"
                  aria-label="Processing delay ms"
                  title="Enter per-hop processing delay in ms (10-500)"
                />
              </div>
            </div>
            <div className="flood-field" style={{ justifyContent: 'flex-end' }}>
              <button
                className="flood-btn-primary"
                onClick={handleSimulate}
                disabled={isSimulating || nodes.length === 0}
                title="Run BFS flooding simulation from the selected source node"
              >
                {isSimulating ? (
                  <>
                    <span className="flood-spinner" /> Simulating...
                  </>
                ) : (
                  'Simulate'
                )}
              </button>
            </div>
          </div>

          {/* ---- Transport Controls ---- */}
          {result && (
            <div className="flood-transport">
              <button
                className="flood-btn-sm"
                onClick={isPlayingNow ? handlePause : handlePlay}
                title={isPlayingNow ? 'Pause animation' : 'Play animation'}
              >
                {isPlayingNow ? 'Pause' : 'Play'}
              </button>
              <button className="flood-btn-sm" onClick={handleReset} title="Reset to first wave">
                Reset
              </button>
              <label className="flood-speed-label" title="Animation speed between wave steps">
                Speed
                <input
                  type="range"
                  min={200}
                  max={2000}
                  step={100}
                  value={animationSpeed}
                  onChange={handleSpeedChange}
                  className="flood-speed-slider"
                  aria-label="Animation speed"
                  title={`${animationSpeed}ms per wave`}
                />
                <span className="flood-speed-value">{animationSpeed}ms</span>
              </label>
            </div>
          )}

          {/* ---- Results Summary ---- */}
          {result && (
            <div className="flood-results">
              <h3 className="flood-section-title">Results</h3>
              <div className="flood-results-grid">
                <div className="flood-result-card" title="Number of hops the flood required to reach all reachable nodes">
                  <span className="flood-result-value">{result.totalHops}</span>
                  <span className="flood-result-label">Total Hops</span>
                </div>
                <div className="flood-result-card" title="Total time for the flood to fully propagate">
                  <span className="flood-result-value">{result.totalTimeMs.toFixed(1)}</span>
                  <span className="flood-result-label">Total Time (ms)</span>
                </div>
                <div className="flood-result-card" title="Number of nodes that received the flooded message">
                  <span className="flood-result-value">
                    {result.reachedNodeIds.length} / {nodes.length}
                  </span>
                  <span className="flood-result-label">Reached Nodes</span>
                </div>
                {result.unreachedNodeIds.length > 0 && (
                  <div
                    className="flood-result-card flood-card-danger"
                    title="Nodes that could not be reached — no viable link path from source"
                  >
                    <span className="flood-result-value flood-value-danger">
                      {result.unreachedNodeIds.length}
                    </span>
                    <span className="flood-result-label">Unreached Nodes</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- Network Health Score ---- */}
          {healthResult && (
            <div className="flood-results">
              <h3 className="flood-section-title">Network Health</h3>
              <div className="flood-health-row">
                <div className={`flood-health-badge flood-grade-${healthResult.grade.toLowerCase()}`}>
                  <span className="flood-health-score">{healthResult.score}</span>
                  <span className="flood-health-grade">{healthResult.grade}</span>
                </div>
                <div className="flood-health-cards">
                  <div className="flood-health-card" title="Percentage of nodes reachable from any starting point">
                    <span className="flood-health-card-value">{healthResult.connectivity}/25</span>
                    <span className="flood-health-card-label">Connectivity</span>
                  </div>
                  <div className="flood-health-card" title="Average redundancy of connections per node">
                    <span className="flood-health-card-value">{healthResult.redundancy}/25</span>
                    <span className="flood-health-card-label">Redundancy</span>
                  </div>
                  <div className="flood-health-card" title="Score based on absence of single-point-of-failure nodes">
                    <span className="flood-health-card-value">{healthResult.spofNodes}/25</span>
                    <span className="flood-health-card-label">SPOF Nodes</span>
                  </div>
                  <div className="flood-health-card" title="Score based on absence of single-point-of-failure links (bridges)">
                    <span className="flood-health-card-value">{healthResult.spofLinks}/25</span>
                    <span className="flood-health-card-label">SPOF Links</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- Critical Nodes ---- */}
          {healthResult && healthResult.criticalNodes.articulationPoints.length > 0 && (
            <div className="flood-results">
              <h3 className="flood-section-title flood-critical-title">Critical Nodes (Single Points of Failure)</h3>
              <div className="flood-critical-list">
                {healthResult.criticalNodes.articulationPoints.map((id) => (
                  <div key={id} className="flood-critical-item">
                    <span className="flood-critical-icon">!</span>
                    <span>{resolveNodeName(id)}</span>
                  </div>
                ))}
              </div>
              {healthResult.criticalNodes.bridges.length > 0 && (
                <div className="flood-bridge-list">
                  <span className="flood-bridge-label">Bridge links:</span>
                  {healthResult.criticalNodes.bridges.map((b, i) => (
                    <span key={i} className="flood-bridge-item">
                      {resolveNodeName(b.from)} — {resolveNodeName(b.to)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- Node Failure Test ---- */}
          {result && (
            <div className="flood-results">
              <h3 className="flood-section-title">Node Failure Test</h3>
              <div className="flood-failure-row">
                <select
                  value={failureNodeId}
                  onChange={(e) => handleFailureTest(e.target.value)}
                  className="flood-failure-select"
                  title="Select a node to remove and see how the network degrades"
                >
                  <option value="">(None)</option>
                  {nodes.map((n) => (
                    <option key={n.uuid} value={n.uuid}>{n.name}</option>
                  ))}
                </select>
                {failureResult && result && (
                  <div className="flood-failure-delta">
                    Reached: {result.reachedNodeIds.length}/{nodes.length}
                    {' → '}
                    {failureResult.reachedNodeIds.length}/{nodes.length - 1}
                    {failureResult.unreachedNodeIds.length > 0 && (
                      <span className="flood-value-danger">
                        {' '}(+{failureResult.unreachedNodeIds.length} unreachable)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- Wave Detail List ---- */}
          {result && result.waves.length > 0 && (
            <div className="flood-results">
              <h3 className="flood-section-title">Wave Detail</h3>
              <div className="flood-wave-list">
                {result.waves.map((wave) => (
                  <div key={wave.hopNumber} className="flood-wave-item">
                    <span className={`flood-wave-badge ${hopBadgeClass(wave.hopNumber)}`}>
                      {wave.hopNumber === 0 ? 'SRC' : `H${wave.hopNumber}`}
                    </span>
                    <span className="flood-wave-nodes">
                      {wave.nodeIds.map((id) => resolveNodeName(id)).join(', ')}
                    </span>
                    <span className="flood-wave-meta">
                      {wave.cumulativeTimeMs.toFixed(1)} ms
                      {wave.links.length > 0 && ` | ${wave.links.length} link${wave.links.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
