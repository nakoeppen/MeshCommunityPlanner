import { useEffect, useState } from 'react';

interface ATAKUrlPanelProps {
  planId?: number | string;
}

export function ATAKUrlPanel({ planId }: ATAKUrlPanelProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [filterPlan, setFilterPlan] = useState(false);

  useEffect(() => {
    const token = (window as any).__MESH_PLANNER_AUTH__ || '';
    fetch('/api/atak/local-url', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setBaseUrl(d.url))
      .catch(() => setBaseUrl('unavailable'));
  }, []);

  const url = filterPlan && planId ? `${baseUrl}?plan_id=${planId}` : baseUrl;

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <input
        type="text"
        readOnly
        value={url || 'Detecting local IP...'}
        aria-label="ATAK KML network link URL"
        style={{
          fontSize: '0.7rem',
          padding: '3px 6px',
          background: '#0d1b2a',
          color: '#7fb3f0',
          border: '1px solid #2c3e50',
          borderRadius: 4,
        }}
      />
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button
          type="button"
          className="sidebar-btn sidebar-btn-secondary"
          style={{ flex: 1, fontSize: '0.75rem', padding: '3px 0' }}
          onClick={copy}
          disabled={!url}
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
        {planId && (
          <label
            style={{
              fontSize: '0.7rem',
              color: '#bdc3c7',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
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
