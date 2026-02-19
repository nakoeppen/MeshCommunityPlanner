/**
 * ChannelCapacityModal Component
 * Estimates channel utilization, collision probability, and optimal modem preset
 * using the Pure ALOHA model and shared computeTimeOnAir math.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { computeTimeOnAir, parseCodingRateNum, FALLBACK_PRESETS, type ModemPresetEntry } from '../../utils/lora';
import { useDraggable } from '../../hooks/useDraggable';
import './ChannelCapacityModal.css';

interface ChannelCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogModemPresets: any[];
  currentPresetSF: number;
  currentPresetBW: number;
  currentPresetCR: string;
  currentNodeCount: number;
}

const DUTY_CYCLE_OPTIONS = [
  { label: '100% (US ISM)', value: 1.0 },
  { label: '10% (EU 868 MHz)', value: 0.1 },
  { label: '1% (EU sub-band)', value: 0.01 },
];

function utilizationClass(pct: number): string {
  if (pct < 30) return 'green';
  if (pct < 70) return 'yellow';
  return 'red';
}

export function ChannelCapacityModal({
  isOpen,
  onClose,
  catalogModemPresets,
  currentPresetSF,
  currentPresetBW,
  currentPresetCR,
  currentNodeCount,
}: ChannelCapacityModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [nodeCount, setNodeCount] = useState(Math.max(currentNodeCount, 2));
  const [msgsPerMin, setMsgsPerMin] = useState(1.0);
  const [payloadBytes, setPayloadBytes] = useState(32);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [sf, setSF] = useState(currentPresetSF);
  const [bwKhz, setBwKhz] = useState(currentPresetBW);
  const [crStr, setCrStr] = useState(currentPresetCR);
  const [dutyCycle, setDutyCycle] = useState(1.0);
  const [customDutyCycle, setCustomDutyCycle] = useState('');

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setNodeCount(Math.max(currentNodeCount, 2));
      setMsgsPerMin(1.0);
      setPayloadBytes(32);
      setSF(currentPresetSF);
      setBwKhz(currentPresetBW);
      setCrStr(currentPresetCR);
      setDutyCycle(1.0);
      setCustomDutyCycle('');
      const key = findPresetKey(currentPresetSF, currentPresetBW, currentPresetCR);
      setSelectedPresetKey(key);
      resetDrag();
    }
  }, [isOpen, currentPresetSF, currentPresetBW, currentPresetCR, currentNodeCount, resetDrag]);

  // Build unified preset list
  const presetList = useMemo((): { key: string; name: string; sf: number; bw: number; cr: string }[] => {
    if (catalogModemPresets.length > 0) {
      return catalogModemPresets.map((p: any) => ({
        key: p.id || p.name,
        name: p.name || p.id,
        sf: p.spreading_factor,
        bw: p.bandwidth_khz,
        cr: p.coding_rate,
      }));
    }
    return Object.entries(FALLBACK_PRESETS).map(([key, p]) => ({
      key,
      name: p.label || key,
      sf: p.spreading_factor,
      bw: p.bandwidth_khz,
      cr: p.coding_rate,
    }));
  }, [catalogModemPresets]);

  function findPresetKey(targetSF: number, targetBW: number, targetCR: string): string {
    for (const p of presetList) {
      if (p.sf === targetSF && p.bw === targetBW && p.cr === targetCR) return p.key;
    }
    return 'Custom';
  }

  const handlePresetChange = useCallback((key: string) => {
    setSelectedPresetKey(key);
    const preset = presetList.find((p) => p.key === key);
    if (preset) {
      setSF(preset.sf);
      setBwKhz(preset.bw);
      setCrStr(preset.cr);
    }
  }, [presetList]);

  // Compute capacity results
  const effectiveDutyCycle = customDutyCycle !== '' ? parseFloat(customDutyCycle) / 100 : dutyCycle;
  const crNum = parseCodingRateNum(crStr);

  const results = useMemo(() => {
    const toa = computeTimeOnAir(sf, bwKhz, crNum, payloadBytes, 16, false, true);
    const toaSec = toa.toaMs / 1000;
    const totalPktsPerMin = nodeCount * msgsPerMin;
    const channelTimePerMin = totalPktsPerMin * toaSec;
    const dc = Math.max(effectiveDutyCycle, 0.001);
    const utilization = channelTimePerMin / (60 * dc);
    const utilizationPct = utilization * 100;
    const G = utilization; // offered traffic
    const collisionProb = 1 - Math.exp(-2 * G);
    const collisionPct = collisionProb * 100;
    const successRate = totalPktsPerMin * (1 - collisionProb);
    const maxCapacity = toaSec > 0 ? (60 * dc) / toaSec : 0;
    const headroom = maxCapacity - totalPktsPerMin;
    const maxNodes = msgsPerMin > 0 ? Math.floor(maxCapacity / msgsPerMin) : 0;

    return {
      toaMs: toa.toaMs,
      totalPktsPerMin,
      utilizationPct,
      collisionPct,
      successRate,
      maxCapacity,
      headroom,
      maxNodes,
    };
  }, [sf, bwKhz, crNum, payloadBytes, nodeCount, msgsPerMin, effectiveDutyCycle]);

  // Comparison table
  const comparisonRows = useMemo(() => {
    return presetList.map((p) => {
      const pCrNum = parseCodingRateNum(p.cr);
      const toa = computeTimeOnAir(p.sf, p.bw, pCrNum, payloadBytes, 16, false, true);
      const toaSec = toa.toaMs / 1000;
      const dc = Math.max(effectiveDutyCycle, 0.001);
      const totalPkts = nodeCount * msgsPerMin;
      const util = (totalPkts * toaSec) / (60 * dc) * 100;
      const G = util / 100;
      const collision = (1 - Math.exp(-2 * G)) * 100;
      const maxCap = toaSec > 0 ? (60 * dc) / toaSec : 0;
      const maxN = msgsPerMin > 0 ? Math.floor(maxCap / msgsPerMin) : 0;

      return {
        key: p.key,
        name: p.name,
        sf: p.sf,
        bw: p.bw,
        cr: p.cr,
        toaMs: toa.toaMs,
        utilPct: util,
        collisionPct: collision,
        maxNodes: maxN,
        isActive: p.sf === sf && p.bw === bwKhz && p.cr === crStr,
      };
    });
  }, [presetList, payloadBytes, nodeCount, msgsPerMin, effectiveDutyCycle, sf, bwKhz, crStr]);

  // Build recommendation text
  const recommendation = useMemo(() => {
    if (results.utilizationPct <= 50) return null;
    // Find first preset with utilization <50%
    const better = comparisonRows.find((r) => !r.isActive && r.utilPct < 50);
    if (better) {
      return `Consider switching to ${better.name} (${better.utilPct.toFixed(1)}% utilization) for better throughput at this network size.`;
    }
    return 'All presets exceed 50% utilization at this configuration. Consider reducing message rate or splitting into multiple channels.';
  }, [results.utilizationPct, comparisonRows]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Auto-focus first element on open (keyboard accessibility)
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const first = modal.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });
  }, [isOpen]);

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
      // If focus is outside modal, pull it in
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const utilColor = utilizationClass(results.utilizationPct);

  return (
    <div className="ccap-overlay" role="dialog" aria-modal="true" aria-label="Channel Capacity Estimator">
      <div className="ccap-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="ccap-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="ccap-title">Channel Capacity Estimator</h2>
            <p className="ccap-summary">
              Predict congestion and find optimal presets using the Pure ALOHA channel model
            </p>
            <span className="ccap-drag-hint">Drag to move</span>
          </div>
          <button className="ccap-close" type="button" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Body */}
        <div className="ccap-body">
          {/* Inputs */}
          <div className="ccap-inputs">
            <div className="ccap-inputs-row">
              <div className="ccap-field">
                <label htmlFor="ccap-node-count">Node Count</label>
                <div className="ccap-slider-group">
                  <input
                    id="ccap-node-count"
                    type="range"
                    min={2}
                    max={200}
                    value={nodeCount}
                    onChange={(e) => setNodeCount(parseInt(e.target.value))}
                    aria-label="Node count slider"
                    title={`Number of nodes in the network: ${nodeCount}`}
                  />
                  <input
                    type="number"
                    min={2}
                    max={200}
                    value={nodeCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 2 && v <= 200) setNodeCount(v);
                    }}
                    className="ccap-number-sm"
                    aria-label="Node count"
                    title="Enter exact node count (2–200)"
                  />
                </div>
              </div>
              <div className="ccap-field">
                <label htmlFor="ccap-msgs-min">Messages per Node per Minute</label>
                <div className="ccap-slider-group">
                  <input
                    id="ccap-msgs-min"
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={msgsPerMin}
                    onChange={(e) => setMsgsPerMin(parseFloat(e.target.value))}
                    aria-label="Messages per minute slider"
                    title={`Average messages per node per minute: ${msgsPerMin.toFixed(1)}`}
                  />
                  <input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={msgsPerMin}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v >= 0.1 && v <= 10) setMsgsPerMin(v);
                    }}
                    className="ccap-number-sm"
                    aria-label="Messages per minute"
                    title="Enter message rate (0.1–10 per minute)"
                  />
                </div>
              </div>
            </div>

            <div className="ccap-inputs-row ccap-inputs-row-3">
              <div className="ccap-field">
                <label htmlFor="ccap-payload">Avg Payload (bytes)</label>
                <div className="ccap-slider-group">
                  <input
                    id="ccap-payload"
                    type="range"
                    min={1}
                    max={256}
                    value={payloadBytes}
                    onChange={(e) => setPayloadBytes(parseInt(e.target.value))}
                    aria-label="Payload size slider"
                    title={`Average payload size: ${payloadBytes} bytes`}
                  />
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={payloadBytes}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= 256) setPayloadBytes(v);
                    }}
                    className="ccap-number-sm"
                    aria-label="Payload size bytes"
                    title="Enter payload size in bytes (1–256)"
                  />
                </div>
              </div>
              <div className="ccap-field">
                <label htmlFor="ccap-preset">Modem Preset</label>
                <select
                  id="ccap-preset"
                  value={selectedPresetKey}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  title="Select a modem preset — sets Spreading Factor, Bandwidth, and Coding Rate"
                >
                  {presetList.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} (SF{p.sf}/BW{p.bw})
                    </option>
                  ))}
                  {selectedPresetKey === 'Custom' && <option value="Custom">Custom</option>}
                </select>
              </div>
              <div className="ccap-field">
                <label htmlFor="ccap-duty-cycle">Duty Cycle Limit</label>
                <select
                  id="ccap-duty-cycle"
                  value={customDutyCycle !== '' ? 'custom' : String(dutyCycle)}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCustomDutyCycle('50');
                    } else {
                      setCustomDutyCycle('');
                      setDutyCycle(parseFloat(e.target.value));
                    }
                  }}
                  title="Regulatory duty cycle limit — US allows 100%, EU 868 MHz limits to 10% or 1% depending on sub-band"
                >
                  {DUTY_CYCLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
                {customDutyCycle !== '' && (
                  <input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.1}
                    value={customDutyCycle}
                    onChange={(e) => setCustomDutyCycle(e.target.value)}
                    aria-label="Custom duty cycle percentage"
                    title="Enter custom duty cycle percentage"
                    style={{ marginTop: '0.3rem' }}
                    placeholder="Duty cycle %"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="ccap-results">
            <h3 className="ccap-section-title">Results</h3>
            <div className="ccap-results-grid">
              <div className={`ccap-result-card ccap-card-${utilColor}`} title="Percentage of available channel time consumed by all transmissions. Below 30% is healthy; above 70% causes excessive collisions">
                <span className={`ccap-result-value ccap-util-${utilColor}`}>
                  {results.utilizationPct.toFixed(1)}%
                </span>
                <span className="ccap-result-label">Channel Utilization</span>
              </div>
              <div className="ccap-result-card" title="Total number of packets transmitted across the entire network per minute">
                <span className="ccap-result-value">{results.totalPktsPerMin.toFixed(1)}</span>
                <span className="ccap-result-label">Total pkts/min</span>
              </div>
              <div className="ccap-result-card" title="Maximum packets per minute that the channel can carry at the current duty cycle and modem settings">
                <span className="ccap-result-value">{results.maxCapacity.toFixed(1)}</span>
                <span className="ccap-result-label">Max pkts/min (channel)</span>
              </div>
              <div className={`ccap-result-card ccap-card-${utilizationClass(results.collisionPct)}`} title="Probability that any given packet will collide with another transmission (Pure ALOHA model: P = 1 - e^(-2G))">
                <span className={`ccap-result-value ccap-util-${utilizationClass(results.collisionPct)}`}>
                  {results.collisionPct.toFixed(1)}%
                </span>
                <span className="ccap-result-label">Collision Probability</span>
              </div>
              <div className="ccap-result-card" title="Estimated number of messages that will be delivered successfully per minute after accounting for collisions">
                <span className="ccap-result-value">{results.successRate.toFixed(1)}</span>
                <span className="ccap-result-label">Successful msgs/min</span>
              </div>
              <div className="ccap-result-card ccap-result-primary" title={results.headroom >= 0 ? `Room for approximately ${results.maxNodes - nodeCount} more nodes at the current message rate` : `Network is over capacity by ${Math.abs(results.headroom).toFixed(0)} packets/min`}>
                <span className="ccap-result-value">
                  {results.headroom >= 0
                    ? `+${Math.max(results.maxNodes - nodeCount, 0)}`
                    : `Over by ${Math.abs(results.headroom).toFixed(0)}`
                  }
                </span>
                <span className="ccap-result-label">
                  {results.headroom >= 0 ? 'Headroom (more nodes)' : 'Over Capacity (pkts/min)'}
                </span>
              </div>
            </div>

            {recommendation && (
              <div className="ccap-recommendation" role="alert">
                <strong>Recommendation:</strong> {recommendation}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="ccap-comparison">
            <h3 className="ccap-section-title">
              Preset Comparison ({nodeCount} nodes, {msgsPerMin.toFixed(1)} msg/min, {payloadBytes}B payload)
            </h3>
            <div className="ccap-table-wrap">
              <table className="ccap-table">
                <thead>
                  <tr>
                    <th title="Modem preset name">Preset</th>
                    <th title="Time on Air in milliseconds">ToA (ms)</th>
                    <th title="Channel utilization percentage">Utilization</th>
                    <th title="Collision probability">Collision %</th>
                    <th title="Maximum nodes at this message rate before channel saturation">Max Nodes</th>
                    <th title="Assessment of the preset at current network size">Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const uColor = utilizationClass(row.utilPct);
                    let assessment = 'Excellent';
                    if (row.utilPct > 70) assessment = 'Overloaded';
                    else if (row.utilPct > 50) assessment = 'Caution';
                    else if (row.utilPct > 30) assessment = 'Acceptable';

                    return (
                      <tr
                        key={row.key}
                        className={row.isActive ? 'ccap-row-active' : ''}
                        onClick={() => handlePresetChange(row.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePresetChange(row.key); } }}
                        tabIndex={0}
                        role="button"
                        style={{ cursor: 'pointer' }}
                        title={`Click to select ${row.name}`}
                        aria-pressed={row.isActive}
                      >
                        <td>{row.name}</td>
                        <td>{row.toaMs.toFixed(1)}</td>
                        <td className={`value-${uColor}`}>{row.utilPct.toFixed(1)}%</td>
                        <td className={`value-${utilizationClass(row.collisionPct)}`}>{row.collisionPct.toFixed(1)}%</td>
                        <td>{row.maxNodes.toLocaleString()}</td>
                        <td className={`value-${uColor}`}>{assessment}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
