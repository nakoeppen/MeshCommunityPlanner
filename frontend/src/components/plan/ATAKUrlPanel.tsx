import { useEffect, useState } from 'react';

interface ATAKUrlPanelProps {
  planId?: number | string;
}

const inputStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '3px 6px',
  background: '#0d1b2a',
  color: '#7fb3f0',
  border: '1px solid #2c3e50',
  borderRadius: 4,
};

export function ATAKUrlPanel({ planId }: ATAKUrlPanelProps) {
  const [detectedBase, setDetectedBase] = useState('');
  const [ipOverride, setIpOverride] = useState('');
  const [filterPlan, setFilterPlan] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = (window as any).__MESH_PLANNER_AUTH__ || '';
    fetch('/api/atak/local-url', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setDetectedBase(d.url))
      .catch(() => setDetectedBase(''));
  }, []);

  // Build the final URL: override IP if the user typed one, else use detected
  const resolvedBase = (() => {
    if (!ipOverride.trim()) return detectedBase;
    // Replace just the host portion (keep port and path)
    try {
      const parsed = new URL(detectedBase || 'http://localhost:8000/api/atak/nodes.kml');
      parsed.hostname = ipOverride.trim();
      return parsed.toString();
    } catch {
      return `http://${ipOverride.trim()}:8000/api/atak/nodes.kml`;
    }
  })();

  const finalUrl = filterPlan && planId ? `${resolvedBase}?plan_id=${planId}` : resolvedBase;

  const copy = () => {
    if (!finalUrl) return;
    navigator.clipboard.writeText(finalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {/* Detected URL — read-only display */}
      <input
        type="text"
        readOnly
        value={finalUrl || 'Detecting local IP...'}
        aria-label="ATAK KML network link URL"
        style={inputStyle}
      />

      {/* IP override */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <label style={{ fontSize: '0.65rem', color: '#7f8c8d', flexShrink: 0 }}>
          Override IP:
        </label>
        <input
          type="text"
          value={ipOverride}
          onChange={(e) => setIpOverride(e.target.value)}
          placeholder={detectedBase ? new URL(detectedBase).hostname : '192.168.x.x'}
          aria-label="Override server IP address for ATAK clients on a different subnet"
          style={{ ...inputStyle, flex: 1, color: ipOverride ? '#ecf0f1' : '#7f8c8d' }}
        />
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button
          type="button"
          style={{
            fontSize: '0.72rem',
            padding: '3px 12px',
            background: '#2c4a6a',
            color: '#ecf0f1',
            border: '1px solid #3d6a96',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            minHeight: 0,
            minWidth: 0,
          }}
          onClick={copy}
          disabled={!finalUrl}
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        {planId && (
          <label style={{ fontSize: '0.7rem', color: '#bdc3c7', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterPlan}
              onChange={(e) => setFilterPlan(e.target.checked)}
            />
            This plan only
          </label>
        )}
      </div>
    </div>
  );
}
