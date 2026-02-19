import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Desktop app: notify backend when browser tab closes so the server can exit
window.addEventListener('beforeunload', () => {
  const token = (window as any).__MESH_PLANNER_AUTH__;
  if (token) {
    fetch('/api/shutdown', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      keepalive: true, // ensures request completes even as page unloads
    }).catch(() => {}); // ignore errors during shutdown
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
