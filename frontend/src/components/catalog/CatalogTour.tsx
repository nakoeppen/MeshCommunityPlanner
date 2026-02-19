/**
 * CatalogTour — Onboarding Wizard for the Hardware Catalog Manager
 * Dark-themed 5-step tour explaining catalog CRUD, import/export, and usage.
 * Shows automatically on first catalog open; user can dismiss permanently.
 * Reuses tour- CSS classes from WelcomeTour.css for consistent styling.
 */

import { useState, useEffect, useCallback } from 'react';
import '../onboarding/WelcomeTour.css';

export interface CatalogTourProps {
  onComplete?: () => void;
  /** When true, show regardless of localStorage (used with key prop for re-trigger). */
  forceShow?: boolean;
}

// Permanent dismiss key — stores the build ID when user opts out.
// When a new build is deployed, the stored build ID won't match and the tour re-appears.
const PERMANENT_KEY = 'meshPlannerCatalogTourPermanentDismiss';
// Session dismiss key — stores the auth token of the session that dismissed the tour
const SESSION_KEY = 'meshPlannerCatalogTourSession';

const TOTAL_STEPS = 5;

/** Get the current session's auth token (changes every app restart). */
function getSessionToken(): string {
  return (window as any).__MESH_PLANNER_AUTH__ || '';
}

/** Check if the tour was dismissed in the current session. */
function isDismissedThisSession(): boolean {
  return localStorage.getItem(SESSION_KEY) === getSessionToken();
}

/** Check if the user permanently opted out of the tour for this build. */
function isPermanentlyDismissed(): boolean {
  return localStorage.getItem(PERMANENT_KEY) === __BUILD_ID__;
}

interface TourStep {
  title: string;
  content: string;
  bullets?: string[];
  tip?: string;
  icon: JSX.Element;
}

/* ---------- SVG Illustrations per step ---------- */

const IconCatalog = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    <rect x="10" y="10" width="100" height="70" rx="5" stroke="#4472C4" strokeWidth="2" fill="rgba(68,114,196,0.08)" />
    {/* Tab bar */}
    <rect x="15" y="15" width="22" height="8" rx="2" fill="#2980b9" />
    <rect x="39" y="15" width="22" height="8" rx="2" fill="rgba(149,165,166,0.2)" />
    <rect x="63" y="15" width="22" height="8" rx="2" fill="rgba(149,165,166,0.2)" />
    {/* Table rows */}
    <rect x="15" y="28" width="90" height="1" fill="#34495e" />
    <rect x="15" y="33" width="30" height="4" rx="1" fill="#95a5a6" opacity="0.5" />
    <rect x="50" y="33" width="20" height="4" rx="1" fill="#95a5a6" opacity="0.4" />
    <rect x="75" y="33" width="15" height="4" rx="1" fill="#2ecc71" opacity="0.5" />
    <rect x="15" y="42" width="90" height="1" fill="#2c3e50" />
    <rect x="15" y="47" width="30" height="4" rx="1" fill="#95a5a6" opacity="0.5" />
    <rect x="50" y="47" width="20" height="4" rx="1" fill="#95a5a6" opacity="0.4" />
    <rect x="75" y="47" width="15" height="4" rx="1" fill="#2ecc71" opacity="0.5" />
    <rect x="15" y="56" width="90" height="1" fill="#2c3e50" />
    <rect x="15" y="61" width="30" height="4" rx="1" fill="#7fb3f0" opacity="0.5" />
    <rect x="50" y="61" width="20" height="4" rx="1" fill="#7fb3f0" opacity="0.4" />
    <rect x="75" y="61" width="15" height="4" rx="1" fill="#e67e22" opacity="0.5" />
    <text x="60" y="8" textAnchor="middle" fill="#7fb3f0" fontSize="7" fontWeight="600">CATALOG</text>
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Table */}
    <rect x="10" y="20" width="100" height="55" rx="4" stroke="#34495e" strokeWidth="1.5" fill="rgba(37,52,67,0.3)" />
    {/* Row being edited - highlighted */}
    <rect x="12" y="38" width="96" height="14" rx="2" fill="rgba(41,128,185,0.15)" stroke="#2980b9" strokeWidth="1" strokeDasharray="3 2" />
    {/* Input field */}
    <rect x="18" y="41" width="40" height="8" rx="2" fill="#2c3e50" stroke="#4a6a8a" strokeWidth="1" />
    <text x="25" y="48" fill="#ecf0f1" fontSize="5">Editing...</text>
    {/* Save button */}
    <rect x="82" y="40" width="20" height="10" rx="3" fill="#2ecc71" opacity="0.8" />
    <text x="92" y="48" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="600">Save</text>
    {/* Lock icon for built-in */}
    <text x="16" y="32" fill="#7f8c8d" fontSize="8">&#128274;</text>
    <text x="34" y="32" fill="#95a5a6" fontSize="5">built-in (editable)</text>
    {/* Custom badge */}
    <rect x="14" y="57" width="22" height="7" rx="2" fill="#2980b9" opacity="0.8" />
    <text x="25" y="63" textAnchor="middle" fill="#fff" fontSize="4.5">custom</text>
    <text x="42" y="63" fill="#95a5a6" fontSize="5">editable + deletable</text>
  </svg>
);

const IconImportExport = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Export arrow (down) */}
    <rect x="10" y="15" width="40" height="50" rx="4" stroke="#27ae60" strokeWidth="1.5" fill="rgba(39,174,96,0.08)" />
    <text x="30" y="30" textAnchor="middle" fill="#27ae60" fontSize="7" fontWeight="700">CSV</text>
    <path d="M25 40 L35 40 L35 48 L40 48 L30 58 L20 48 L25 48 Z" fill="#27ae60" opacity="0.7" />
    <text x="30" y="68" textAnchor="middle" fill="#95a5a6" fontSize="5">Export</text>
    {/* Import arrow (up) */}
    <rect x="70" y="15" width="40" height="50" rx="4" stroke="#e67e22" strokeWidth="1.5" fill="rgba(230,126,34,0.08)" />
    <text x="90" y="30" textAnchor="middle" fill="#e67e22" fontSize="7" fontWeight="700">CSV</text>
    <path d="M85 58 L95 58 L95 50 L100 50 L90 40 L80 50 L85 50 Z" fill="#e67e22" opacity="0.7" />
    <text x="90" y="68" textAnchor="middle" fill="#95a5a6" fontSize="5">Import</text>
    {/* Arrow between */}
    <path d="M52 42 L62 42" stroke="#4472C4" strokeWidth="1.5" strokeDasharray="3 2" />
    <path d="M62 48 L52 48" stroke="#4472C4" strokeWidth="1.5" strokeDasharray="3 2" />
  </svg>
);

const IconDropdowns = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Sidebar panel */}
    <rect x="10" y="10" width="50" height="70" rx="4" stroke="#34495e" strokeWidth="1.5" fill="rgba(37,52,67,0.3)" />
    <text x="35" y="22" textAnchor="middle" fill="#ecf0f1" fontSize="6" fontWeight="600">Node Config</text>
    {/* Device dropdown */}
    <text x="14" y="33" fill="#95a5a6" fontSize="5">Device</text>
    <rect x="14" y="35" width="42" height="8" rx="2" fill="#2c3e50" stroke="#4a6a8a" strokeWidth="0.8" />
    <text x="18" y="41" fill="#ecf0f1" fontSize="4.5">RAK WisBlock</text>
    <text x="52" y="41" fill="#7f8c8d" fontSize="5">&#9662;</text>
    {/* Antenna dropdown */}
    <text x="14" y="52" fill="#95a5a6" fontSize="5">Antenna</text>
    <rect x="14" y="54" width="42" height="8" rx="2" fill="#2c3e50" stroke="#4a6a8a" strokeWidth="0.8" />
    <text x="18" y="60" fill="#ecf0f1" fontSize="4.5">915 3dBi Omni</text>
    <text x="52" y="60" fill="#7f8c8d" fontSize="5">&#9662;</text>
    {/* Arrow pointing from catalog to dropdowns */}
    <rect x="70" y="25" width="40" height="40" rx="4" stroke="#4472C4" strokeWidth="1.5" fill="rgba(68,114,196,0.08)" />
    <text x="90" y="42" textAnchor="middle" fill="#4472C4" fontSize="6" fontWeight="600">Catalog</text>
    <text x="90" y="52" textAnchor="middle" fill="#7fb3f0" fontSize="5">Database</text>
    <path d="M70 45 L62 45" stroke="#2ecc71" strokeWidth="1.5" markerEnd="url(#arrowGreen)" />
    <defs>
      <marker id="arrowGreen" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L6,3 L0,6 Z" fill="#2ecc71" />
      </marker>
    </defs>
  </svg>
);

const IconBOM = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* BOM document */}
    <rect x="20" y="8" width="80" height="60" rx="4" stroke="#4472C4" strokeWidth="1.5" fill="rgba(68,114,196,0.08)" />
    <text x="60" y="22" textAnchor="middle" fill="#ecf0f1" fontSize="7" fontWeight="600">Bill of Materials</text>
    {/* Cost rows */}
    <rect x="28" y="28" width="64" height="1" fill="#34495e" />
    <text x="32" y="36" fill="#95a5a6" fontSize="5">Device (RAK4631)</text>
    <text x="84" y="36" textAnchor="end" fill="#2ecc71" fontSize="5">$35.00</text>
    <text x="32" y="44" fill="#95a5a6" fontSize="5">Antenna (3dBi)</text>
    <text x="84" y="44" textAnchor="end" fill="#2ecc71" fontSize="5">$12.00</text>
    <text x="32" y="52" fill="#95a5a6" fontSize="5">Solar Panel (6W)</text>
    <text x="84" y="52" textAnchor="end" fill="#2ecc71" fontSize="5">$18.00</text>
    <rect x="28" y="56" width="64" height="1" fill="#34495e" />
    <text x="32" y="64" fill="#ecf0f1" fontSize="5" fontWeight="600">Total</text>
    <text x="84" y="64" textAnchor="end" fill="#ecf0f1" fontSize="5" fontWeight="600">$65.00</text>
    {/* Catalog source arrow */}
    <text x="60" y="82" textAnchor="middle" fill="#7fb3f0" fontSize="6">Prices from Catalog</text>
  </svg>
);

/* ---------- Step Definitions ---------- */

const STEPS: TourStep[] = [
  {
    title: 'Hardware Catalog Manager',
    content: 'The Catalog Manager lets you browse, edit, and extend all hardware data used by the application.',
    bullets: [
      '7 tabs: Devices, Antennas, Cables, PA Modules, Power Components, Regions, and Modem Presets',
      'The lock icon (\uD83D\uDD12) marks built-in entries that ship with the application \u2014 these cannot be edited or deleted, ensuring you always have a reliable baseline',
      'The "custom" badge marks entries you\u2019ve added \u2014 these can be fully edited and deleted',
      'Reference tables (Regions, Modem Presets) are read-only for built-in entries; you can add new ones',
    ],
    tip: 'Open the Catalog Manager from the toolbar: Catalog > Manage Catalog.',
    icon: <IconCatalog />,
  },
  {
    title: 'Editing Catalog Data',
    content: 'Only custom entries (marked with the "custom" badge) can be edited. Built-in entries with the lock icon are protected and read-only.',
    bullets: [
      'Click "+ Add Item" to create a new custom entry at the top of the table',
      'Click "Edit" on any custom row to modify its values inline, then "Save" or "Cancel"',
      'Custom entries can be deleted with the "Del" button \u2014 built-in entries cannot',
      'Changes take effect immediately in all dropdowns and BOM calculations',
    ],
    tip: 'Edit device prices to match your supplier\'s current pricing for more accurate BOM estimates.',
    icon: <IconEdit />,
  },
  {
    title: 'Import & Export (CSV)',
    content: 'Use CSV import and export to bulk-manage catalog data or share it between installations.',
    bullets: [
      '"Export CSV" downloads the current table as a CSV file with all columns',
      '"Import CSV" uploads a CSV file and merges new rows into the table',
      '"Reset Defaults" removes all custom entries and restores built-in data to its original state',
      'CSV import validates column names against the table schema',
    ],
    tip: 'Export first to see the expected CSV format, then modify the file and import it back.',
    icon: <IconImportExport />,
  },
  {
    title: 'Effect on Node Configuration',
    content: 'Catalog data drives the dropdown selectors in the node configuration sidebar.',
    bullets: [
      'Device, Antenna, Cable, and PA Module dropdowns are populated from catalog tables',
      'Region and Modem Preset selectors are populated from reference tables',
      'Adding a new device or antenna makes it immediately available for node configuration',
      'Editing a built-in device\'s specs (e.g., TX power) affects analysis calculations',
    ],
    tip: 'Add a custom regulatory region to support frequency bands not included in the built-in presets.',
    icon: <IconDropdowns />,
  },
  {
    title: 'Effect on BOM & Pricing',
    content: 'The Bill of Materials uses catalog pricing data to generate cost estimates for your deployment.',
    bullets: [
      'Device, antenna, cable, and power component prices come directly from the catalog',
      'Editing a price in the catalog immediately updates the BOM for all plans',
      'Custom entries with pricing appear in the BOM just like built-in items',
      'All pricing is for estimation only — verify with suppliers before purchasing',
    ],
    tip: 'Use the BOM\'s Info tab to understand how costs are calculated and what categories are included.',
    icon: <IconBOM />,
  },
];

/* ---------- Component ---------- */

export function CatalogTour({ onComplete, forceShow = false }: CatalogTourProps) {
  // Show tour if: forced from Help, OR (not permanently dismissed AND not dismissed this session)
  const [isVisible, setIsVisible] = useState(() => {
    if (forceShow) return true;
    if (isPermanentlyDismissed()) return false;
    if (isDismissedThisSession()) return false;
    return true;
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(isPermanentlyDismissed);

  const dismissTour = useCallback(() => {
    // Always mark this session as "tour dismissed"
    localStorage.setItem(SESSION_KEY, getSessionToken());

    if (dontShowAgain) {
      localStorage.setItem(PERMANENT_KEY, __BUILD_ID__);
    } else {
      localStorage.removeItem(PERMANENT_KEY);
    }
    setIsVisible(false);
    onComplete?.();
  }, [dontShowAgain, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < TOTAL_STEPS - 1) setCurrentStep((s) => s + 1);
        else dismissTour();
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) setCurrentStep((s) => s - 1);
      } else if (e.key === 'Escape') {
        dismissTour();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isVisible, currentStep, dismissTour]);

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;

  return (
    <div className="tour-overlay" onClick={dismissTour}>
      <div className="tour-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tour-header">
          <div className="tour-step-label">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </div>
          <button className="tour-close" type="button" onClick={dismissTour} title="Close tour">
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div className="tour-progress-bar">
          <div
            className="tour-progress-fill"
            style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="tour-body">
          <div className="tour-illustration">
            {step.icon}
          </div>
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-content">{step.content}</p>
          {step.bullets && (
            <ul className="tour-bullets">
              {step.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {step.tip && (
            <div className="tour-tip">
              <span className="tour-tip-label">TIP</span>
              <span className="tour-tip-text">{step.tip}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tour-footer">
          <label className="tour-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don&apos;t show this again</span>
          </label>

          <div className="tour-nav">
            <button
              className="tour-btn tour-btn-ghost"
              type="button"
              onClick={dismissTour}
            >
              Skip Tour
            </button>
            {!isFirst && (
              <button
                className="tour-btn tour-btn-secondary"
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                Previous
              </button>
            )}
            {!isLast ? (
              <button
                className="tour-btn tour-btn-primary"
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next
              </button>
            ) : (
              <button
                className="tour-btn tour-btn-primary tour-btn-finish"
                type="button"
                onClick={dismissTour}
              >
                Got It
              </button>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="tour-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tour-dot${i === currentStep ? ' active' : ''}${i < currentStep ? ' visited' : ''}`}
              type="button"
              onClick={() => setCurrentStep(i)}
              title={STEPS[i].title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CatalogTour;
