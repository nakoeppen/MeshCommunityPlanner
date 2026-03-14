/**
 * MeshCoreCapacityModal Component
 * MeshCore Repeater Capacity & Network Density Planner.
 * Checks ACL limits, neighbor table saturation, flood traffic load, and recommends flood.max.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './MeshCoreCapacityModal.css';

/* ---- Types ---- */

interface MeshCoreCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeploymentTier = 'residential' | 'urban' | 'backbone';

const TIER_LABELS: Record<DeploymentTier, string> = {
  residential: 'Residential (0.5s)',
  urban: 'Urban (1.0s)',
  backbone: 'Backbone (2.0s)',
};

const TIER_TXDELAY: Record<DeploymentTier, string> = {
  residential: '0.5s',
  urban: '1.0s',
  backbone: '2.0s',
};

// Approximate ToA for a 40-byte packet at SF7/BW62.5/CR5
const APPROX_TOA_MS = 280;

/* ---- Math ---- */

function computeCapacity(
  totalClients: number,
  repeaterCount: number,
  coverageZones: number,
  messagesPerClientPerHour: number,
  floodMax: number,
  overlappingRepeaters: number,
  tier: DeploymentTier,
) {
  const clientsPerRepeater = Math.ceil(totalClients / repeaterCount);
  const aclStatus = clientsPerRepeater > 32 ? 'EXCEEDED' : 'OK';
  const aclHeadroom = Math.max(0, 32 - clientsPerRepeater);

  const nodesInRange = Math.ceil((totalClients + repeaterCount) * 0.6);
  const neighborStatus = nodesInRange > 50 ? 'EXCEEDED' : 'OK';

  const floodCopiesPerMsg = Math.min(repeaterCount, floodMax * overlappingRepeaters);

  const totalMessagesPerHour = totalClients * messagesPerClientPerHour;
  const totalFloodPacketsPerHour = totalMessagesPerHour * floodCopiesPerMsg;
  const floodAirtimePct = (totalFloodPacketsPerHour * APPROX_TOA_MS) / (3600 * 1000) * 100;

  const recommendedFloodMax = Math.max(2, coverageZones + 1);

  return {
    clientsPerRepeater,
    aclStatus,
    aclHeadroom,
    nodesInRange,
    neighborStatus,
    floodCopiesPerMsg,
    floodAirtimePct,
    recommendedFloodMax,
    txdelay: TIER_TXDELAY[tier],
  };
}

/* ---- Component ---- */

export function MeshCoreCapacityModal({ isOpen, onClose }: MeshCoreCapacityModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [totalClients, setTotalClients] = useState(20);
  const [repeaterCount, setRepeaterCount] = useState(2);
  const [coverageZones, setCoverageZones] = useState(1);
  const [messagesPerClientPerHour, setMessagesPerClientPerHour] = useState(5);
  const [floodMax, setFloodMax] = useState(3);
  const [overlappingRepeaters, setOverlappingRepeaters] = useState(1);
  const [tier, setTier] = useState<DeploymentTier>('residential');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTotalClients(20);
      setRepeaterCount(2);
      setCoverageZones(1);
      setMessagesPerClientPerHour(5);
      setFloodMax(3);
      setOverlappingRepeaters(1);
      setTier('residential');
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

  // Auto-focus first element on open
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
  }, [isOpen]);

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

  const results = useMemo(
    () =>
      computeCapacity(
        totalClients,
        repeaterCount,
        coverageZones,
        messagesPerClientPerHour,
        floodMax,
        overlappingRepeaters,
        tier,
      ),
    [totalClients, repeaterCount, coverageZones, messagesPerClientPerHour, floodMax, overlappingRepeaters, tier],
  );

  if (!isOpen) return null;

  const floodMaxMatch = results.recommendedFloodMax === floodMax;
  const floodLoadHigh = results.floodAirtimePct > 10;

  return (
    <div
      className="mcc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Network Density Planner"
    >
      <div className="mcc-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="mcc-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="mcc-title">
              Network Density Planner
              <span className="mcc-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="mcc-subtitle">
              Client ACL limits, neighbor table saturation, flood traffic load, and flood.max recommendations
            </p>
          </div>
          <button className="mcc-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="mcc-body">
          {/* Inputs */}
          <div className="mcc-inputs">
            <div className="mcc-inputs-row mcc-inputs-row-3">
              <div className="mcc-field">
                <label htmlFor="mcc-clients">Total clients</label>
                <NumberInput
                  id="mcc-clients"
                  min={1}
                  max={10000}
                  value={totalClients}
                  onChange={(v) => setTotalClients(Math.round(v))}
                  title="Total number of client nodes in the network (1–10000)"
                />
              </div>
              <div className="mcc-field">
                <label htmlFor="mcc-repeaters">Repeater count</label>
                <NumberInput
                  id="mcc-repeaters"
                  min={1}
                  max={100}
                  value={repeaterCount}
                  onChange={(v) => setRepeaterCount(Math.round(v))}
                  title="Number of planned MeshCore repeaters (1–100)"
                />
              </div>
              <div className="mcc-field">
                <label htmlFor="mcc-zones">Coverage zones</label>
                <NumberInput
                  id="mcc-zones"
                  min={1}
                  max={50}
                  value={coverageZones}
                  onChange={(v) => setCoverageZones(Math.round(v))}
                  title="Number of distinct geographic coverage areas (1–50). Used to compute recommended flood.max"
                />
              </div>
            </div>

            <div className="mcc-inputs-row mcc-inputs-row-3">
              <div className="mcc-field">
                <label htmlFor="mcc-msg-per-client">Messages / client / hr</label>
                <NumberInput
                  id="mcc-msg-per-client"
                  min={1}
                  max={200}
                  value={messagesPerClientPerHour}
                  onChange={(v) => setMessagesPerClientPerHour(Math.round(v))}
                  title="Average messages sent per client per hour (1–200)"
                />
              </div>
              <div className="mcc-field">
                <label htmlFor="mcc-flood-max">flood.max (hops)</label>
                <NumberInput
                  id="mcc-flood-max"
                  min={1}
                  max={64}
                  value={floodMax}
                  onChange={(v) => setFloodMax(Math.round(v))}
                  title="MeshCore flood.max setting — maximum hops a flooded message can travel (1–64)"
                />
              </div>
              <div className="mcc-field">
                <label htmlFor="mcc-overlap">Overlapping repeaters</label>
                <NumberInput
                  id="mcc-overlap"
                  min={1}
                  max={20}
                  value={overlappingRepeaters}
                  onChange={(v) => setOverlappingRepeaters(Math.round(v))}
                  title="Repeaters that can hear the same packet — drives how many retransmissions occur per hop (1–20)"
                />
              </div>
            </div>

            <div className="mcc-inputs-row mcc-inputs-row-1">
              <div className="mcc-field">
                <label htmlFor="mcc-tier">Deployment tier</label>
                <select
                  id="mcc-tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as DeploymentTier)}
                  title="Deployment environment — determines recommended txdelay setting for the repeater"
                >
                  {(Object.keys(TIER_LABELS) as DeploymentTier[]).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results table */}
          <div className="mcc-results" role="region" aria-label="Capacity planning results">
            <h3 className="mcc-section-title">Results</h3>
            <div className="mcc-table-wrap">
              <table className="mcc-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Clients per repeater</td>
                    <td>{results.clientsPerRepeater}</td>
                    <td>
                      <span
                        className={`mcc-badge ${results.aclStatus === 'EXCEEDED' ? 'mcc-badge-warn' : 'mcc-badge-ok'}`}
                      >
                        {results.aclStatus === 'EXCEEDED'
                          ? `EXCEEDS 32-client ACL`
                          : `OK (${results.aclHeadroom} headroom)`}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Est. neighbors in range</td>
                    <td>{results.nodesInRange}</td>
                    <td>
                      <span
                        className={`mcc-badge ${results.neighborStatus === 'EXCEEDED' ? 'mcc-badge-warn' : 'mcc-badge-ok'}`}
                      >
                        {results.neighborStatus === 'EXCEEDED'
                          ? 'EXCEEDS 50-node table'
                          : 'OK'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Flood copies per message</td>
                    <td>{results.floodCopiesPerMsg}</td>
                    <td><span className="mcc-badge mcc-badge-neutral">—</span></td>
                  </tr>
                  <tr>
                    <td>Channel load (flood traffic)</td>
                    <td>{results.floodAirtimePct.toFixed(1)}%</td>
                    <td>
                      <span
                        className={`mcc-badge ${floodLoadHigh ? 'mcc-badge-warn' : 'mcc-badge-ok'}`}
                      >
                        {floodLoadHigh ? 'High' : 'OK'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Recommended flood.max</td>
                    <td>{results.recommendedFloodMax}</td>
                    <td>
                      <span className={`mcc-badge ${floodMaxMatch ? 'mcc-badge-ok' : 'mcc-badge-info'}`}>
                        {floodMaxMatch
                          ? 'Matches current'
                          : `Currently set to ${floodMax}`}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Recommended txdelay</td>
                    <td>{results.txdelay}</td>
                    <td><span className="mcc-badge mcc-badge-neutral">—</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Callout */}
          <div className="mcc-callout">
            Adding more repeaters increases flood copies — channel load grows.
            More repeaters &ne; less congestion unless <code>flood.max</code> is reduced.
          </div>
        </div>
      </div>
    </div>
  );
}
