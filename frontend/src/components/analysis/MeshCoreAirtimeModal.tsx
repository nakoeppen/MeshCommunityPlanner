/**
 * MeshCoreAirtimeModal Component
 * MeshCore Airtime & Duty Cycle Budget Calculator.
 * Computes LoRa Time-on-Air, projected duty cycle, and required AF for compliance.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './MeshCoreAirtimeModal.css';

/* ---- Types ---- */

interface MeshCoreAirtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Region = 'US' | 'EU' | 'AU' | 'Other';
type SpreadingFactor = 7 | 8 | 9 | 10 | 11 | 12;
type Bandwidth = 62.5 | 125 | 250;
type CodingRate = 5 | 6 | 7 | 8;

/* ---- Math ---- */

function computeToAMs(
  sf: SpreadingFactor,
  bwKhz: Bandwidth,
  crNum: CodingRate,
  payloadBytes: number,
): number {
  const bwHz = bwKhz * 1000;
  const symbolDuration = (Math.pow(2, sf) / bwHz) * 1000; // ms

  const preambleSymbols = 8;
  const preambleTime = (preambleSymbols + 4.25) * symbolDuration;

  const lowDrOpt = sf >= 11 ? 1 : 0;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil((8 * payloadBytes - 4 * sf + 28 + 16) / (4 * (sf - 2 * lowDrOpt))) * crNum,
      0,
    );
  const payloadTime = payloadSymbols * symbolDuration;

  return preambleTime + payloadTime;
}

function euDutyCycleLimit(freqMhz: number): number {
  // h1.5 sub-band 869.4–869.65 MHz: 10% max; all other EU sub-bands: 1%
  if (freqMhz >= 869.4 && freqMhz <= 869.65) return 10;
  return 1;
}

/* ---- Component ---- */

export function MeshCoreAirtimeModal({ isOpen, onClose }: MeshCoreAirtimeModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [region, setRegion] = useState<Region>('US');
  const [freqMhz, setFreqMhz] = useState(910.525);
  const [sf, setSf] = useState<SpreadingFactor>(7);
  const [bwKhz, setBwKhz] = useState<Bandwidth>(62.5);
  const [crNum, setCrNum] = useState<CodingRate>(5);
  const [payloadBytes, setPayloadBytes] = useState(40);
  const [messagesPerHour, setMessagesPerHour] = useState(10);
  const [advertsPerHour, setAdvertsPerHour] = useState(5);
  const [af, setAf] = useState(9);
  const [targetDutyCycle, setTargetDutyCycle] = useState(5);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setRegion('US');
      setFreqMhz(910.525);
      setSf(7);
      setBwKhz(62.5);
      setCrNum(5);
      setPayloadBytes(40);
      setMessagesPerHour(10);
      setAdvertsPerHour(5);
      setAf(9);
      setTargetDutyCycle(5);
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

  // Compute results
  const results = useMemo(() => {
    const toaMessageMs = computeToAMs(sf, bwKhz, crNum, payloadBytes);
    // Advert packets use a fixed 20-byte payload for the ToA estimate
    const toaAdvertMs = computeToAMs(sf, bwKhz, crNum, 20);

    const totalAirtimeMsPerHour =
      messagesPerHour * toaMessageMs + advertsPerHour * toaAdvertMs;
    const projectedDutyCyclePct = (totalAirtimeMsPerHour / (3600 * 1000)) * 100;

    const afDutyCyclePct = 100 / (af + 1);
    const requiredAF = Math.ceil(100 / targetDutyCycle - 1);

    // EU regulatory
    const regulatoryLimit = region === 'EU' ? euDutyCycleLimit(freqMhz) : null;
    const euCompliant =
      regulatoryLimit !== null ? projectedDutyCyclePct <= regulatoryLimit : null;

    return {
      toaMessageMs,
      toaAdvertMs,
      projectedDutyCyclePct,
      afDutyCyclePct,
      requiredAF,
      regulatoryLimit,
      euCompliant,
    };
  }, [sf, bwKhz, crNum, payloadBytes, messagesPerHour, advertsPerHour, af, targetDutyCycle, region, freqMhz]);

  function dutyCycleClass(projected: number, afLimit: number, regLimit: number | null): string {
    const limit = regLimit !== null ? Math.min(afLimit, regLimit) : afLimit;
    if (projected > limit) return 'mca-value-red';
    if (projected > limit * 0.7) return 'mca-value-yellow';
    return 'mca-value-green';
  }

  if (!isOpen) return null;

  return (
    <div className="mca-overlay" role="dialog" aria-modal="true" aria-label="Airtime & Duty Cycle Calculator">
      <div className="mca-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="mca-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="mca-title">
              Airtime &amp; Duty Cycle Calculator
              <span className="mca-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="mca-subtitle">
              LoRa Time-on-Air, duty cycle budget, and required AF for your MeshCore RF profile
            </p>
          </div>
          <button className="mca-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="mca-body">
          {/* Inputs */}
          <div className="mca-inputs">
            <div className="mca-inputs-row mca-inputs-row-3">
              <div className="mca-field">
                <label htmlFor="mca-region">Region</label>
                <select
                  id="mca-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                  title="Regulatory region — determines duty cycle limits (EU has strict limits; US 915 MHz ISM has none by law)"
                >
                  <option value="US">US</option>
                  <option value="EU">EU</option>
                  <option value="AU">AU</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mca-field">
                <label htmlFor="mca-freq">Frequency (MHz)</label>
                <NumberInput
                  id="mca-freq"
                  min={100}
                  max={3000}
                  step={0.001}
                  value={freqMhz}
                  onChange={(v) => setFreqMhz(v)}
                  title="Center frequency in MHz. MeshCore US default is 910.525 MHz; EU h1.5 sub-band is 869.525 MHz"
                />
              </div>
              <div className="mca-field">
                <label htmlFor="mca-sf">Spreading Factor</label>
                <select
                  id="mca-sf"
                  value={sf}
                  onChange={(e) => setSf(parseInt(e.target.value) as SpreadingFactor)}
                  title="LoRa spreading factor (SF7–SF12). Higher SF = longer range and airtime, lower data rate"
                >
                  <option value={7}>SF7</option>
                  <option value={8}>SF8</option>
                  <option value={9}>SF9</option>
                  <option value={10}>SF10</option>
                  <option value={11}>SF11</option>
                  <option value={12}>SF12</option>
                </select>
              </div>
            </div>

            <div className="mca-inputs-row mca-inputs-row-3">
              <div className="mca-field">
                <label htmlFor="mca-bw">Bandwidth (kHz)</label>
                <select
                  id="mca-bw"
                  value={bwKhz}
                  onChange={(e) => setBwKhz(parseFloat(e.target.value) as Bandwidth)}
                  title="LoRa signal bandwidth. Narrower bandwidth = longer range but slower data rate and higher duty cycle per packet"
                >
                  <option value={62.5}>62.5 kHz</option>
                  <option value={125}>125 kHz</option>
                  <option value={250}>250 kHz</option>
                </select>
              </div>
              <div className="mca-field">
                <label htmlFor="mca-cr">Coding Rate</label>
                <select
                  id="mca-cr"
                  value={crNum}
                  onChange={(e) => setCrNum(parseInt(e.target.value) as CodingRate)}
                  title="LoRa forward error correction coding rate. CR5 (4/5) is fastest; CR8 (4/8) adds most redundancy"
                >
                  <option value={5}>CR5 (4/5)</option>
                  <option value={6}>CR6 (4/6)</option>
                  <option value={7}>CR7 (4/7)</option>
                  <option value={8}>CR8 (4/8)</option>
                </select>
              </div>
              <div className="mca-field">
                <label htmlFor="mca-payload">Message Payload (bytes)</label>
                <NumberInput
                  id="mca-payload"
                  min={1}
                  max={255}
                  value={payloadBytes}
                  onChange={(v) => setPayloadBytes(Math.round(v))}
                  title="Payload size of a typical message packet (1–255 bytes). Larger payloads increase Time-on-Air"
                />
              </div>
            </div>

            <div className="mca-inputs-row mca-inputs-row-4">
              <div className="mca-field">
                <label htmlFor="mca-msg-per-hr">Messages per hour</label>
                <NumberInput
                  id="mca-msg-per-hr"
                  min={1}
                  max={1000}
                  value={messagesPerHour}
                  onChange={(v) => setMessagesPerHour(Math.round(v))}
                  title="Number of data messages this node sends per hour (1–1000)"
                />
              </div>
              <div className="mca-field">
                <label htmlFor="mca-advert-per-hr">Advert messages/hr</label>
                <NumberInput
                  id="mca-advert-per-hr"
                  min={0}
                  max={100}
                  value={advertsPerHour}
                  onChange={(v) => setAdvertsPerHour(Math.round(v))}
                  title="Advertisement (beacon) messages per hour (0–100). MeshCore adverts every 2 min locally and every 12h flood"
                />
              </div>
              <div className="mca-field">
                <label htmlFor="mca-af">Airtime Factor (AF)</label>
                <NumberInput
                  id="mca-af"
                  min={1}
                  max={100}
                  value={af}
                  onChange={(v) => setAf(Math.round(v))}
                  title="MeshCore Airtime Factor. Sets duty cycle limit as 100/(AF+1)%. Default 9 = 10% limit"
                />
              </div>
              <div className="mca-field">
                <label htmlFor="mca-target-dc">Target duty cycle (%)</label>
                <NumberInput
                  id="mca-target-dc"
                  min={0.1}
                  max={50}
                  step={0.1}
                  value={targetDutyCycle}
                  onChange={(v) => setTargetDutyCycle(v)}
                  title="Target duty cycle percentage for required-AF calculation (0.1–50%)"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div
            className="mca-results"
            role="region"
            aria-label="Calculation results"
          >
            <h3 className="mca-section-title">Results</h3>

            <div className="mca-results-grid">
              <div className="mca-result-row">
                <span className="mca-result-label">Time-on-Air per message packet</span>
                <span className="mca-result-value">{results.toaMessageMs.toFixed(1)} ms</span>
              </div>
              <div className="mca-result-row">
                <span className="mca-result-label">Time-on-Air per advert packet</span>
                <span className="mca-result-value">{results.toaAdvertMs.toFixed(1)} ms</span>
              </div>
              <div className="mca-result-row">
                <span className="mca-result-label">
                  Projected duty cycle at current settings
                </span>
                <span
                  className={`mca-result-value ${dutyCycleClass(results.projectedDutyCyclePct, results.afDutyCyclePct, results.regulatoryLimit)}`}
                >
                  {results.projectedDutyCyclePct.toFixed(3)}%
                </span>
              </div>
              <div className="mca-result-row">
                <span className="mca-result-label">
                  AF duty cycle limit (100 / (AF+1))
                </span>
                <span className="mca-result-value">{results.afDutyCyclePct.toFixed(2)}%</span>
              </div>
              <div className="mca-result-row">
                <span className="mca-result-label">
                  Required AF to hit {targetDutyCycle}% target
                </span>
                <span className="mca-result-value mca-value-highlight">
                  AF = {results.requiredAF}
                </span>
              </div>

              {results.regulatoryLimit !== null && (
                <>
                  <div className="mca-result-row">
                    <span className="mca-result-label">
                      EU regulatory limit ({freqMhz >= 869.4 && freqMhz <= 869.65 ? 'h1.5 sub-band' : 'standard sub-band'})
                    </span>
                    <span className="mca-result-value">{results.regulatoryLimit}%</span>
                  </div>
                  <div className="mca-result-row">
                    <span className="mca-result-label">EU regulatory compliance</span>
                    <span
                      className={`mca-result-value mca-compliance ${results.euCompliant ? 'mca-compliance-pass' : 'mca-compliance-fail'}`}
                    >
                      {results.euCompliant ? 'PASS ✓' : 'FAIL ✗'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {results.projectedDutyCyclePct > results.afDutyCyclePct && (
              <div className="mca-alert" role="alert">
                Projected duty cycle exceeds AF limit — reduce messages per hour or increase AF
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
