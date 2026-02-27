import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Expose build ID on window so Playwright tests can read it
declare const __BUILD_ID__: string;
(window as any).__BUILD_ID__ = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// Desktop app: warn before closing and shut down the backend when the tab closes.
// Only activates in production (auth token present) so Playwright tests pass.
//
// beforeunload: shows browser's native "Leave site?" dialog as a safety net.
// Does NOT send shutdown here — the user might click Cancel.
//
// pagehide: fires reliably on all browsers (including Safari) when the page
// actually unloads. Uses sendBeacon for guaranteed delivery during page teardown.
// This is where we send the shutdown request to kill the backend.
window.addEventListener('beforeunload', (e) => {
  if ((window as any).__exitConfirmed) return;

  const token = (window as any).__MESH_PLANNER_AUTH__;
  if (token) {
    e.preventDefault();
  }
});

window.addEventListener('pagehide', () => {
  const token = (window as any).__MESH_PLANNER_AUTH__;
  if (!token) return;

  // sendBeacon is the most reliable way to send data during page teardown.
  // It works on Safari, Chrome, and Firefox even when the tab is closing.
  const url = '/api/shutdown';
  const blob = new Blob(['{}'], { type: 'application/json' });
  const sent = navigator.sendBeacon(url, blob);

  // Fallback: if sendBeacon fails, try fetch with keepalive
  if (!sent) {
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      keepalive: true,
    }).catch(() => {});
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
