/**
 * RNSTransportModal Component
 * Transport Node Placement Advisor for Reticulum (RNS) networks.
 * Calculates minimum transport node count, announce budget consumption, SPOF detection, and convergence warnings.
 * Pure frontend math — no API calls needed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { NumberInput } from '../common/NumberInput';
import './RNSTransportModal.css';

/* ---- Types ---- */

export interface RNSTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type InterfaceConfig = 'lora' | 'lora-wifi' | 'lora-tcp' | 'lora-wifi-tcp';
type InterfaceMode = 'access_point' | 'gateway' | 'boundary' | 'full';

const INTERFACE_MODE_DESCRIPTIONS: Record<InterfaceMode, string> = {
  access_point: 'Leaf zone — clients connect here, no forwarding between zones. Lowest announce overhead.',
  gateway: 'Cross-zone bridge — forwards between LoRa and other interfaces. Recommended for most deployments.',
  boundary: 'LoRa-to-TCP handoff — reduces LoRa announce propagation. Use at the edge of a LoRa cluster.',
  full: 'Full propagation — highest announce overhead. Use sparingly; only for critical backbone nodes.',
};

/* ---- Component ---- */

export function RNSTransportModal({ isOpen, onClose }: RNSTransportModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  // Inputs
  const [coverageZones, setCoverageZones] = useState(2);
  const [dataRateBps, setDataRateBps] = useState(1172);
  const [announceRateSec, setAnnounceRateSec] = useState(900);
  const [activeDestinations, setActiveDestinations] = useState(10);
  const [interfaceConfig, setInterfaceConfig] = useState<InterfaceConfig>('lora-wifi');
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>('gateway');

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCoverageZones(2);
      setDataRateBps(1172);
      setAnnounceRateSec(900);
      setActiveDestinations(10);
      setInterfaceConfig('lora-wifi');
      setInterfaceMode('gateway');
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

  // Derived results
  const results = useMemo(() => {
    // RNS reserves 2% of interface capacity for announces
    const announceBudgetBps = dataRateBps * 0.02;

    // Each announce packet = 167 bytes = 1336 bits
    const announcePacketBits = 167 * 8;
    const announcesPerSecond = activeDestinations / announceRateSec;
    const announceTrafficBps = announcesPerSecond * announcePacketBits;

    const budgetPctConsumed = (announceTrafficBps / announceBudgetBps) * 100;
    const budgetPctDisplay = Math.min(budgetPctConsumed, 999);

    // Minimum transport nodes: one per zone, scaled if announce budget overloaded
    const minTransportNodes = Math.max(
      coverageZones,
      Math.ceil(coverageZones * (budgetPctConsumed > 80 ? 1.5 : 1)),
    );

    // Redundant: at least 2 per zone
    const redundantTransportNodes = coverageZones * 2;

    const hasSpof = minTransportNodes < 2;
    const convergenceWarning = minTransportNodes > 10;

    let budgetColor: 'green' | 'yellow' | 'red';
    if (budgetPctConsumed < 50) budgetColor = 'green';
    else if (budgetPctConsumed < 80) budgetColor = 'yellow';
    else budgetColor = 'red';

    return {
      announceBudgetBps,
      announceTrafficBps,
      budgetPctDisplay,
      budgetPctConsumed,
      minTransportNodes,
      redundantTransportNodes,
      hasSpof,
      convergenceWarning,
      budgetColor,
    };
  }, [dataRateBps, announceRateSec, activeDestinations, coverageZones]);

  if (!isOpen) return null;

  const budgetColorClass =
    results.budgetColor === 'green'
      ? 'rnt-value-green'
      : results.budgetColor === 'yellow'
      ? 'rnt-value-yellow'
      : 'rnt-value-red';

  return (
    <div className="rnt-overlay" role="dialog" aria-modal="true" aria-label="Transport Node Placement Advisor">
      <div className="rnt-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="rnt-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="rnt-title">Transport Node Placement Advisor
              <span className="rnt-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="rnt-summary">
              Minimum transport nodes, announce budget consumption, interface mode guidance, and SPOF detection
            </p>
          </div>
          <button className="rnt-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="rnt-body">
          {/* Inputs */}
          <div className="rnt-inputs">

            <div className="rnt-inputs-row">
              <div className="rnt-field">
                <label htmlFor="rnt-coverage-zones">Coverage zones</label>
                <NumberInput
                  id="rnt-coverage-zones"
                  min={1}
                  max={50}
                  value={coverageZones}
                  onChange={(v) => setCoverageZones(Math.round(v))}
                  title="Distinct areas separated by terrain or distance requiring separate transport nodes. (1–50)"
                />
              </div>
              <div className="rnt-field" />
            </div>

            <div className="rnt-inputs-row">
              <div className="rnt-field">
                <label htmlFor="rnt-data-rate">LoRa data rate (bps)</label>
                <NumberInput
                  id="rnt-data-rate"
                  min={5}
                  max={250000}
                  value={dataRateBps}
                  onChange={(v) => setDataRateBps(Math.round(v))}
                  title="Effective LoRa interface data rate in bps. Use the RNode Link Budget tool to calculate. (5–250,000 bps)"
                />
              </div>
              <div className="rnt-field">
                <label htmlFor="rnt-announce-rate">Announce rate per destination (seconds)</label>
                <NumberInput
                  id="rnt-announce-rate"
                  min={60}
                  max={86400}
                  value={announceRateSec}
                  onChange={(v) => setAnnounceRateSec(Math.round(v))}
                  title="How often each destination announces itself, in seconds. Use the Announce Rate Calculator for guidance. (60–86,400 s)"
                />
              </div>
            </div>

            <div className="rnt-inputs-row">
              <div className="rnt-field">
                <label htmlFor="rnt-active-dest">Active destinations in network</label>
                <NumberInput
                  id="rnt-active-dest"
                  min={1}
                  max={10000}
                  value={activeDestinations}
                  onChange={(v) => setActiveDestinations(Math.round(v))}
                  title="Number of destinations actively sending announces across the network. (1–10,000)"
                />
              </div>
              <div className="rnt-field">
                <label htmlFor="rnt-interface-config">Transport node interfaces</label>
                <select
                  id="rnt-interface-config"
                  value={interfaceConfig}
                  onChange={(e) => setInterfaceConfig(e.target.value as InterfaceConfig)}
                  title="Interface combination equipped on each transport node."
                >
                  <option value="lora">LoRa only</option>
                  <option value="lora-wifi">LoRa + WiFi</option>
                  <option value="lora-tcp">LoRa + TCP/IP</option>
                  <option value="lora-wifi-tcp">LoRa + WiFi + TCP/IP</option>
                </select>
              </div>
            </div>

            <div className="rnt-inputs-row">
              <div className="rnt-field">
                <label htmlFor="rnt-interface-mode">Interface mode</label>
                <select
                  id="rnt-interface-mode"
                  value={interfaceMode}
                  onChange={(e) => setInterfaceMode(e.target.value as InterfaceMode)}
                  title="RNS interface propagation mode. Determines how announces are forwarded between interfaces."
                >
                  <option value="access_point">access_point</option>
                  <option value="gateway">gateway</option>
                  <option value="boundary">boundary</option>
                  <option value="full">full</option>
                </select>
              </div>
              <div className="rnt-field" />
            </div>
          </div>

          {/* Results */}
          <div className="rnt-results">
            <h3 className="rnt-section-title">Results</h3>

            <div className="rnt-results-grid">
              <div className="rnt-result-item">
                <span className="rnt-result-label">Announce traffic</span>
                <span className={`rnt-result-value ${budgetColorClass}`}>
                  {results.announceTrafficBps < 1
                    ? results.announceTrafficBps.toFixed(3)
                    : results.announceTrafficBps.toFixed(2)}{' '}
                  bps
                </span>
              </div>

              <div className="rnt-result-item">
                <span className="rnt-result-label">% of 2% announce budget</span>
                <span className={`rnt-result-value ${budgetColorClass}`}>
                  {results.budgetPctDisplay.toFixed(1)}%
                  {results.budgetPctConsumed > 80 && (
                    <span className="rnt-over-budget"> — OVER BUDGET</span>
                  )}
                </span>
              </div>

              <div className="rnt-result-item">
                <span className="rnt-result-label">Recommended min transport nodes</span>
                <span className="rnt-result-value">
                  {results.minTransportNodes}
                </span>
              </div>

              <div className="rnt-result-item">
                <span className="rnt-result-label">With redundancy (2× per zone)</span>
                <span className="rnt-result-value">
                  {results.redundantTransportNodes}
                </span>
              </div>

              <div className="rnt-result-item">
                <span className="rnt-result-label">Single point of failure risk</span>
                <span className={`rnt-result-value ${results.hasSpof ? 'rnt-value-red' : 'rnt-value-green'}`}>
                  {results.hasSpof
                    ? '⚠ Yes (need ≥2 transport nodes)'
                    : '✓ None'}
                </span>
              </div>

              <div className="rnt-result-item">
                <span className="rnt-result-label">Interface config</span>
                <span className="rnt-result-value rnt-value-dim">
                  {interfaceConfig === 'lora' && 'LoRa only'}
                  {interfaceConfig === 'lora-wifi' && 'LoRa + WiFi'}
                  {interfaceConfig === 'lora-tcp' && 'LoRa + TCP/IP'}
                  {interfaceConfig === 'lora-wifi-tcp' && 'LoRa + WiFi + TCP/IP'}
                </span>
              </div>
            </div>

            {/* Interface mode explanation */}
            <div className="rnt-mode-card">
              <span className="rnt-mode-label">Interface mode: <strong>{interfaceMode}</strong></span>
              <p className="rnt-mode-desc">{INTERFACE_MODE_DESCRIPTIONS[interfaceMode]}</p>
            </div>

            {/* Convergence warning */}
            {results.convergenceWarning && (
              <div className="rnt-note rnt-note-warn">
                Large transport node count may slow network convergence (~1 min). Consider consolidating zones or using boundary mode to reduce announce propagation.
              </div>
            )}
          </div>

          {/* Announce budget note */}
          <div className="rnt-note rnt-note-info">
            RNS reserves 2% of interface bandwidth for announces by default. Exceeding this causes announce rate limiting.
          </div>
        </div>
      </div>
    </div>
  );
}
