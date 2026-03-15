/**
 * RNSThroughputModal Component
 * Multi-Interface Throughput Analyzer for Reticulum (RNS) networks.
 * Calculates effective end-to-end throughput and LXMF message delivery time
 * across a mixed-interface path (LoRa, WiFi, TCP/IP, I2P).
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './RNSThroughputModal.css';

/* ---- Types ---- */

export interface RNSThroughputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type InterfaceType = 'lora' | 'wifi' | 'tcpip' | 'i2p';
type TransferType = 'lxmf' | 'raw' | 'announce';
type PathState = 'cold' | 'warm';

interface Segment {
  interfaceType: InterfaceType;
  dataRate: number;
  hops: number;
}

/* ---- Protocol constants ---- */

const ANNOUNCE_SIZE = 167;
const LXMF_HEADER_BYTES = 80;
const COLD_PATH_OVERHEAD_BYTES = 297; // 3 packets: link request + link proof + announce
const I2P_TUNNEL_SETUP_MS = 5000;

/* ---- Default data rates by interface type (bps) ---- */

const DEFAULT_RATES: Record<InterfaceType, number> = {
  lora: 1200,
  wifi: 54_000_000,
  tcpip: 10_000_000,
  i2p: 50_000,
};

const RATE_RANGES: Record<InterfaceType, { min: number; max: number }> = {
  lora: { min: 100, max: 27_000 },
  wifi: { min: 1_000_000, max: 300_000_000 },
  tcpip: { min: 100_000, max: 1_000_000_000 },
  i2p: { min: 1_000, max: 500_000 },
};

const INTERFACE_LABELS: Record<InterfaceType, string> = {
  lora: 'LoRa RNode',
  wifi: 'WiFi',
  tcpip: 'TCP/IP',
  i2p: 'I2P',
};

/* ---- Format helpers ---- */

function formatRate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} kbps`;
  return `${bps} bps`;
}

function formatTime(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

/* ---- Default segment factory ---- */

function makeSegment(interfaceType: InterfaceType = 'lora'): Segment {
  return { interfaceType, dataRate: DEFAULT_RATES[interfaceType], hops: 1 };
}

function makeDefaultSegments(count: number): Segment[] {
  const types: InterfaceType[] = ['lora', 'wifi', 'tcpip', 'i2p'];
  return Array.from({ length: count }, (_, i) => makeSegment(types[i % types.length]));
}

/* ---- Component ---- */

export function RNSThroughputModal({ isOpen, onClose }: RNSThroughputModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [segmentCount, setSegmentCount] = useState(2);
  const [transferType, setTransferType] = useState<TransferType>('lxmf');
  const [payloadSize, setPayloadSize] = useState(1500);
  const [pathState, setPathState] = useState<PathState>('cold');
  const [segments, setSegments] = useState<Segment[]>([makeSegment('lora'), makeSegment('wifi')]);
  const [calculated, setCalculated] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSegmentCount(2);
      setTransferType('lxmf');
      setPayloadSize(1500);
      setPathState('cold');
      setSegments([makeSegment('lora'), makeSegment('wifi')]);
      setCalculated(false);
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  // Sync segment array length when count changes
  useEffect(() => {
    setSegments((prev) => {
      if (segmentCount === prev.length) return prev;
      if (segmentCount > prev.length) {
        const extras = makeDefaultSegments(segmentCount - prev.length);
        return [...prev, ...extras];
      }
      return prev.slice(0, segmentCount);
    });
    setCalculated(false);
  }, [segmentCount]);

  // Reset payload default when transfer type changes
  useEffect(() => {
    if (transferType === 'lxmf') setPayloadSize(1500);
    else if (transferType === 'raw') setPayloadSize(1500);
    // announce: no payload input shown
    setCalculated(false);
  }, [transferType]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Auto-focus on open
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const first = modal.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    });
  }, [isOpen, modalRef]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen, modalRef]);

  // Segment field updaters
  function updateSegmentType(index: number, interfaceType: InterfaceType) {
    setSegments((prev) =>
      prev.map((seg, i) =>
        i === index
          ? { ...seg, interfaceType, dataRate: DEFAULT_RATES[interfaceType] }
          : seg,
      ),
    );
    setCalculated(false);
  }

  function updateSegmentRate(index: number, dataRate: number) {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, dataRate } : seg)),
    );
    setCalculated(false);
  }

  function updateSegmentHops(index: number, hops: number) {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, hops } : seg)),
    );
    setCalculated(false);
  }

  // Results (computed on demand)
  const results = useMemo(() => {
    if (!calculated) return null;

    // 1. Bottleneck = interface with lowest data rate
    const bottleneck = segments.reduce((min, seg) =>
      seg.dataRate < min.dataRate ? seg : min,
    );
    const effectiveDataRate = bottleneck.dataRate;

    // 2. Payload bytes adjusted for transfer type
    let payloadBytes: number;
    if (transferType === 'announce') {
      payloadBytes = ANNOUNCE_SIZE;
    } else if (transferType === 'lxmf') {
      payloadBytes = payloadSize + LXMF_HEADER_BYTES;
    } else {
      payloadBytes = payloadSize;
    }

    // 3. Transfer time at bottleneck (ms)
    const transferTimeMs = (payloadBytes * 8 / effectiveDataRate) * 1000;

    // 4. Link establishment overhead (cold path only)
    let establishmentTimeMs = 0;
    if (pathState === 'cold') {
      establishmentTimeMs = (COLD_PATH_OVERHEAD_BYTES * 8 / effectiveDataRate) * 1000;
    }

    // 5. I2P additional latency
    const hasI2P = segments.some((s) => s.interfaceType === 'i2p');
    const i2pLatencyMs = hasI2P ? I2P_TUNNEL_SETUP_MS : 0;

    // 6. Total delivery time
    const totalTimeMs = establishmentTimeMs + transferTimeMs + i2pLatencyMs;

    // 7. LXMF overhead percentage
    const lxmfOverheadPct =
      transferType === 'lxmf'
        ? (LXMF_HEADER_BYTES / (payloadSize + LXMF_HEADER_BYTES)) * 100
        : null;

    // 8. RNS 5 bps minimum
    const meetsMinimum = effectiveDataRate >= 5;

    return {
      bottleneck,
      effectiveDataRate,
      payloadBytes,
      transferTimeMs,
      establishmentTimeMs,
      i2pLatencyMs,
      hasI2P,
      totalTimeMs,
      lxmfOverheadPct,
      meetsMinimum,
    };
  }, [calculated, segments, transferType, payloadSize, pathState]);

  if (!isOpen) return null;

  return (
    <div className="rnt-overlay" role="dialog" aria-modal="true" aria-label="Multi-Interface Throughput Analyzer">
      <div className="rnt-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="rnt-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="rnt-title">
              Multi-Interface Throughput Analyzer
              <span className="rnt-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="rnt-summary">
              End-to-end throughput and LXMF delivery time across mixed LoRa / WiFi / TCP/IP / I2P paths
            </p>
          </div>
          <button className="rnt-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="rnt-body">

          {/* Section 1: Path Configuration */}
          <div className="rnt-section">
            <h3 className="rnt-section-title">Path Configuration</h3>
            <div className="rnt-inputs">

              <div className="rnt-inputs-row">
                <div className="rnt-field">
                  <label htmlFor="rnt-segment-count">Number of Interface Segments</label>
                  <select
                    id="rnt-segment-count"
                    value={segmentCount}
                    onChange={(e) => setSegmentCount(parseInt(e.target.value))}
                    title="How many different interface types does the path traverse?"
                  >
                    <option value={1}>1 segment</option>
                    <option value={2}>2 segments</option>
                    <option value={3}>3 segments</option>
                    <option value={4}>4 segments</option>
                  </select>
                </div>
                <div className="rnt-field">
                  <label htmlFor="rnt-transfer-type">Transfer Type</label>
                  <select
                    id="rnt-transfer-type"
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value as TransferType)}
                    title="Type of data being transferred over the Reticulum path"
                  >
                    <option value="lxmf">LXMF Message</option>
                    <option value="raw">Raw Link Data</option>
                    <option value="announce">Announce Packet (fixed 167 bytes)</option>
                  </select>
                </div>
              </div>

              <div className="rnt-inputs-row">
                {transferType !== 'announce' && (
                  <div className="rnt-field">
                    <label htmlFor="rnt-payload-size">Payload Size (bytes)</label>
                    <NumberInput
                      id="rnt-payload-size"
                      min={1}
                      max={65535}
                      value={payloadSize}
                      onChange={(v) => { setPayloadSize(Math.round(v)); setCalculated(false); }}
                      title={
                        transferType === 'lxmf'
                          ? 'LXMF message body size in bytes. An 80-byte LXMF header will be added automatically.'
                          : 'Raw payload size in bytes. (1–65535)'
                      }
                    />
                  </div>
                )}
                <div className="rnt-field">
                  <label htmlFor="rnt-path-state">Path State</label>
                  <select
                    id="rnt-path-state"
                    value={pathState}
                    onChange={(e) => { setPathState(e.target.value as PathState); setCalculated(false); }}
                    title="Cold path: no established link, Reticulum must complete link setup (297 bytes overhead). Warm path: link already established."
                  >
                    <option value="cold">Cold Path (no established link)</option>
                    <option value="warm">Warm Path (link already established)</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Interface Segments */}
          <div className="rnt-section">
            <h3 className="rnt-section-title">Interface Segments</h3>
            <div className="rnt-segments">
              {segments.map((seg, index) => {
                const range = RATE_RANGES[seg.interfaceType];
                return (
                  <div key={index} className="rnt-segment-group">
                    <div className="rnt-segment-label">Segment {index + 1}</div>
                    <div className="rnt-inputs-row">
                      <div className="rnt-field">
                        <label htmlFor={`rnt-iface-type-${index}`}>Interface Type</label>
                        <select
                          id={`rnt-iface-type-${index}`}
                          value={seg.interfaceType}
                          onChange={(e) => updateSegmentType(index, e.target.value as InterfaceType)}
                          title="Interface type for this path segment. Changing type auto-sets the default data rate."
                        >
                          <option value="lora">LoRa RNode</option>
                          <option value="wifi">WiFi</option>
                          <option value="tcpip">TCP/IP</option>
                          <option value="i2p">I2P</option>
                        </select>
                      </div>
                      <div className="rnt-field">
                        <label htmlFor={`rnt-data-rate-${index}`}>
                          Data Rate (bps)
                        </label>
                        <NumberInput
                          id={`rnt-data-rate-${index}`}
                          min={range.min}
                          max={range.max}
                          value={seg.dataRate}
                          onChange={(v) => updateSegmentRate(index, Math.round(v))}
                          title={`Data rate for this ${INTERFACE_LABELS[seg.interfaceType]} segment in bps. Range: ${formatRate(range.min)}–${formatRate(range.max)}.`}
                        />
                      </div>
                      <div className="rnt-field rnt-field-narrow">
                        <label htmlFor={`rnt-hops-${index}`}>Hops</label>
                        <NumberInput
                          id={`rnt-hops-${index}`}
                          min={1}
                          max={20}
                          value={seg.hops}
                          onChange={(v) => updateSegmentHops(index, Math.round(v))}
                          title="Number of hops on this interface segment (1–20)."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calculate button */}
          <button
            className="rnt-calculate-btn"
            type="button"
            onClick={() => setCalculated(true)}
          >
            Calculate
          </button>

          {/* Results */}
          {results && (
            <div className="rnt-results">
              <h3 className="rnt-section-title">Results</h3>

              {!results.meetsMinimum && (
                <div className="rnt-note rnt-note-error">
                  Reticulum requires a minimum of 5 bps — this path cannot carry RNS traffic.
                </div>
              )}

              <div className="rnt-results-grid">

                <div className="rnt-result-item">
                  <span className="rnt-result-label">Bottleneck Interface</span>
                  <span className="rnt-result-value">
                    {INTERFACE_LABELS[results.bottleneck.interfaceType]} at {formatRate(results.effectiveDataRate)}
                  </span>
                </div>

                <div className="rnt-result-item">
                  <span className="rnt-result-label">Effective Throughput</span>
                  <span className="rnt-result-value">
                    {formatRate(results.effectiveDataRate)}
                  </span>
                </div>

                <div className="rnt-result-item">
                  <span className="rnt-result-label">Meets RNS 5 bps Minimum</span>
                  <span
                    className={`rnt-result-value rnt-badge ${results.meetsMinimum ? 'rnt-badge-pass' : 'rnt-badge-fail'}`}
                  >
                    {results.meetsMinimum ? '\u2713 Yes' : '\u2717 No'}
                  </span>
                </div>

                {pathState === 'cold' && (
                  <div className="rnt-result-item">
                    <span className="rnt-result-label">Link Establishment Overhead (cold)</span>
                    <span className="rnt-result-value">
                      {formatTime(results.establishmentTimeMs)}
                    </span>
                  </div>
                )}

                {results.hasI2P && (
                  <div className="rnt-result-item">
                    <span className="rnt-result-label">I2P Tunnel Setup</span>
                    <span className="rnt-result-value">~{(I2P_TUNNEL_SETUP_MS).toLocaleString()} ms</span>
                  </div>
                )}

                <div className="rnt-result-item">
                  <span className="rnt-result-label">Transfer Time</span>
                  <span className="rnt-result-value">
                    {formatTime(results.transferTimeMs)}
                  </span>
                </div>

                <div className="rnt-result-item rnt-result-item-prominent">
                  <span className="rnt-result-label">Total Delivery Time</span>
                  <span className="rnt-result-value rnt-result-total">
                    {formatTime(results.totalTimeMs)}
                  </span>
                </div>

                {results.lxmfOverheadPct !== null && (
                  <div className="rnt-result-item">
                    <span className="rnt-result-label">LXMF Header Overhead</span>
                    <span className="rnt-result-value">
                      {results.lxmfOverheadPct.toFixed(1)}% ({LXMF_HEADER_BYTES} bytes of {results.payloadBytes} bytes total)
                    </span>
                  </div>
                )}

              </div>

              {/* Bottleneck recommendation */}
              <div className="rnt-note rnt-note-info">
                Adding a faster interface after {INTERFACE_LABELS[results.bottleneck.interfaceType]} will not improve throughput until the {INTERFACE_LABELS[results.bottleneck.interfaceType]} segment is upgraded.
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
