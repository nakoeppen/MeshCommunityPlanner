/**
 * MainContent Component
 * Main content area with map and side panels
 */

import { MapContainer } from '../map/MapContainer';
import './MainContent.css';

export function MainContent() {
  return (
    <main className="main-content" role="main">
      <div className="content-wrapper">
        <MapContainer />
      </div>
    </main>
  );
}
