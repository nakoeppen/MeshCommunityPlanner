/**
 * LinkReportModal Component
 * Displays all LOS link analysis data in a sortable table.
 * Reads link data from the losOverlays in mapStore (no backend calls needed).
 */

import { useEffect, useCallback } from 'react';
import { useMapStore } from '../../stores/mapStore';
import type { LOSOverlay } from '../../stores/mapStore';
import { useDraggable } from '../../hooks/useDraggable';
import './LinkReportModal.css';

interface LinkReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportPDF?: () => void;
}

/** Sort priority: non-viable (0) → NLOS (1) → marginal (2) → strong (3) */
function sortPriority(overlay: LOSOverlay): number {
  if (!overlay.isViable) return 0;
  if (!overlay.hasLos) return 1;
  if (overlay.linkQuality === 'marginal') return 2;
  return 3;
}

function qualityLabel(overlay: LOSOverlay): { label: string; className: string } {
  if (!overlay.isViable) return { label: 'Not Viable', className: 'quality-nonviable' };
  if (!overlay.hasLos) return { label: 'NLOS', className: 'quality-nlos' };
  if (overlay.linkQuality === 'marginal') return { label: 'Marginal', className: 'quality-marginal' };
  return { label: 'Strong', className: 'quality-strong' };
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function marginClass(db: number): string {
  if (db >= 10) return 'value-good';
  if (db >= 3) return 'value-warn';
  return 'value-bad';
}

function fresnelClass(pct: number): string {
  if (pct >= 60) return 'value-good';
  if (pct >= 20) return 'value-warn';
  return 'value-bad';
}

function elevationLabel(source: string): string {
  if (source === 'srtm_30m') return 'SRTM 30m';
  if (source === 'srtm_partial') return 'SRTM (partial)';
  if (source === 'srtm_no_data') return 'No SRTM data';
  if (source === 'flat_terrain') return 'Flat (no data)';
  return source;
}

export function LinkReportModal({ isOpen, onClose, onExportPDF }: LinkReportModalProps) {
  const losOverlays = useMapStore((s) => s.los_overlays);
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  useEffect(() => { if (isOpen) resetDrag(); }, [isOpen, resetDrag]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus trap: constrain Tab to modal elements
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

  const sorted = [...losOverlays].sort((a, b) => sortPriority(a) - sortPriority(b));
  const viable = losOverlays.filter((o) => o.isViable).length;
  const obstructed = losOverlays.filter((o) => !o.hasLos).length;

  return (
    <div className="link-report-overlay" role="dialog" aria-modal="true" aria-label="Link Report">
      <div className="link-report-modal" ref={modalRef} style={dragStyle}>
        <div className="link-report-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="link-report-title">Link Report</h2>
            <p className="link-report-summary">
              {losOverlays.length} link{losOverlays.length !== 1 ? 's' : ''}, {viable} viable, {obstructed} obstructed
            </p>
            <span className="link-report-drag-hint">Drag to move</span>
          </div>
          <div className="link-report-actions">
            {onExportPDF && (
              <button className="link-report-export-btn" type="button" onClick={onExportPDF} title="Export full network report as PDF">
                Export PDF
              </button>
            )}
            <button className="link-report-close" type="button" onClick={onClose} title="Close">&times;</button>
          </div>
        </div>
        <div className="link-report-body">
          {sorted.length === 0 ? (
            <p className="link-report-empty">No LOS links to display. Run Line of Sight analysis first.</p>
          ) : (
            <table className="link-report-table">
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Quality</th>
                  <th>Distance</th>
                  <th>Margin</th>
                  <th>Rx Signal</th>
                  <th>Fresnel</th>
                  <th>Obstruction</th>
                  <th>Path Loss</th>
                  <th>Terrain</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((ov) => {
                  const q = qualityLabel(ov);
                  return (
                    <tr key={ov.id}>
                      <td className="link-names">
                        <strong>{ov.nodeAName}</strong> ↔ <strong>{ov.nodeBName}</strong>
                      </td>
                      <td>
                        <span className={`quality-dot ${q.className}`} />
                        <span className={q.className}>{q.label}</span>
                      </td>
                      <td>{formatDistance(ov.distanceM)}</td>
                      <td className={marginClass(ov.linkMarginDb)}>
                        {ov.linkMarginDb >= 0 ? '+' : ''}{ov.linkMarginDb.toFixed(1)} dB
                      </td>
                      <td>{ov.receivedSignalDbm.toFixed(1)} dBm</td>
                      <td className={fresnelClass(ov.fresnelClearancePct)}>
                        {ov.fresnelClearancePct.toFixed(0)}%
                      </td>
                      <td>
                        {!ov.hasLos && ov.maxObstructionM > 0
                          ? `${ov.maxObstructionM.toFixed(1)}m`
                          : '--'}
                      </td>
                      <td>
                        {ov.totalPathLossDb.toFixed(1)} dB
                        <span className="path-loss-fspl"> (FSPL: {ov.freeSpaceLossDb.toFixed(1)})</span>
                      </td>
                      <td>{elevationLabel(ov.elevationSource)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
