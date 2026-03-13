/**
 * RepeaterChainModal Component
 * MeshCore repeater chain link budget calculator — hop-by-hop analysis.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import './RepeaterChainModal.css';

/* ---- Types ---- */

interface RepeaterChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HopResult {
  hop: number;
  distanceKm: number;
  receivedSignalDbm: number;
  linkMarginDb: number;
  status: 'Strong' | 'Good' | 'Marginal' | 'No Link';
}

const ENVIRONMENTS: { label: string; n: number }[] = [
  { label: 'Clear LOS', n: 2.0 },
  { label: 'Open Rural', n: 2.8 },
  { label: 'Suburban', n: 3.3 },
  { label: 'Urban', n: 4.0 },
];

/* ---- Math ---- */

function computeHops(
  txPowerDbm: number,
  antennaGainDbi: number,
  cableLossDb: number,
  freqMhz: number,
  envN: number,
  hopDistanceKm: number,
  numHops: number,
  rxSensitivityDbm: number,
): HopResult[] {
  const eirp = txPowerDbm + antennaGainDbi - cableLossDb;
  const dM = hopDistanceKm * 1000;
  const log10dM = Math.log10(dM);

  // FSPL (dB): 20*log10(d) + 20*log10(f_MHz) - 27.55
  const fspl = 20 * log10dM + 20 * Math.log10(freqMhz) - 27.55;

  // Environment excess loss beyond free-space (n=2.0 baseline)
  const envExcess = 10 * (envN - 2.0) * log10dM;

  const receivedSignal = eirp - fspl - envExcess;
  const linkMargin = receivedSignal - rxSensitivityDbm;

  function getStatus(margin: number): HopResult['status'] {
    if (margin > 20) return 'Strong';
    if (margin > 10) return 'Good';
    if (margin >= 0) return 'Marginal';
    return 'No Link';
  }

  return Array.from({ length: numHops }, (_, i) => ({
    hop: i + 1,
    distanceKm: hopDistanceKm * (i + 1),
    receivedSignalDbm: receivedSignal,
    linkMarginDb: linkMargin,
    status: getStatus(linkMargin),
  }));
}

/* ---- Component ---- */

export function RepeaterChainModal({ isOpen, onClose }: RepeaterChainModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [txPower, setTxPower] = useState(20);
  const [antennaGain, setAntennaGain] = useState(2.15);
  const [cableLoss, setCableLoss] = useState(0.5);
  const [freqMhz, setFreqMhz] = useState(906.875);
  const [envIndex, setEnvIndex] = useState(1); // Open Rural default
  const [hopDistance, setHopDistance] = useState(5);
  const [numHops, setNumHops] = useState(3);
  const [rxSensitivity, setRxSensitivity] = useState(-130);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTxPower(20);
      setAntennaGain(2.15);
      setCableLoss(0.5);
      setFreqMhz(906.875);
      setEnvIndex(1);
      setHopDistance(5);
      setNumHops(3);
      setRxSensitivity(-130);
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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

  // Compute hops
  const hops = useMemo(() => {
    const env = ENVIRONMENTS[envIndex] ?? ENVIRONMENTS[1];
    return computeHops(
      txPower, antennaGain, cableLoss, freqMhz,
      env.n, hopDistance, numHops, rxSensitivity,
    );
  }, [txPower, antennaGain, cableLoss, freqMhz, envIndex, hopDistance, numHops, rxSensitivity]);

  // Derived summary
  const totalReachKm = hopDistance * numHops;
  const weakestHop = hops.reduce((min, h) => h.linkMarginDb < min.linkMarginDb ? h : min, hops[0]);
  const brokenHop = hops.find(h => h.status === 'No Link');

  if (!isOpen) return null;

  return (
    <div className="rc-overlay" role="dialog" aria-modal="true" aria-label="Repeater Chain Calculator">
      <div className="rc-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="rc-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="rc-title">Repeater Chain Calculator</h2>
            <p className="rc-summary">
              MeshCore hop-by-hop link budget — each repeater regenerates the signal
            </p>
            <span className="rc-drag-hint">Drag to move</span>
          </div>
          <button className="rc-close" type="button" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Body */}
        <div className="rc-body">

          {/* Inputs */}
          <div className="rc-inputs">
            <div className="rc-inputs-row">
              <div className="rc-field">
                <label htmlFor="rc-txpower">TX Power (dBm)</label>
                <input
                  id="rc-txpower"
                  type="number"
                  min={1}
                  max={30}
                  value={txPower}
                  onChange={(e) => setTxPower(parseFloat(e.target.value) || 20)}
                  title="Transmit power in dBm (1–30). MeshCore devices typically support up to 22 dBm (158 mW)"
                />
              </div>
              <div className="rc-field">
                <label htmlFor="rc-antgain">Antenna Gain (dBi)</label>
                <input
                  id="rc-antgain"
                  type="number"
                  min={0}
                  max={12}
                  step={0.1}
                  value={antennaGain}
                  onChange={(e) => setAntennaGain(parseFloat(e.target.value) || 0)}
                  title="Antenna gain in dBi (0–12). Typical whip: 2.15 dBi. Higher-gain directional antennas increase range"
                />
              </div>
              <div className="rc-field">
                <label htmlFor="rc-cableloss">Cable Loss (dB)</label>
                <input
                  id="rc-cableloss"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={cableLoss}
                  onChange={(e) => setCableLoss(parseFloat(e.target.value) || 0)}
                  title="Coax cable and connector loss in dB (0–5). Typical short run: 0.5 dB"
                />
              </div>
            </div>

            <div className="rc-inputs-row">
              <div className="rc-field">
                <label htmlFor="rc-freq">Frequency (MHz)</label>
                <input
                  id="rc-freq"
                  type="number"
                  min={100}
                  max={3000}
                  step={0.001}
                  value={freqMhz}
                  onChange={(e) => setFreqMhz(parseFloat(e.target.value) || 906.875)}
                  title="Center frequency in MHz. MeshCore US FCC default is 906.875 MHz"
                />
              </div>
              <div className="rc-field">
                <label htmlFor="rc-env">Environment</label>
                <select
                  id="rc-env"
                  value={envIndex}
                  onChange={(e) => setEnvIndex(parseInt(e.target.value))}
                  title="Propagation environment affects path loss exponent. Clear LOS (n=2.0) assumes unobstructed line of sight; Urban (n=4.0) accounts for heavy building clutter"
                >
                  {ENVIRONMENTS.map((env, i) => (
                    <option key={env.label} value={i}>
                      {env.label} (n={env.n})
                    </option>
                  ))}
                </select>
              </div>
              <div className="rc-field">
                <label htmlFor="rc-rxsens">RX Sensitivity (dBm)</label>
                <input
                  id="rc-rxsens"
                  type="number"
                  min={-140}
                  max={-80}
                  value={rxSensitivity}
                  onChange={(e) => setRxSensitivity(parseFloat(e.target.value) || -130)}
                  title="Receiver sensitivity in dBm. MeshCore on SX1262 is approximately -130 dBm at SF11/BW250"
                />
              </div>
            </div>

            <div className="rc-inputs-row rc-inputs-row-2">
              <div className="rc-field">
                <label htmlFor="rc-hopdist">Hop Distance (km)</label>
                <div className="rc-slider-group">
                  <input
                    id="rc-hopdist"
                    type="range"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={hopDistance}
                    onChange={(e) => setHopDistance(parseFloat(e.target.value))}
                    aria-label="Hop distance slider"
                    title={`Distance between each repeater: ${hopDistance} km — drag to adjust (0.5–50 km)`}
                  />
                  <input
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={hopDistance}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v >= 0.5 && v <= 50) setHopDistance(v);
                    }}
                    className="rc-number-sm"
                    aria-label="Hop distance km"
                    title="Enter hop distance in km (0.5–50)"
                  />
                </div>
              </div>
              <div className="rc-field">
                <label htmlFor="rc-numhops">Number of Hops</label>
                <div className="rc-slider-group">
                  <input
                    id="rc-numhops"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={numHops}
                    onChange={(e) => setNumHops(parseInt(e.target.value))}
                    aria-label="Number of hops slider"
                    title={`Number of repeater hops: ${numHops} — drag to adjust (1–10)`}
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={numHops}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= 10) setNumHops(v);
                    }}
                    className="rc-number-sm"
                    aria-label="Number of hops"
                    title="Enter number of hops (1–10)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="rc-summary-cards">
            <div className="rc-card rc-card-primary" title="Total linear distance covered by the entire repeater chain">
              <span className="rc-card-value">{totalReachKm.toFixed(1)} km</span>
              <span className="rc-card-label">Total Chain Reach</span>
            </div>
            <div className="rc-card" title="EIRP = TX Power + Antenna Gain − Cable Loss">
              <span className="rc-card-value">
                {(txPower + antennaGain - cableLoss).toFixed(1)} dBm
              </span>
              <span className="rc-card-label">EIRP</span>
            </div>
            <div
              className={`rc-card ${weakestHop && weakestHop.linkMarginDb < 0 ? 'rc-card-danger' : weakestHop && weakestHop.linkMarginDb < 10 ? 'rc-card-warn' : 'rc-card-ok'}`}
              title="The hop with the smallest link margin determines maximum chain reliability"
            >
              <span className="rc-card-value">
                {hops.length > 0 ? `${weakestHop.linkMarginDb.toFixed(1)} dB` : '—'}
              </span>
              <span className="rc-card-label">
                Weakest Link (Hop {hops.length > 0 ? weakestHop.hop : '—'})
              </span>
            </div>
          </div>

          {/* Chain broken warning */}
          {brokenHop && (
            <div className="rc-alert-broken" role="alert">
              Chain broken at hop {brokenHop.hop} — reduce hop distance or increase TX power / antenna gain
            </div>
          )}

          {/* Results table */}
          <div className="rc-results">
            <h3 className="rc-section-title">Hop-by-Hop Analysis</h3>
            <div className="rc-table-wrap">
              <table className="rc-table">
                <thead>
                  <tr>
                    <th title="Hop number in the chain">Hop #</th>
                    <th title="Cumulative distance from origin to end of this hop">Distance (km)</th>
                    <th title="Received signal strength at the end of this hop">Received Signal (dBm)</th>
                    <th title="Link margin = received signal − receiver sensitivity. Higher is better">Link Margin (dB)</th>
                    <th title="Link quality: Strong >20 dB, Good 10–20 dB, Marginal 0–10 dB, No Link <0 dB">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hops.map((hop, idx) => (
                    <tr key={hop.hop} className={idx % 2 === 0 ? 'rc-row-even' : 'rc-row-odd'}>
                      <td>{hop.hop}</td>
                      <td>{hop.distanceKm.toFixed(1)}</td>
                      <td className={hop.receivedSignalDbm < rxSensitivity ? 'rc-value-bad' : ''}>{hop.receivedSignalDbm.toFixed(1)}</td>
                      <td className={
                        hop.linkMarginDb < 0 ? 'rc-value-bad' :
                        hop.linkMarginDb < 10 ? 'rc-value-marginal' :
                        hop.linkMarginDb < 20 ? 'rc-value-good' :
                        'rc-value-strong'
                      }>
                        {hop.linkMarginDb.toFixed(1)}
                      </td>
                      <td>
                        <span className={`rc-status-badge rc-status-${hop.status.toLowerCase().replace(' ', '-')}`}>
                          {hop.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hops.length > 0 && (
              <p className="rc-summary-line">
                Total chain reach: <strong>{totalReachKm.toFixed(1)} km</strong> &nbsp;|&nbsp;
                Weakest link: Hop {weakestHop.hop} at <strong>{weakestHop.linkMarginDb.toFixed(1)} dB</strong> margin
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
