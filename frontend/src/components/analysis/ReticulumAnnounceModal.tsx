/**
 * ReticulumAnnounceModal Component
 * Calculates safe announce intervals and channel utilization for Reticulum
 * networks running over LoRa (RNode) or other slow interfaces.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './ReticulumAnnounceModal.css';

/* ---- Types ---- */

interface ReticulumAnnounceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InterfaceOption {
  label: string;
  bps: number | null; // null = custom
  note?: string;
}

const INTERFACE_OPTIONS: InterfaceOption[] = [
  { label: 'LoRa / RNode (1200 bps)', bps: 1200 },
  { label: 'LoRa Long Range (300 bps)', bps: 300 },
  { label: 'WiFi (1,000,000 bps)', bps: 1_000_000, note: 'wifi' },
  { label: 'Serial / Packet Radio (9600 bps)', bps: 9600 },
  { label: 'Custom', bps: null },
];

interface AnnounceRow {
  label: string;
  intervalSec: number;
  utilization: number;
  assessment: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
}

function utilizationColor(pct: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (pct < 15) return 'green';
  if (pct < 30) return 'yellow';
  if (pct < 50) return 'orange';
  return 'red';
}

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`;
  return `${(sec / 3600).toFixed(2)}h`;
}

/* ---- Component ---- */

export function ReticulumAnnounceModal({ isOpen, onClose }: ReticulumAnnounceModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [interfaceIndex, setInterfaceIndex] = useState(0);
  const [customBps, setCustomBps] = useState(2400);
  const [packetBytes, setPacketBytes] = useState(72);
  const [numNodes, setNumNodes] = useState(20);
  const [targetUtilization, setTargetUtilization] = useState(15);
  const [hops, setHops] = useState(3);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setInterfaceIndex(0);
      setCustomBps(2400);
      setPacketBytes(72);
      setNumNodes(20);
      setTargetUtilization(15);
      setHops(3);
      resetDrag();
    }
  }, [isOpen, resetDrag]);

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

  // Derived values
  const selectedInterface = INTERFACE_OPTIONS[interfaceIndex];
  const isWifi = selectedInterface.note === 'wifi';
  const isCustom = selectedInterface.bps === null;
  const interfaceBps = isCustom ? customBps : (selectedInterface.bps ?? 1200);

  const results = useMemo((): { rows: AnnounceRow[]; airtimeSec: number; airtimeMs: number } => {
    const announceBits = packetBytes * 8;
    const airtimeSec = announceBits / interfaceBps;
    const airtimeMs = airtimeSec * 1000;

    // How many announces/second the channel can handle at target utilization
    const announcesPerSecAtTarget = (targetUtilization / 100) / airtimeSec;

    // Effective announces per interval cycle (each node announces, propagated hops times)
    const effectiveAnnounces = numNodes * hops;

    // Minimum safe interval (seconds)
    const minIntervalSec = effectiveAnnounces / announcesPerSecAtTarget;

    const calcUtilization = (intervalSec: number) =>
      (effectiveAnnounces * airtimeSec) / intervalSec * 100;

    const rows: AnnounceRow[] = [
      {
        label: 'Minimum Safe',
        intervalSec: minIntervalSec,
        utilization: calcUtilization(minIntervalSec),
        assessment: 'Optimal',
        color: utilizationColor(calcUtilization(minIntervalSec)),
      },
      {
        label: 'Recommended (2x)',
        intervalSec: minIntervalSec * 2,
        utilization: calcUtilization(minIntervalSec * 2),
        assessment: 'Comfortable',
        color: utilizationColor(calcUtilization(minIntervalSec * 2)),
      },
      {
        label: 'Conservative (4x)',
        intervalSec: minIntervalSec * 4,
        utilization: calcUtilization(minIntervalSec * 4),
        assessment: 'Very Safe',
        color: utilizationColor(calcUtilization(minIntervalSec * 4)),
      },
    ];

    return { rows, airtimeSec, airtimeMs };
  }, [packetBytes, interfaceBps, targetUtilization, numNodes, hops]);

  if (!isOpen) return null;

  return (
    <div className="ra-overlay" role="dialog" aria-modal="true" aria-label="Reticulum Announce Rate Calculator">
      <div className="ra-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="ra-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="ra-title">Announce Rate Calculator
              <span className="ra-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="ra-summary">
              Safe announce intervals and channel utilization for Reticulum over LoRa/RNode
            </p>
          </div>
          <button className="ra-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="ra-body">
          {/* Inputs */}
          <div className="ra-inputs">
            <div className="ra-inputs-row">
              <div className="ra-field">
                <label htmlFor="ra-interface">Interface Type</label>
                <select
                  id="ra-interface"
                  value={interfaceIndex}
                  onChange={(e) => setInterfaceIndex(parseInt(e.target.value))}
                  title="Select the interface type to determine effective throughput in bits per second"
                >
                  {INTERFACE_OPTIONS.map((opt, i) => (
                    <option key={opt.label} value={i}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {isCustom && (
                <div className="ra-field">
                  <label htmlFor="ra-custom-bps">Custom Throughput (bps)</label>
                  <NumberInput
                    id="ra-custom-bps"
                    min={10}
                    max={10_000_000}
                    value={customBps}
                    onChange={(v) => setCustomBps(Math.round(v))}
                    title="Enter the effective data rate in bits per second for your custom interface"
                  />
                </div>
              )}

              {!isCustom && (
                <div className="ra-field">
                  <label htmlFor="ra-packet-bytes">Announce Packet Size (bytes)</label>
                  <NumberInput
                    id="ra-packet-bytes"
                    min={16}
                    max={256}
                    value={packetBytes}
                    onChange={(v) => setPacketBytes(Math.round(v))}
                    title="Typical Reticulum announce is 72 bytes: destination hash + identity + optional app data. Range: 16–256 bytes"
                  />
                </div>
              )}
            </div>

            {isCustom && (
              <div className="ra-inputs-row">
                <div className="ra-field">
                  <label htmlFor="ra-packet-bytes-custom">Announce Packet Size (bytes)</label>
                  <NumberInput
                    id="ra-packet-bytes-custom"
                    min={16}
                    max={256}
                    value={packetBytes}
                    onChange={(v) => setPacketBytes(Math.round(v))}
                    title="Typical Reticulum announce is 72 bytes: destination hash + identity + optional app data. Range: 16–256 bytes"
                  />
                </div>
                <div className="ra-field" />
              </div>
            )}

            <div className="ra-inputs-row">
              <div className="ra-field">
                <label htmlFor="ra-nodes">Number of Nodes</label>
                <NumberInput
                  id="ra-nodes"
                  min={1}
                  max={500}
                  value={numNodes}
                  onChange={(v) => setNumNodes(Math.round(v))}
                  title="Total number of nodes in the network that will be sending announces (1–500)"
                />
              </div>
              <div className="ra-field">
                <label htmlFor="ra-target-util">Target Max Utilization (%)</label>
                <NumberInput
                  id="ra-target-util"
                  min={1}
                  max={50}
                  value={targetUtilization}
                  onChange={(v) => setTargetUtilization(Math.round(v))}
                  title="Maximum acceptable channel utilization from announce traffic. 15% is a safe default — leaves 85% for data packets (1–50%)"
                />
              </div>
            </div>

            <div className="ra-inputs-row">
              <div className="ra-field">
                <label htmlFor="ra-hops">Propagation Hops</label>
                <NumberInput
                  id="ra-hops"
                  min={1}
                  max={8}
                  value={hops}
                  onChange={(v) => setHops(Math.round(v))}
                  title="Number of hops announcements propagate. Each hop re-transmits the announce, multiplying channel load. Reticulum default is 3 hops (1–8)"
                />
              </div>
              <div className="ra-field ra-field-info">
                <label>Effective Announces / Cycle</label>
                <div className="ra-info-value" title="Total announces the channel must carry per cycle: nodes × propagation hops">
                  {numNodes} nodes × {hops} hops = <strong>{numNodes * hops}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* WiFi note */}
          {isWifi && (
            <div className="ra-note ra-note-info">
              WiFi interface has effectively unlimited announce capacity — interval can be set as low as desired.
              <strong> 60s recommended minimum for battery-powered nodes.</strong>
            </div>
          )}

          {/* Results */}
          {!isWifi && (
            <>
              <div className="ra-results">
                <h3 className="ra-section-title">Results</h3>

                <div className="ra-airtime-line">
                  Each announce: <strong>{results.airtimeMs.toFixed(1)} ms</strong> airtime at{' '}
                  <strong>{interfaceBps.toLocaleString()} bps</strong> ({packetBytes * 8} bits)
                </div>

                <div className="ra-table-wrap" tabIndex={0} aria-label="Announce rate results table">
                  <table className="ra-table">
                    <thead>
                      <tr>
                        <th title="Announce interval scenario">Scenario</th>
                        <th title="Minimum time between announces per node">Announce Interval</th>
                        <th title="Percentage of channel capacity consumed by announce traffic">Channel Utilization</th>
                        <th title="Assessment of the announce rate for operational use">Assessment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows.map((row) => (
                        <tr key={row.label}>
                          <td className="ra-row-label">{row.label}</td>
                          <td className="ra-row-interval">{formatInterval(row.intervalSec)}</td>
                          <td>
                            <span className={`ra-util ra-util-${row.color}`}>
                              {row.utilization.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <span className={`ra-assessment ra-assessment-${row.color}`}>
                              {row.assessment}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ra-color-legend">
                  <span className="ra-legend-item">
                    <span className="ra-legend-dot ra-legend-green" /> &lt;15% — Optimal
                  </span>
                  <span className="ra-legend-item">
                    <span className="ra-legend-dot ra-legend-yellow" /> 15–30% — Caution
                  </span>
                  <span className="ra-legend-item">
                    <span className="ra-legend-dot ra-legend-orange" /> 30–50% — High
                  </span>
                  <span className="ra-legend-item">
                    <span className="ra-legend-dot ra-legend-red" /> &gt;50% — Saturated
                  </span>
                </div>
              </div>

              <div className="ra-note ra-note-warn">
                <strong>High utilization warning:</strong> When announce traffic saturates the channel, data
                packets are crowded out — causing path discovery failures, missed ACKs, and retransmission
                storms. Keep announce utilization below 15% to leave headroom for application traffic.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
