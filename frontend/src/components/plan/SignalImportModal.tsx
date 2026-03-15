/**
 * SignalImportModal
 * Two-phase modal for importing RSSI/SNR signal observations from CSV.
 *
 * Phase 1: File upload + column preview + parse summary
 * Phase 2: Link table with match status against plan nodes, then import as overlay
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapStore } from '../../stores/mapStore';
import './SignalImportModal.css';

/** Read the injected auth token (set by the backend at startup). */
function getAuthToken(): string | null {
  return (window as Window & { __MESH_PLANNER_AUTH__?: string }).__MESH_PLANNER_AUTH__ || null;
}

// ============================================================================
// Types
// ============================================================================

interface PlanNode {
  id: string;
  name: string;
}

interface ParsedRow {
  node_a: string;
  node_b: string;
  rssi_dbm: number;
  snr_db: number | null;
  timestamp: string | null;
}

interface ParseResult {
  rows: ParsedRow[];
  total_parsed: number;
  skipped: number;
  skip_reasons: string[];
  columns_detected: {
    node_a: string | null;
    node_b: string | null;
    rssi: string | null;
    snr: string | null;
    timestamp: string | null;
  };
  truncated_note?: string;
}

interface MatchedRow {
  parsed: ParsedRow;
  nodeAMatch: PlanNode | null;
  nodeBMatch: PlanNode | null;
}

/** Signal overlay observation stored in the map store. */
export interface SignalObservation {
  nodeAUuid: string;
  nodeBUuid: string;
  nodeAName: string;
  nodeBName: string;
  rssi_dbm: number;
  snr_db: number | null;
  timestamp: string | null;
}

export interface SignalOverlay {
  id: string;
  observations: SignalObservation[];
}

export interface SignalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  planNodes: Array<{ id: string; name: string }>;
}

type Phase = 'upload' | 'table';

// ============================================================================
// Helpers
// ============================================================================

/** Try to match a raw node string against plan nodes (case-insensitive substring). */
function matchNode(raw: string, planNodes: PlanNode[]): PlanNode | null {
  if (!raw) return null;
  const q = raw.trim().toLowerCase();
  // Exact match first
  const exact = planNodes.find((n) => n.name.toLowerCase() === q);
  if (exact) return exact;
  // Substring match
  return planNodes.find((n) => n.name.toLowerCase().includes(q) || q.includes(n.name.toLowerCase())) || null;
}

function rssiColor(rssi: number): string {
  if (rssi > -85) return '#2ecc71';
  if (rssi >= -100) return '#f1c40f';
  return '#e74c3c';
}

function snrColor(snr: number): string {
  if (snr > 0) return '#2ecc71';
  if (snr >= -5) return '#f1c40f';
  return '#e74c3c';
}

// ============================================================================
// Component
// ============================================================================

export function SignalImportModal({ isOpen, onClose, planNodes }: SignalImportModalProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const setSignalOverlays = useMapStore((s) => s.setSignalOverlays);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setPhase('upload');
      setLoading(false);
      setParseError(null);
      setParseResult(null);
      setMatchedRows([]);
      setImportStatus(null);
      setShowSkipReasons(false);
    }
  }, [isOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ---- Parse CSV file ----

  const parseFile = useCallback(async (file: File) => {
    setLoading(true);
    setParseError(null);
    setParseResult(null);

    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/signal-import/parse', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const result: ParseResult = await res.json();
      setParseResult(result);

      // Pre-compute node matches
      const matched: MatchedRow[] = result.rows.map((row) => ({
        parsed: row,
        nodeAMatch: matchNode(row.node_a, planNodes),
        nodeBMatch: matchNode(row.node_b, planNodes),
      }));
      setMatchedRows(matched);
      setPhase('table');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
      setParseError(msg);
    } finally {
      setLoading(false);
    }
  }, [planNodes]);

  // ---- File selection ----

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  // ---- Import as overlay ----

  const handleImport = useCallback(() => {
    const matched = matchedRows.filter((r) => r.nodeAMatch && r.nodeBMatch);
    if (matched.length === 0) return;

    const observations: SignalObservation[] = matched.map((r) => ({
      nodeAUuid: r.nodeAMatch!.id,
      nodeBUuid: r.nodeBMatch!.id,
      nodeAName: r.nodeAMatch!.name,
      nodeBName: r.nodeBMatch!.name,
      rssi_dbm: r.parsed.rssi_dbm,
      snr_db: r.parsed.snr_db,
      timestamp: r.parsed.timestamp,
    }));

    const overlay: SignalOverlay = {
      id: `signal-${Date.now()}`,
      observations,
    };

    setSignalOverlays([overlay]);
    setImportStatus(`Imported ${matched.length} signal observation${matched.length !== 1 ? 's' : ''}. View in Signal Overlay.`);

    setTimeout(() => onClose(), 1800);
  }, [matchedRows, setSignalOverlays, onClose]);

  if (!isOpen) return null;

  const matchedCount = matchedRows.filter((r) => r.nodeAMatch && r.nodeBMatch).length;

  return (
    <div className="sim-overlay" role="dialog" aria-modal="true" aria-label="Import Signal Data">
      <div className="sim-modal">
        {/* Header */}
        <div className="sim-header">
          <div>
            <h2 className="sim-title">Import Signal Data (CSV)</h2>
            <p className="sim-subtitle">
              Compare modeled link budget predictions against real-world RSSI/SNR observations
            </p>
          </div>
          <button className="sim-close" type="button" onClick={onClose} title="Close" aria-label="Close dialog">&times;</button>
        </div>

        {/* Phase progress indicator */}
        <div className="sim-progress" aria-label="Progress">
          <span className={`sim-step${phase === 'upload' ? ' sim-step--active' : ' sim-step--done'}`}>
            1. Upload
          </span>
          <span className="sim-progress-sep" aria-hidden="true">&rsaquo;</span>
          <span className={`sim-step${phase === 'table' ? ' sim-step--active' : ''}`}>
            2. Review &amp; Import
          </span>
        </div>

        {/* Body */}
        <div className="sim-body">
          {phase === 'upload' && (
            <PhaseUpload
              loading={loading}
              error={parseError}
              fileInputRef={fileInputRef}
              dropZoneRef={dropZoneRef}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          )}
          {phase === 'table' && parseResult && (
            <PhaseTable
              parseResult={parseResult}
              matchedRows={matchedRows}
              matchedCount={matchedCount}
              importStatus={importStatus}
              showSkipReasons={showSkipReasons}
              onToggleSkipReasons={() => setShowSkipReasons(!showSkipReasons)}
              onImport={handleImport}
              onBack={() => setPhase('upload')}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase 1: Upload
// ============================================================================

interface PhaseUploadProps {
  loading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
}

function PhaseUpload({ loading, error, fileInputRef, dropZoneRef, onFileChange, onDrop, onDragOver }: PhaseUploadProps) {
  return (
    <div className="sim-phase-upload">
      <p className="sim-section-label">CSV export from Meshtastic, MeshCore, or any compatible app</p>

      <div
        ref={dropZoneRef}
        className={`sim-dropzone${loading ? ' sim-dropzone--loading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
        aria-label="Drop a CSV file here or click to choose"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        {loading ? (
          <><span className="sim-spinner" aria-hidden="true" /> Parsing&hellip;</>
        ) : (
          <>
            <span className="sim-dropzone-icon" aria-hidden="true">&#128190;</span>
            <span className="sim-dropzone-text">Drop CSV file here or <span className="sim-dropzone-link">choose file</span></span>
            <span className="sim-dropzone-hint">Supports Meshtastic, MeshCore, and generic RSSI/SNR exports</span>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sim-file-input"
        onChange={onFileChange}
        aria-label="Choose CSV file"
        tabIndex={-1}
      />

      {error && (
        <div className="sim-error" role="alert">
          <strong>Parse failed:</strong> {error}
        </div>
      )}

      <div className="sim-upload-formats">
        <p className="sim-section-label" style={{ marginBottom: '0.4rem' }}>Accepted formats</p>
        <div className="sim-format-grid">
          <div className="sim-format-card">
            <span className="sim-format-name">Meshtastic</span>
            <code className="sim-format-headers">from, to, snr, rssi, timestamp</code>
          </div>
          <div className="sim-format-card">
            <span className="sim-format-name">Generic</span>
            <code className="sim-format-headers">node_a, node_b, rssi_dbm, snr_db</code>
          </div>
          <div className="sim-format-card">
            <span className="sim-format-name">Minimal</span>
            <code className="sim-format-headers">from_node, to_node, rssi</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase 2: Table
// ============================================================================

interface PhaseTableProps {
  parseResult: ParseResult;
  matchedRows: MatchedRow[];
  matchedCount: number;
  importStatus: string | null;
  showSkipReasons: boolean;
  onToggleSkipReasons: () => void;
  onImport: () => void;
  onBack: () => void;
  onClose: () => void;
}

function PhaseTable({
  parseResult,
  matchedRows,
  matchedCount,
  importStatus,
  showSkipReasons,
  onToggleSkipReasons,
  onImport,
  onBack,
  onClose,
}: PhaseTableProps) {
  const hasMatched = matchedCount > 0;
  const total = matchedRows.length;

  return (
    <div className="sim-phase-table">
      {/* Parse summary */}
      <div className="sim-parse-summary">
        <span className="sim-count-badge">
          {parseResult.total_parsed} row{parseResult.total_parsed !== 1 ? 's' : ''} parsed
        </span>
        {parseResult.skipped > 0 && (
          <span className="sim-count-badge sim-count-badge--warn">
            {parseResult.skipped} skipped
          </span>
        )}
        {parseResult.truncated_note && (
          <span className="sim-count-badge sim-count-badge--warn">Truncated to 500</span>
        )}
        {parseResult.skipped > 0 && parseResult.skip_reasons.length > 0 && (
          <button
            type="button"
            className="sim-btn-link"
            onClick={onToggleSkipReasons}
            aria-expanded={showSkipReasons}
          >
            {showSkipReasons ? 'Hide reasons' : 'Show reasons'}
          </button>
        )}
      </div>

      {showSkipReasons && parseResult.skip_reasons.length > 0 && (
        <details open className="sim-skip-reasons">
          <summary className="sim-skip-reasons-title">Skip reasons ({parseResult.skip_reasons.length})</summary>
          <ul className="sim-skip-list">
            {parseResult.skip_reasons.map((r, i) => (
              <li key={i} className="sim-skip-item">{r}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Match summary */}
      <div className="sim-match-summary" role="status" aria-live="polite">
        <span className={`sim-match-badge${hasMatched ? ' sim-match-badge--ok' : ' sim-match-badge--none'}`}>
          {matchedCount} of {total} link{total !== 1 ? 's' : ''} matched to plan nodes
        </span>
      </div>

      {/* Table */}
      <div className="sim-table-wrap">
        <table className="sim-table">
          <thead>
            <tr>
              <th>Node A (raw)</th>
              <th>Plan Match A</th>
              <th>Node B (raw)</th>
              <th>Plan Match B</th>
              <th>RSSI (dBm)</th>
              <th>SNR (dB)</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {matchedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="sim-empty">No data rows to display.</td>
              </tr>
            )}
            {matchedRows.map((mr, i) => (
              <tr key={i} className={mr.nodeAMatch && mr.nodeBMatch ? 'sim-row-matched' : ''}>
                <td className="sim-cell-raw">{mr.parsed.node_a}</td>
                <td>
                  {mr.nodeAMatch
                    ? <span className="sim-match-ok">{mr.nodeAMatch.name}</span>
                    : <span className="sim-match-none">No match</span>
                  }
                </td>
                <td className="sim-cell-raw">{mr.parsed.node_b}</td>
                <td>
                  {mr.nodeBMatch
                    ? <span className="sim-match-ok">{mr.nodeBMatch.name}</span>
                    : <span className="sim-match-none">No match</span>
                  }
                </td>
                <td>
                  <span className="sim-signal-value" style={{ color: rssiColor(mr.parsed.rssi_dbm) }}>
                    {mr.parsed.rssi_dbm.toFixed(1)}
                  </span>
                </td>
                <td>
                  {mr.parsed.snr_db !== null
                    ? <span className="sim-signal-value" style={{ color: snrColor(mr.parsed.snr_db) }}>{mr.parsed.snr_db.toFixed(1)}</span>
                    : <span className="sim-na">—</span>
                  }
                </td>
                <td className="sim-cell-ts">
                  {mr.parsed.timestamp
                    ? <span title={mr.parsed.timestamp}>{mr.parsed.timestamp.substring(0, 16).replace('T', ' ')}</span>
                    : <span className="sim-na">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importStatus && (
        <div className="sim-import-result sim-import-result--ok" role="status">
          {importStatus}
        </div>
      )}

      {/* Action buttons */}
      <div className="sim-actions sim-actions--split">
        <button
          className="sim-btn sim-btn--ghost"
          type="button"
          onClick={onBack}
          disabled={!!importStatus}
        >
          &larr; Back
        </button>
        <div className="sim-actions-right">
          <button
            className="sim-btn sim-btn--ghost"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="sim-btn sim-btn--primary"
            type="button"
            onClick={onImport}
            disabled={!hasMatched || !!importStatus}
            title={!hasMatched ? 'No rows matched to plan nodes' : `Import ${matchedCount} matched observation${matchedCount !== 1 ? 's' : ''} as overlay`}
          >
            Import as Overlay ({matchedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
