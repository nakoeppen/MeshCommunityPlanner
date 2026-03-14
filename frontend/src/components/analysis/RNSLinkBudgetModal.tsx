/**
 * RNSLinkBudgetModal Component
 * RNode Link Budget & Range Estimator for Reticulum (RNS) networks.
 * Calculates data rate, time-on-air, link budget, and max range for SX1276/SX1262 chipsets.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './RNSLinkBudgetModal.css';

/* ---- Types ---- */

export interface RNSLinkBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Chipset = 'SX1276' | 'SX1262';
type SpreadingFactor = 7 | 8 | 9 | 10 | 11 | 12;
type Bandwidth = 7.8 | 10.4 | 15.6 | 20.8 | 31.25 | 41.7 | 62.5 | 125 | 250 | 500;
type CodingRate = 5 | 6 | 7 | 8;
type FrequencyMHz = 433 | 868 | 915;
type Environment = 'los' | 'suburban' | 'urban' | 'obstructed';

const CHIPSET_PARAMS: Record<Chipset, { maxTx: number; floor: number }> = {
  SX1276: { maxTx: 20, floor: -137 },
  SX1262: { maxTx: 22, floor: -140 },
};

const SNR_BY_SF: Record<number, number> = {
  7: -7.5,
  8: -10,
  9: -12.5,
  10: -15,
  11: -17.5,
  12: -20,
};

const ENV_FADE_MARGIN: Record<Environment, number> = {
  los: 0,
  suburban: 10,
  urban: 20,
  obstructed: 30,
};

const BANDWIDTH_OPTIONS: Bandwidth[] = [7.8, 10.4, 15.6, 20.8, 31.25, 41.7, 62.5, 125, 250, 500];
const FREQUENCY_OPTIONS: FrequencyMHz[] = [433, 868, 915];

/* ---- Math helpers ---- */

function calcSensitivity(sf: SpreadingFactor, bwKHz: Bandwidth, chipset: Chipset): number {
  const bwHz = bwKHz * 1000;
  const NF = 6;
  const snr = SNR_BY_SF[sf];
  const raw = -174 + 10 * Math.log10(bwHz) + NF + snr;
  return Math.max(raw, CHIPSET_PARAMS[chipset].floor);
}

function calcDataRate(sf: SpreadingFactor, bwKHz: Bandwidth, cr: CodingRate): number {
  return (sf * (4 / (4 + cr)) * bwKHz * 1000) / Math.pow(2, sf);
}

function calcTimeOnAir(sf: SpreadingFactor, bwKHz: Bandwidth, cr: CodingRate): number {
  const bwHz = bwKHz * 1000;
  const symbolDurationMs = (Math.pow(2, sf) / bwHz) * 1000;
  const preambleSymbols = 8;
  const lowDrOpt = sf >= 11 ? 1 : 0;
  const preambleTimeMs = (preambleSymbols + 4.25) * symbolDurationMs;
  const payloadBytes = 500;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil(
        (8 * payloadBytes - 4 * sf + 28 + 16) / (4 * (sf - 2 * lowDrOpt)),
      ) * cr,
      0,
    );
  const payloadTimeMs = payloadSymbols * symbolDurationMs;
  return preambleTimeMs + payloadTimeMs;
}

function calcFSPL1km(freqMHz: FrequencyMHz): number {
  const freqHz = freqMHz * 1e6;
  return 20 * Math.log10(1000) + 20 * Math.log10(freqHz) - 147.55;
}

function calcLinkBudget(
  txPower: number,
  gainTx: number,
  gainRx: number,
  cableLoss: number,
  sensitivity: number,
  fadeMargindB: number,
  requiredMargin: number,
): number {
  return txPower + gainTx + gainRx - cableLoss - sensitivity - fadeMargindB - requiredMargin;
}

function calcMaxRange(linkBudgetdB: number, fspl1km: number): number {
  if (linkBudgetdB <= 0) return 0;
  return Math.pow(10, (linkBudgetdB - fspl1km) / 20);
}

function rangeQualitative(km: number): string {
  if (km < 1) return 'Short (< 1 km)';
  if (km < 5) return 'Medium (1–5 km)';
  if (km < 20) return 'Long (5–20 km)';
  return 'Very Long (> 20 km)';
}

/* ---- Component ---- */

export function RNSLinkBudgetModal({ isOpen, onClose }: RNSLinkBudgetModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [chipset, setChipset] = useState<Chipset>('SX1276');
  const [txPower, setTxPower] = useState(17);
  const [sf, setSF] = useState<SpreadingFactor>(7);
  const [bwKHz, setBwKHz] = useState<Bandwidth>(125);
  const [cr, setCR] = useState<CodingRate>(5);
  const [freqMHz, setFreqMHz] = useState<FrequencyMHz>(915);
  const [gainTx, setGainTx] = useState(2.15);
  const [gainRx, setGainRx] = useState(2.15);
  const [cableLoss, setCableLoss] = useState(0.5);
  const [environment, setEnvironment] = useState<Environment>('los');
  const [requiredMargin, setRequiredMargin] = useState(10);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setChipset('SX1276');
      setTxPower(17);
      setSF(7);
      setBwKHz(125);
      setCR(5);
      setFreqMHz(915);
      setGainTx(2.15);
      setGainRx(2.15);
      setCableLoss(0.5);
      setEnvironment('los');
      setRequiredMargin(10);
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  // Clamp txPower to chipset max
  useEffect(() => {
    const maxTx = CHIPSET_PARAMS[chipset].maxTx;
    if (txPower > maxTx) setTxPower(maxTx);
  }, [chipset, txPower]);

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

  // Derived results
  const results = useMemo(() => {
    const sensitivity = calcSensitivity(sf, bwKHz, chipset);
    const dr = calcDataRate(sf, bwKHz, cr);
    const toa = calcTimeOnAir(sf, bwKHz, cr);
    const fspl1km = calcFSPL1km(freqMHz);
    const fadeMargindB = ENV_FADE_MARGIN[environment];
    const lb = calcLinkBudget(txPower, gainTx, gainRx, cableLoss, sensitivity, fadeMargindB, requiredMargin);
    const maxRange = calcMaxRange(lb, fspl1km);
    return {
      sensitivitydBm: sensitivity,
      dataRateBps: dr,
      toaMs: toa,
      linkBudgetdB: lb,
      maxRangeKm: maxRange,
      meetsMinimum: dr >= 5,
      lowDrOpt: sf >= 11,
    };
  }, [chipset, txPower, sf, bwKHz, cr, freqMHz, gainTx, gainRx, cableLoss, environment, requiredMargin]);

  if (!isOpen) return null;

  const maxTx = CHIPSET_PARAMS[chipset].maxTx;

  return (
    <div className="rlb-overlay" role="dialog" aria-modal="true" aria-label="RNode Link Budget & Range Estimator">
      <div className="rlb-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="rlb-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="rlb-title">RNode Link Budget &amp; Range Estimator
              <span className="rlb-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="rlb-summary">
              SX1276/SX1262 chipset link budget, max range estimate, and RNS 5 bps minimum check
            </p>
          </div>
          <button className="rlb-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="rlb-body">
          {/* Inputs */}
          <div className="rlb-inputs">

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-chipset">Chipset</label>
                <select
                  id="rlb-chipset"
                  value={chipset}
                  onChange={(e) => setChipset(e.target.value as Chipset)}
                  title="SX1276: max +20 dBm Tx, -137 dBm floor. SX1262: max +22 dBm Tx, -140 dBm floor."
                >
                  <option value="SX1276">SX1276 (max +20 dBm, -137 dBm floor)</option>
                  <option value="SX1262">SX1262 (max +22 dBm, -140 dBm floor)</option>
                </select>
              </div>
              <div className="rlb-field">
                <label htmlFor="rlb-txpower">Tx Power (dBm)</label>
                <NumberInput
                  id="rlb-txpower"
                  min={1}
                  max={maxTx}
                  value={txPower}
                  onChange={(v) => setTxPower(Math.round(v))}
                  title={`Transmit power in dBm. Max ${maxTx} dBm for ${chipset}.`}
                />
              </div>
            </div>

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-sf">Spreading Factor</label>
                <select
                  id="rlb-sf"
                  value={sf}
                  onChange={(e) => setSF(parseInt(e.target.value) as SpreadingFactor)}
                  title="Higher SF = longer range, lower data rate. SF7 fastest; SF12 longest range."
                >
                  {[7, 8, 9, 10, 11, 12].map((v) => (
                    <option key={v} value={v}>SF{v}</option>
                  ))}
                </select>
              </div>
              <div className="rlb-field">
                <label htmlFor="rlb-bw">Bandwidth (kHz)</label>
                <select
                  id="rlb-bw"
                  value={bwKHz}
                  onChange={(e) => setBwKHz(parseFloat(e.target.value) as Bandwidth)}
                  title="LoRa channel bandwidth. Wider = faster data rate but shorter range."
                >
                  {BANDWIDTH_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v} kHz</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-cr">Coding Rate</label>
                <select
                  id="rlb-cr"
                  value={cr}
                  onChange={(e) => setCR(parseInt(e.target.value) as CodingRate)}
                  title="Forward error correction ratio. Higher CR = more redundancy, lower throughput."
                >
                  <option value={5}>4/5 (CR5 — least overhead)</option>
                  <option value={6}>4/6 (CR6)</option>
                  <option value={7}>4/7 (CR7)</option>
                  <option value={8}>4/8 (CR8 — most redundancy)</option>
                </select>
              </div>
              <div className="rlb-field">
                <label htmlFor="rlb-freq">Frequency Band</label>
                <select
                  id="rlb-freq"
                  value={freqMHz}
                  onChange={(e) => setFreqMHz(parseInt(e.target.value) as FrequencyMHz)}
                  title="Operating frequency band. Lower frequency = longer range due to reduced free-space path loss."
                >
                  {FREQUENCY_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v} MHz</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-gain-tx">Antenna Gain TX (dBi)</label>
                <NumberInput
                  id="rlb-gain-tx"
                  min={0}
                  max={20}
                  step={0.1}
                  value={gainTx}
                  onChange={(v) => setGainTx(v)}
                  title="Transmit antenna gain in dBi. A basic 1/4-wave whip is ~2.15 dBi. (0–20 dBi)"
                />
              </div>
              <div className="rlb-field">
                <label htmlFor="rlb-gain-rx">Antenna Gain RX (dBi)</label>
                <NumberInput
                  id="rlb-gain-rx"
                  min={0}
                  max={20}
                  step={0.1}
                  value={gainRx}
                  onChange={(v) => setGainRx(v)}
                  title="Receive antenna gain in dBi. A basic 1/4-wave whip is ~2.15 dBi. (0–20 dBi)"
                />
              </div>
            </div>

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-cable-loss">Cable/Connector Loss (dB)</label>
                <NumberInput
                  id="rlb-cable-loss"
                  min={0}
                  max={10}
                  step={0.1}
                  value={cableLoss}
                  onChange={(v) => setCableLoss(v)}
                  title="Total coax cable and connector insertion loss in dB. Typical: 0.5–2 dB for short runs. (0–10 dB)"
                />
              </div>
              <div className="rlb-field">
                <label htmlFor="rlb-environment">Environment</label>
                <select
                  id="rlb-environment"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as Environment)}
                  title="Additional fade margin applied for non-line-of-sight environments."
                >
                  <option value="los">Line of Sight (0 dB)</option>
                  <option value="suburban">Suburban (10 dB)</option>
                  <option value="urban">Urban (20 dB)</option>
                  <option value="obstructed">Obstructed (30 dB)</option>
                </select>
              </div>
            </div>

            <div className="rlb-inputs-row">
              <div className="rlb-field">
                <label htmlFor="rlb-required-margin">Required Link Margin (dB)</label>
                <NumberInput
                  id="rlb-required-margin"
                  min={0}
                  max={30}
                  value={requiredMargin}
                  onChange={(v) => setRequiredMargin(Math.round(v))}
                  title="Safety margin reserved in the link budget. 10 dB is a common conservative default. (0–30 dB)"
                />
              </div>
              <div className="rlb-field" />
            </div>
          </div>

          {/* Low DR Opt note */}
          {results.lowDrOpt && (
            <div className="rlb-note rlb-note-info">
              Low Data Rate Optimization active — slower but longer range.
            </div>
          )}

          {/* Results */}
          <div className="rlb-results">
            <h3 className="rlb-section-title">Results</h3>

            <div className="rlb-results-grid">
              <div className="rlb-result-item">
                <span className="rlb-result-label">Data rate</span>
                <span
                  className="rlb-result-value"
                  style={{ color: results.dataRateBps < 5 ? '#e74c3c' : undefined }}
                >
                  {results.dataRateBps < 1
                    ? results.dataRateBps.toFixed(2)
                    : results.dataRateBps.toFixed(1)}{' '}
                  bps
                </span>
              </div>

              <div className="rlb-result-item">
                <span className="rlb-result-label">Time-on-Air (500-byte MTU)</span>
                <span className="rlb-result-value">
                  {results.toaMs.toLocaleString(undefined, { maximumFractionDigits: 0 })} ms
                  {' '}({(results.toaMs / 1000).toFixed(1)} s)
                </span>
              </div>

              <div className="rlb-result-item">
                <span className="rlb-result-label">RX sensitivity (calculated)</span>
                <span className="rlb-result-value">
                  {results.sensitivitydBm.toFixed(1)} dBm
                </span>
              </div>

              <div className="rlb-result-item">
                <span className="rlb-result-label">Link budget</span>
                <span className="rlb-result-value">
                  {results.linkBudgetdB.toFixed(1)} dB
                </span>
              </div>

              <div className="rlb-result-item">
                <span className="rlb-result-label">Estimated max range</span>
                <span className="rlb-result-value">
                  {results.maxRangeKm < 0.1
                    ? '< 0.1 km'
                    : `${results.maxRangeKm.toFixed(1)} km`}
                  <span className="rlb-range-band">
                    {' '}— {rangeQualitative(results.maxRangeKm)}
                  </span>
                </span>
              </div>

              <div className="rlb-result-item">
                <span className="rlb-result-label">RNS 5 bps minimum</span>
                <span
                  className={`rlb-result-value rlb-badge ${results.meetsMinimum ? 'rlb-badge-pass' : 'rlb-badge-fail'}`}
                >
                  {results.meetsMinimum
                    ? `✓ PASS (${results.dataRateBps.toFixed(1)} bps)`
                    : `✗ FAIL (${results.dataRateBps.toFixed(2)} bps)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
