/**
 * MeshCoreFreqCoordModal Component
 * MeshCore RF Channel Frequency Coordinator.
 * Assigns non-interfering center frequencies to co-located MeshCore networks
 * in metro deployments using greedy graph coloring.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import './MeshCoreFreqCoordModal.css';

/* ---- Types ---- */

interface MeshCoreFreqCoordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FreqRegion = 'US' | 'EU' | 'ANZ';
type BandwidthKhz = 62.5 | 125 | 250;

interface RegionBand {
  min: number;  // MHz
  max: number;  // MHz
  width: number; // kHz
}

interface ZoneAssignment {
  zoneName: string;
  channelIndex: number | null; // null = conflict
  freqMhz: number | null;
}

interface FreqCoordResults {
  channelSpacingKhz: number;
  availableChannels: number;
  feasible: boolean;
  assignments: ZoneAssignment[];
}

/* ---- Constants ---- */

const REGION_BANDS: Record<FreqRegion, RegionBand> = {
  US:  { min: 902,  max: 928,  width: 26000 },
  EU:  { min: 863,  max: 870,  width: 7000  },
  ANZ: { min: 915,  max: 928,  width: 13000 },
};

/* ---- Math ---- */

function computeFreqCoord(
  region: FreqRegion,
  bwKhz: BandwidthKhz,
  zoneNames: string[],
  overlaps: boolean[][],
): FreqCoordResults {
  const band = REGION_BANDS[region];
  const channelSpacingKhz = bwKhz * 2;
  const availableChannels = Math.floor(band.width / channelSpacingKhz);
  const startFreqKhz = band.min * 1000 + channelSpacingKhz / 2;

  const n = zoneNames.length;
  const assigned: (number | null)[] = new Array(n).fill(null);

  // Greedy graph coloring: assign lowest available channel index
  // not used by any overlapping zone
  for (let i = 0; i < n; i++) {
    const usedByNeighbors = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (overlaps[i][j] && assigned[j] !== null) {
        usedByNeighbors.add(assigned[j] as number);
      }
    }
    // Find lowest channel not used by any neighbor
    let found: number | null = null;
    for (let ch = 0; ch < availableChannels; ch++) {
      if (!usedByNeighbors.has(ch)) {
        found = ch;
        break;
      }
    }
    assigned[i] = found; // null if no channel available
  }

  const assignments: ZoneAssignment[] = zoneNames.map((name, i) => {
    const ch = assigned[i];
    const freqMhz = ch !== null
      ? (startFreqKhz + ch * channelSpacingKhz) / 1000
      : null;
    return { zoneName: name, channelIndex: ch, freqMhz };
  });

  const feasible = assignments.every((a) => a.channelIndex !== null);

  return { channelSpacingKhz, availableChannels, feasible, assignments };
}

/* ---- Helpers ---- */

function defaultZoneNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Zone ${i + 1}`);
}

function buildOverlapMatrix(n: number): boolean[][] {
  return Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
}

/* ---- Component ---- */

export function MeshCoreFreqCoordModal({ isOpen, onClose }: MeshCoreFreqCoordModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [region, setRegion] = useState<FreqRegion>('US');
  const [bwKhz, setBwKhz] = useState<BandwidthKhz>(62.5);
  const [zoneCount, setZoneCount] = useState(3);
  const [zoneNames, setZoneNames] = useState<string[]>(defaultZoneNames(3));
  const [overlaps, setOverlaps] = useState<boolean[][]>(buildOverlapMatrix(3));

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setRegion('US');
      setBwKhz(62.5);
      setZoneCount(3);
      setZoneNames(defaultZoneNames(3));
      setOverlaps(buildOverlapMatrix(3));
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  // Sync zone names and overlap matrix when zone count changes
  const handleZoneCountChange = useCallback((raw: string) => {
    const n = Math.max(2, Math.min(8, parseInt(raw, 10) || 2));
    setZoneCount(n);
    setZoneNames((prev) => {
      const next = defaultZoneNames(n);
      for (let i = 0; i < Math.min(prev.length, n); i++) {
        next[i] = prev[i];
      }
      return next;
    });
    setOverlaps((prev) => {
      const next = buildOverlapMatrix(n);
      for (let i = 0; i < Math.min(prev.length, n); i++) {
        for (let j = 0; j < Math.min(prev[i].length, n); j++) {
          next[i][j] = prev[i][j];
        }
      }
      return next;
    });
  }, []);

  const handleZoneNameChange = useCallback((idx: number, value: string) => {
    setZoneNames((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleOverlapChange = useCallback((i: number, j: number, checked: boolean) => {
    setOverlaps((prev) => {
      const next = prev.map((row) => [...row]);
      next[i][j] = checked;
      next[j][i] = checked; // symmetric
      return next;
    });
  }, []);

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

  // Compute results
  const results = useMemo<FreqCoordResults>(() => {
    return computeFreqCoord(region, bwKhz, zoneNames, overlaps);
  }, [region, bwKhz, zoneNames, overlaps]);

  // Build overlap pair list for checkboxes
  const overlapPairs = useMemo(() => {
    const pairs: { i: number; j: number }[] = [];
    for (let i = 0; i < zoneCount; i++) {
      for (let j = i + 1; j < zoneCount; j++) {
        pairs.push({ i, j });
      }
    }
    return pairs;
  }, [zoneCount]);

  if (!isOpen) return null;

  return (
    <div className="mcf-overlay" role="dialog" aria-modal="true" aria-label="RF Channel Frequency Coordinator">
      <div className="mcf-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="mcf-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="mcf-title">
              RF Channel Frequency Coordinator
              <span className="mcf-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="mcf-subtitle">
              Assign non-interfering center frequencies to co-located MeshCore networks in metro deployments
            </p>
          </div>
          <button className="mcf-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="mcf-body">

          {/* Section 1 — Network Configuration */}
          <div className="mcf-section">
            <h3 className="mcf-section-title">Network Configuration</h3>
            <div className="mcf-inputs">
              <div className="mcf-inputs-row mcf-inputs-row-3">
                <div className="mcf-field">
                  <label htmlFor="mcf-region">Region</label>
                  <select
                    id="mcf-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as FreqRegion)}
                    title="ISM band region — determines available bandwidth and channel count"
                  >
                    <option value="US">US 902-928 MHz</option>
                    <option value="EU">EU 863-870 MHz</option>
                    <option value="ANZ">ANZ 915-928 MHz</option>
                  </select>
                </div>
                <div className="mcf-field">
                  <label htmlFor="mcf-bw">Bandwidth</label>
                  <select
                    id="mcf-bw"
                    value={bwKhz}
                    onChange={(e) => setBwKhz(parseFloat(e.target.value) as BandwidthKhz)}
                    title="LoRa signal bandwidth. Channel spacing is set to 2x BW for -50 dB co-channel isolation"
                  >
                    <option value={62.5}>62.5 kHz</option>
                    <option value={125}>125 kHz</option>
                    <option value={250}>250 kHz</option>
                  </select>
                </div>
                <div className="mcf-field">
                  <label htmlFor="mcf-zone-count">Number of Zones</label>
                  <input
                    id="mcf-zone-count"
                    type="number"
                    min={2}
                    max={8}
                    value={zoneCount}
                    onChange={(e) => handleZoneCountChange(e.target.value)}
                    title="Number of independent MeshCore networks to coordinate (2-8)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — Zone Names */}
          <div className="mcf-section">
            <h3 className="mcf-section-title">Zone Names</h3>
            <div className="mcf-inputs">
              <div className="mcf-zone-names-grid">
                {zoneNames.map((name, idx) => (
                  <div className="mcf-field" key={idx}>
                    <label htmlFor={`mcf-zone-name-${idx}`}>Zone {idx + 1} Name</label>
                    <input
                      id={`mcf-zone-name-${idx}`}
                      type="text"
                      value={name}
                      onChange={(e) => handleZoneNameChange(idx, e.target.value)}
                      title={`Name for Zone ${idx + 1}`}
                      maxLength={40}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3 — Overlap Matrix */}
          <div className="mcf-section">
            <h3 className="mcf-section-title">Geographic Overlap</h3>
            <p className="mcf-overlap-note">
              Overlapping zones require separate frequencies. Non-overlapping zones can reuse the same frequency.
            </p>
            <div className="mcf-overlap-list">
              {overlapPairs.map(({ i, j }) => {
                const checkId = `mcf-overlap-${i}-${j}`;
                return (
                  <div className="mcf-overlap-row" key={checkId}>
                    <input
                      id={checkId}
                      type="checkbox"
                      checked={overlaps[i]?.[j] ?? false}
                      onChange={(e) => handleOverlapChange(i, j, e.target.checked)}
                    />
                    <label htmlFor={checkId}>
                      {zoneNames[i] || `Zone ${i + 1}`} overlaps with {zoneNames[j] || `Zone ${j + 1}`} geographically
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="mcf-results" role="region" aria-label="Frequency coordination results">
            <h3 className="mcf-section-title">Results</h3>

            <div className="mcf-results-grid">
              <div className="mcf-result-row">
                <span className="mcf-result-label">Channel spacing used</span>
                <span className="mcf-result-value">
                  {results.channelSpacingKhz} kHz (2x BW for -50 dB co-channel isolation)
                </span>
              </div>
              <div className="mcf-result-row">
                <span className="mcf-result-label">Available channels in band</span>
                <span className="mcf-result-value">{results.availableChannels} channels</span>
              </div>
              <div className="mcf-result-row">
                <span className="mcf-result-label">Feasibility</span>
                <span
                  className={`mcf-result-value mcf-feasibility ${results.feasible ? 'mcf-feasibility-pass' : 'mcf-feasibility-fail'}`}
                >
                  {results.feasible ? 'PASS' : 'CONFLICT'}
                </span>
              </div>
            </div>

            {/* Per-zone frequency assignment table */}
            <table className="mcf-freq-zone-table" aria-label="Zone frequency assignments">
              <thead>
                <tr>
                  <th scope="col">Zone Name</th>
                  <th scope="col">Assigned Channel</th>
                  <th scope="col">Center Frequency (MHz)</th>
                </tr>
              </thead>
              <tbody>
                {results.assignments.map((a, idx) => (
                  <tr key={idx}>
                    <td>{a.zoneName || `Zone ${idx + 1}`}</td>
                    <td>
                      {a.channelIndex !== null
                        ? `Ch ${a.channelIndex}`
                        : <span className="mcf-conflict-cell">CONFLICT</span>
                      }
                    </td>
                    <td>
                      {a.freqMhz !== null
                        ? a.freqMhz.toFixed(3)
                        : <span className="mcf-conflict-cell">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!results.feasible && (
              <div className="mcf-alert" role="alert">
                Not enough non-interfering channels for all overlapping zones. Reduce overlap, increase channel spacing, or use a wider band.
              </div>
            )}

            <p className="mcf-note">
              Note: Assignments assume equal spacing across the band. Fine-tune by
              {' '}&plusmn;{results.channelSpacingKhz / 4} kHz to avoid local interference sources.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
