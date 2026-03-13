/**
 * TimeOnAirModal Component
 * LoRa Time-on-Air calculator with live-updating results and preset comparison table.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { computeTimeOnAir, parseCodingRateNum, FALLBACK_PRESETS, type ToAResult, type ModemPresetEntry } from '../../utils/lora';
import { useDraggable } from '../../hooks/useDraggable';
import './TimeOnAirModal.css';

/* ---- Types ---- */

interface TimeOnAirModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogModemPresets: any[];
  currentPresetSF: number;
  currentPresetBW: number;
  currentPresetCR: string;
  catalogDevices?: any[];
  currentDeviceId?: string;
}

/* ---- Component ---- */

export function TimeOnAirModal({
  isOpen,
  onClose,
  catalogModemPresets,
  currentPresetSF,
  currentPresetBW,
  currentPresetCR,
  catalogDevices,
  currentDeviceId,
}: TimeOnAirModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [sf, setSF] = useState(currentPresetSF);
  const [bwKhz, setBwKhz] = useState(currentPresetBW);
  const [crStr, setCrStr] = useState(currentPresetCR);
  const [payloadBytes, setPayloadBytes] = useState(32);
  const [preambleLen, setPreambleLen] = useState(16);
  const [implicitHeader, setImplicitHeader] = useState(false);
  const [crcEnabled, setCrcEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');

  // Reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setSF(currentPresetSF);
      setBwKhz(currentPresetBW);
      setCrStr(currentPresetCR);
      setPayloadBytes(32);
      setPreambleLen(16);
      setImplicitHeader(false);
      setCrcEnabled(true);
      // Find matching preset key
      const key = findPresetKey(currentPresetSF, currentPresetBW, currentPresetCR);
      setSelectedPresetKey(key);
      resetDrag();
    }
  }, [isOpen, currentPresetSF, currentPresetBW, currentPresetCR, resetDrag]);

  // Build unified preset list
  const presetList = useMemo((): { key: string; name: string; sf: number; bw: number; cr: string }[] => {
    if (catalogModemPresets.length > 0) {
      return catalogModemPresets.map((p) => ({
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

  // Get current device TX current
  const txCurrentMa = useMemo(() => {
    if (!catalogDevices || !currentDeviceId) return undefined;
    const device = catalogDevices.find((d: any) => d.id === currentDeviceId);
    return device?.tx_current_ma ?? undefined;
  }, [catalogDevices, currentDeviceId]);

  const currentDeviceName = useMemo(() => {
    if (!catalogDevices || !currentDeviceId) return undefined;
    const device = catalogDevices.find((d: any) => d.id === currentDeviceId);
    return device?.name ?? undefined;
  }, [catalogDevices, currentDeviceId]);

  // Compute results
  const crNum = parseCodingRateNum(crStr);
  const result = useMemo(
    () => computeTimeOnAir(sf, bwKhz, crNum, payloadBytes, preambleLen, implicitHeader, crcEnabled, txCurrentMa),
    [sf, bwKhz, crNum, payloadBytes, preambleLen, implicitHeader, crcEnabled, txCurrentMa],
  );

  // Comparison table
  const comparisonRows = useMemo(() => {
    return presetList.map((p) => {
      const pCrNum = parseCodingRateNum(p.cr);
      const pResult = computeTimeOnAir(p.sf, p.bw, pCrNum, payloadBytes, preambleLen, implicitHeader, crcEnabled);
      return {
        key: p.key,
        name: p.name,
        sf: p.sf,
        bw: p.bw,
        cr: p.cr,
        toaMs: pResult.toaMs,
        dataRateBps: pResult.dataRateBps,
        maxMsgsHr: pResult.maxPacketsPerHour10,
      };
    });
  }, [presetList, payloadBytes, preambleLen, implicitHeader, crcEnabled]);

  // Preset change handler
  const handlePresetChange = useCallback((key: string) => {
    setSelectedPresetKey(key);
    const preset = presetList.find((p) => p.key === key);
    if (preset) {
      setSF(preset.sf);
      setBwKhz(preset.bw);
      setCrStr(preset.cr);
    }
  }, [presetList]);

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

  return (
    <div className="toa-overlay" role="dialog" aria-modal="true" aria-label="LoRa Airtime Calculator">
      <div className="toa-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="toa-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="toa-title">LoRa Airtime Calculator
              <span className="toa-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="toa-summary">
              Calculate packet time-on-air, duty cycle limits, and compare presets
            </p>
          </div>
          <button className="toa-close" type="button" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Body */}
        <div className="toa-body">
          {/* Inputs Section */}
          <div className="toa-inputs">
            <div className="toa-inputs-row">
              <div className="toa-field">
                <label htmlFor="toa-preset">Modem Preset</label>
                <select
                  id="toa-preset"
                  value={selectedPresetKey}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  title="Select a predefined radio configuration — sets Spreading Factor, Bandwidth, and Coding Rate automatically"
                >
                  {presetList.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} (SF{p.sf}/BW{p.bw})
                    </option>
                  ))}
                  {selectedPresetKey === 'Custom' && <option value="Custom">Custom</option>}
                </select>
              </div>
              <div className="toa-field">
                <label htmlFor="toa-payload">Payload Size (bytes)</label>
                <div className="toa-slider-group">
                  <input
                    id="toa-payload"
                    type="range"
                    min={1}
                    max={256}
                    value={payloadBytes}
                    onChange={(e) => setPayloadBytes(parseInt(e.target.value))}
                    aria-label="Payload size slider"
                    title={`Payload size: ${payloadBytes} bytes — drag to adjust (1–256). A typical Meshtastic text message is ~32 bytes`}
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
                    className="toa-number-sm"
                    aria-label="Payload size bytes"
                    title="Enter exact payload size in bytes (1–256)"
                  />
                </div>
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              className="toa-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
              title="Toggle advanced LoRa parameters: Spreading Factor, Bandwidth, Coding Rate, Preamble Length, Header Mode, and CRC"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="toa-advanced">
                <div className="toa-inputs-row toa-inputs-row-3">
                  <div className="toa-field">
                    <label>SF</label>
                    <input
                      type="number"
                      min={5}
                      max={12}
                      value={sf}
                      onChange={(e) => {
                        setSF(parseInt(e.target.value) || 7);
                        setSelectedPresetKey('Custom');
                      }}
                      title="Spreading Factor (5–12). Higher SF = longer range but slower data rate. SF12 gives maximum range; SF7 gives maximum speed"
                    />
                  </div>
                  <div className="toa-field">
                    <label>BW (kHz)</label>
                    <select
                      value={bwKhz}
                      onChange={(e) => {
                        setBwKhz(parseInt(e.target.value));
                        setSelectedPresetKey('Custom');
                      }}
                      title="Bandwidth in kHz. Lower bandwidth = longer range but slower data rate. 125 kHz is common for long range; 500 kHz for high throughput"
                    >
                      <option value={125}>125</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                  <div className="toa-field">
                    <label>Coding Rate</label>
                    <select
                      value={crStr}
                      onChange={(e) => {
                        setCrStr(e.target.value);
                        setSelectedPresetKey('Custom');
                      }}
                      title="Forward Error Correction coding rate. Higher ratios (4/8) add more redundancy for better noise immunity but increase airtime"
                    >
                      <option value="4/5">4/5</option>
                      <option value="4/6">4/6</option>
                      <option value="4/7">4/7</option>
                      <option value="4/8">4/8</option>
                    </select>
                  </div>
                </div>
                <div className="toa-inputs-row toa-inputs-row-3">
                  <div className="toa-field">
                    <label>Preamble Length</label>
                    <input
                      type="number"
                      min={6}
                      max={65535}
                      value={preambleLen}
                      onChange={(e) => setPreambleLen(parseInt(e.target.value) || 16)}
                      title="Number of preamble symbols. Meshtastic uses 16. Longer preambles improve sync reliability but increase airtime"
                    />
                  </div>
                  <div className="toa-field toa-field-check">
                    <label title="Implicit Header mode omits the LoRa header, saving a few bytes of airtime. Meshtastic uses Explicit Header (unchecked) by default. Only enable if both sender and receiver agree on payload length">
                      <input
                        type="checkbox"
                        checked={implicitHeader}
                        onChange={(e) => setImplicitHeader(e.target.checked)}
                      />
                      Implicit Header
                    </label>
                  </div>
                  <div className="toa-field toa-field-check">
                    <label title="CRC (Cyclic Redundancy Check) adds a checksum for error detection. Enabled by default in Meshtastic. Disabling saves ~2 bytes of airtime but packets with bit errors will not be detected">
                      <input
                        type="checkbox"
                        checked={crcEnabled}
                        onChange={(e) => setCrcEnabled(e.target.checked)}
                      />
                      CRC Enabled
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="toa-results">
            <h3 className="toa-section-title">Results</h3>
            <div className="toa-results-grid">
              <div className="toa-result-card toa-result-primary" title="Total time the radio transmits one packet, including preamble and payload. This is the key metric for duty cycle and channel congestion planning">
                <span className="toa-result-value">{result.toaMs.toFixed(1)}</span>
                <span className="toa-result-label">Time on Air (ms)</span>
              </div>
              <div className="toa-result-card" title="Duration of one LoRa symbol. Determined by Spreading Factor and Bandwidth: T_sym = 2^SF / BW">
                <span className="toa-result-value">{result.symbolTimeMs.toFixed(3)}</span>
                <span className="toa-result-label">Symbol Time (ms)</span>
              </div>
              <div className="toa-result-card" title="Effective data throughput in bits per second, accounting for LoRa overhead (preamble, header, CRC, coding rate)">
                <span className="toa-result-value">
                  {result.dataRateBps >= 1000
                    ? `${(result.dataRateBps / 1000).toFixed(1)}k`
                    : result.dataRateBps.toFixed(0)}
                </span>
                <span className="toa-result-label">Data Rate (bps)</span>
              </div>
              <div className="toa-result-card" title="Maximum packets per hour if transmitting continuously (100% duty cycle). US ISM band allows 100% duty cycle for frequency hopping systems">
                <span className="toa-result-value">{result.maxPacketsPerHour100.toLocaleString()}</span>
                <span className="toa-result-label">Max pkts/hr (100%)</span>
              </div>
              <div className="toa-result-card toa-result-highlight" title="Maximum packets per hour at 10% duty cycle, as required by EU regulations (ETSI EN 300 220) for the 868 MHz ISM band">
                <span className="toa-result-value">{result.maxPacketsPerHour10.toLocaleString()}</span>
                <span className="toa-result-label">Pkts/hr (10% EU duty)</span>
              </div>
              {result.mahPerPacket != null && (
                <div className="toa-result-card" title={`Estimated battery consumption per packet based on ${currentDeviceName || 'device'} TX current draw (${txCurrentMa} mA) and the computed time on air`}>
                  <span className="toa-result-value">{result.mahPerPacket.toFixed(4)}</span>
                  <span className="toa-result-label">
                    mAh/packet
                    {currentDeviceName && <span className="toa-device-note"> ({currentDeviceName})</span>}
                  </span>
                </div>
              )}
            </div>
            <p className="toa-detail-line">
              Preamble: {result.preambleTimeMs.toFixed(1)} ms | Payload: {result.payloadSymbols} symbols, {result.payloadTimeMs.toFixed(1)} ms
            </p>
          </div>

          {/* Comparison Table */}
          <div className="toa-comparison">
            <h3 className="toa-section-title">Preset Comparison ({payloadBytes}-byte payload)</h3>
            <div className="toa-table-wrap">
              <table className="toa-table">
                <thead>
                  <tr>
                    <th title="Modem preset name — click any row to select that preset">Preset</th>
                    <th title="Spreading Factor — higher values increase range but reduce speed">SF</th>
                    <th title="Bandwidth in kHz — lower values increase range but reduce speed">BW (kHz)</th>
                    <th title="Forward Error Correction coding rate">CR</th>
                    <th title="Time on Air in milliseconds for the current payload size">ToA (ms)</th>
                    <th title="Effective data rate in bits per second">Data Rate</th>
                    <th title="Maximum messages per hour at 10% EU duty cycle limit">Msgs/hr (10%)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const isActive = row.sf === sf && row.bw === bwKhz && row.cr === crStr;
                    return (
                      <tr
                        key={row.key}
                        className={isActive ? 'toa-row-active' : ''}
                        onClick={() => handlePresetChange(row.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePresetChange(row.key); } }}
                        tabIndex={0}
                        role="button"
                        style={{ cursor: 'pointer' }}
                        title={`Click to select ${row.name} — SF${row.sf}, BW${row.bw} kHz, CR ${row.cr}`}
                        aria-pressed={isActive}
                      >
                        <td className="toa-preset-name">{row.name}</td>
                        <td>{row.sf}</td>
                        <td>{row.bw}</td>
                        <td>{row.cr}</td>
                        <td className={row.toaMs > 1000 ? 'value-warn' : ''}>
                          {row.toaMs.toFixed(1)}
                        </td>
                        <td>
                          {row.dataRateBps >= 1000
                            ? `${(row.dataRateBps / 1000).toFixed(1)}k bps`
                            : `${row.dataRateBps.toFixed(0)} bps`}
                        </td>
                        <td>{row.maxMsgsHr.toLocaleString()}</td>
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
