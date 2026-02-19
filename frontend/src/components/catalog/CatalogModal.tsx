/**
 * CatalogModal Component
 * Full CRUD manager for hardware catalog and reference tables.
 * 7 tabs: Devices, Antennas, Cables, PA Modules, Power, Regions, Modem Presets
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAPIClient } from '../../services/api';
import { CatalogTour } from './CatalogTour';
import { ErrorDialog } from '../common/ErrorDialog';
import './CatalogModal.css';

// ============================================================================
// Types & Config
// ============================================================================

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Force-show the catalog tour (triggered from Help section). */
  forceTour?: boolean;
  /** Called when tour finishes so parent can reset forceTour flag. */
  onTourComplete?: () => void;
}

type TabId = 'devices' | 'antennas' | 'cables' | 'pa-modules' | 'power' | 'regions' | 'presets';

interface TabConfig {
  id: TabId;
  label: string;
  tooltip: string;            // mouseover text for the tab
  group: 'hardware' | 'reference';
  apiTable: string;           // URL path segment for CRUD
  columns: ColumnDef[];
  isReference?: boolean;      // read-only built-in, can add new
}

interface ColumnDef {
  key: string;
  label: string;
  tooltip: string;             // mouseover text for the column header
  type: 'text' | 'number' | 'boolean' | 'select' | 'json';
  options?: string[];
  width?: string;
}

const TABS: TabConfig[] = [
  {
    id: 'devices', label: 'Devices', group: 'hardware', apiTable: 'devices',
    tooltip: 'LoRa radio devices (boards, modules) — the core hardware for each mesh node',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Device model name or identifier', type: 'text' },
      { key: 'mcu', label: 'MCU', tooltip: 'Microcontroller unit — the main processor chip (e.g., nRF52840, ESP32-S3)', type: 'text' },
      { key: 'radio_chip', label: 'Radio', tooltip: 'LoRa radio transceiver chip (e.g., SX1262, SX1276)', type: 'text' },
      { key: 'max_tx_power_dbm', label: 'Max TX (dBm)', tooltip: 'Maximum transmit power in decibels relative to one milliwatt (dBm)', type: 'number' },
      { key: 'frequency_bands', label: 'Bands', tooltip: 'Supported frequency bands as JSON array (e.g., ["902-928","863-870"])', type: 'json' },
      { key: 'has_gps', label: 'GPS', tooltip: 'Whether the device has a built-in GPS/GNSS receiver', type: 'boolean' },
      { key: 'battery_type', label: 'Battery', tooltip: 'Battery chemistry type (e.g., LiPo, Li-Ion, 18650)', type: 'text' },
      { key: 'battery_capacity_mah', label: 'Bat mAh', tooltip: 'Battery capacity in milliamp-hours (mAh)', type: 'number' },
      { key: 'form_factor', label: 'Form', tooltip: 'Physical form factor (e.g., handheld, module, compact, dev_board)', type: 'text' },
      { key: 'has_bluetooth', label: 'BT', tooltip: 'Whether the device has Bluetooth connectivity', type: 'boolean' },
      { key: 'has_wifi', label: 'WiFi', tooltip: 'Whether the device has WiFi connectivity', type: 'boolean' },
      { key: 'price_usd', label: 'Price ($)', tooltip: 'Estimated price in US dollars (USD) — for planning only', type: 'number' },
      { key: 'compatible_firmware', label: 'Firmware', tooltip: 'Compatible firmware families as JSON array (e.g., ["meshtastic","meshcore"])', type: 'json' },
      { key: 'tx_current_ma', label: 'TX mA', tooltip: 'Current draw during transmission in milliamps (mA)', type: 'number' },
      { key: 'rx_current_ma', label: 'RX mA', tooltip: 'Current draw during active receive in milliamps (mA)', type: 'number' },
      { key: 'sleep_current_ma', label: 'Sleep mA', tooltip: 'Current draw in sleep/standby mode in milliamps (mA)', type: 'number' },
    ],
  },
  {
    id: 'antennas', label: 'Antennas', group: 'hardware', apiTable: 'antennas',
    tooltip: 'Antennas for LoRa radio communication — affects signal range and coverage',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Antenna model name or description', type: 'text' },
      { key: 'frequency_band', label: 'Band', tooltip: 'Operating frequency band (e.g., 915, 868, 433 MHz)', type: 'text' },
      { key: 'gain_dbi', label: 'Gain (dBi)', tooltip: 'Antenna gain in decibels relative to an isotropic radiator (dBi) — higher = more focused signal', type: 'number' },
      { key: 'polarization', label: 'Polarization', tooltip: 'Signal polarization orientation (e.g., vertical, horizontal)', type: 'text' },
      { key: 'form_factor', label: 'Form', tooltip: 'Physical antenna type (e.g., whip, omni, yagi, panel)', type: 'text' },
      { key: 'connector_type', label: 'Connector', tooltip: 'RF connector type (e.g., SMA, N-Female, U.FL)', type: 'text' },
      { key: 'price_usd', label: 'Price ($)', tooltip: 'Estimated price in US dollars (USD) — for planning only', type: 'number' },
      { key: 'is_default', label: 'Default', tooltip: 'Whether this antenna is the default selection for its frequency band when configuring a new node', type: 'boolean' },
    ],
  },
  {
    id: 'cables', label: 'Cables', group: 'hardware', apiTable: 'cables',
    tooltip: 'Coaxial cables connecting devices to antennas — signal loss depends on cable type and length',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Cable model name or description', type: 'text' },
      { key: 'cable_type', label: 'Type', tooltip: 'Cable specification type (e.g., LMR-400, RG-58, LMR-195)', type: 'text' },
      { key: 'loss_per_m_915mhz', label: '915 dB/m', tooltip: 'Signal loss per meter at 915 MHz in decibels (dB/m) — used for US/ANZ frequency calculations', type: 'number' },
      { key: 'loss_per_m_868mhz', label: '868 dB/m', tooltip: 'Signal loss per meter at 868 MHz in decibels (dB/m) — used for EU 868 frequency calculations', type: 'number' },
      { key: 'loss_per_m_433mhz', label: '433 dB/m', tooltip: 'Signal loss per meter at 433 MHz in decibels (dB/m) — used for EU 433 frequency calculations', type: 'number' },
      { key: 'connector_types', label: 'Connectors', tooltip: 'Available connector types on the cable ends (e.g., "SMA-Male to N-Male")', type: 'text' },
      { key: 'price_per_m_usd', label: '$/m', tooltip: 'Price per meter of cable in US dollars (USD/m) — multiply by cable length for total cost', type: 'number' },
    ],
  },
  {
    id: 'pa-modules', label: 'PA Modules', group: 'hardware', apiTable: 'pa-modules',
    tooltip: 'Power Amplifier modules — external amplifiers that boost transmit power beyond the device\'s built-in radio',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Power amplifier model name', type: 'text' },
      { key: 'frequency_range', label: 'Freq Range', tooltip: 'Operating frequency range the amplifier supports (e.g., "862-928 MHz")', type: 'text' },
      { key: 'max_output_power_dbm', label: 'Max Out (dBm)', tooltip: 'Maximum output power in decibels relative to one milliwatt (dBm)', type: 'number' },
      { key: 'input_power_range', label: 'Input Range', tooltip: 'Acceptable input power range from the radio (e.g., "0-22 dBm")', type: 'text' },
      { key: 'current_draw_ma', label: 'Current (mA)', tooltip: 'Current draw during amplification in milliamps (mA) — affects battery life calculations', type: 'number' },
      { key: 'price_usd', label: 'Price ($)', tooltip: 'Estimated price in US dollars (USD) — for planning only', type: 'number' },
    ],
  },
  {
    id: 'power', label: 'Power', group: 'hardware', apiTable: 'power',
    tooltip: 'Power system components — solar panels, batteries, charge controllers, enclosures, masts, and connectors',
    columns: [
      { key: 'category', label: 'Category', tooltip: 'Component category (solar_panel, battery, bec, charge_controller, enclosure, mast, connector)', type: 'select', options: ['solar_panel', 'battery', 'bec', 'charge_controller', 'enclosure', 'mast', 'connector'] },
      { key: 'name', label: 'Name', tooltip: 'Component model name or description', type: 'text' },
      { key: 'specs', label: 'Specs (JSON)', tooltip: 'Technical specifications as a JSON object (e.g., {"watts": 6, "voltage": "5V"})', type: 'json' },
      { key: 'price_usd', label: 'Price ($)', tooltip: 'Estimated price in US dollars (USD) — for planning only', type: 'number' },
    ],
  },
  {
    id: 'regions', label: 'Regions', group: 'reference', apiTable: 'regulatory-presets',
    isReference: true,
    tooltip: 'Regulatory region presets — frequency limits, power limits, and duty cycle rules per country/region',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Region preset name (e.g., "US FCC (915 MHz)", "EU 868 MHz")', type: 'text' },
      { key: 'region_code', label: 'Code', tooltip: 'Short region code used internally (e.g., us_fcc, eu_868, anz)', type: 'text' },
      { key: 'min_frequency_mhz', label: 'Min MHz', tooltip: 'Minimum allowed frequency in megahertz (MHz) for this region', type: 'number' },
      { key: 'max_frequency_mhz', label: 'Max MHz', tooltip: 'Maximum allowed frequency in megahertz (MHz) for this region', type: 'number' },
      { key: 'max_tx_power_dbm', label: 'Max TX (dBm)', tooltip: 'Maximum legal transmit power in decibels (dBm) for this region', type: 'number' },
      { key: 'max_erp_dbm', label: 'Max ERP', tooltip: 'Maximum Effective Radiated Power in decibels (dBm) — includes antenna gain', type: 'number' },
      { key: 'duty_cycle_pct', label: 'Duty %', tooltip: 'Maximum duty cycle percentage — limits how often you can transmit (100 = no limit)', type: 'number' },
      { key: 'bandwidths_khz', label: 'BWs (kHz)', tooltip: 'Allowed channel bandwidths in kilohertz as a JSON array (e.g., [125, 250, 500])', type: 'json' },
    ],
  },
  {
    id: 'presets', label: 'Modem Presets', group: 'reference', apiTable: 'modem-presets',
    isReference: true,
    tooltip: 'LoRa modem configuration presets — spreading factor, bandwidth, and coding rate combinations that define range vs. speed tradeoffs',
    columns: [
      { key: 'name', label: 'Name', tooltip: 'Preset name (e.g., "LongFast", "ShortTurbo", "MeshCore-US")', type: 'text' },
      { key: 'firmware', label: 'Firmware', tooltip: 'Firmware family this preset applies to (meshtastic, meshcore, reticulum)', type: 'text' },
      { key: 'spreading_factor', label: 'SF', tooltip: 'Spreading Factor (5-12) — higher SF = longer range but slower data rate', type: 'number' },
      { key: 'bandwidth_khz', label: 'BW (kHz)', tooltip: 'Channel bandwidth in kilohertz (kHz) — wider bandwidth = faster but shorter range', type: 'number' },
      { key: 'coding_rate', label: 'CR', tooltip: 'Coding Rate — forward error correction ratio (e.g., 4/5, 4/8) — higher = more robust but slower', type: 'text' },
      { key: 'receiver_sensitivity_dbm', label: 'Sens (dBm)', tooltip: 'Receiver sensitivity in decibels (dBm) — lower (more negative) = can hear weaker signals', type: 'number' },
      { key: 'is_default', label: 'Default', tooltip: 'Whether this is the default preset for its firmware family', type: 'boolean' },
      { key: 'sort_order', label: 'Order', tooltip: 'Display sort order in dropdown menus — lower numbers appear first', type: 'number' },
    ],
  },
];

// Tooltip text for group labels
const GROUP_TOOLTIPS = {
  hardware: 'Physical components — devices, antennas, cables, amplifiers, and power system parts',
  reference: 'Configuration data — regulatory region limits and LoRa modem parameter presets',
};

// ============================================================================
// Helper to format cell display value
// ============================================================================

function formatCellValue(value: any, col: ColumnDef): string {
  if (value == null || value === '') return '--';
  if (col.type === 'boolean') return value ? 'Yes' : 'No';
  if (col.type === 'json') {
    if (typeof value === 'string') {
      try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
    }
    return JSON.stringify(value);
  }
  if (col.type === 'number' && typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

// ============================================================================
// Custom Confirm Dialog Component (replaces window.confirm)
// ============================================================================

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return createPortal(
    <div className="catalog-confirm-overlay" onClick={onCancel}>
      <div className="catalog-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-confirm-header">
          <span className="catalog-confirm-icon">&#9888;</span>
          <span className="catalog-confirm-title">Mesh Community Planner says</span>
        </div>
        <div className="catalog-confirm-body">{message}</div>
        <div className="catalog-confirm-footer">
          <button className="catalog-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="catalog-confirm-ok" onClick={onConfirm} autoFocus>OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ============================================================================
// Default modal position and size
// ============================================================================

function getDefaultRect() {
  const w = Math.min(1160, window.innerWidth * 0.95);
  const h = Math.min(window.innerHeight * 0.88, window.innerHeight - 40);
  return {
    x: Math.max(0, (window.innerWidth - w) / 2),
    y: Math.max(20, (window.innerHeight - h) / 2),
    w,
    h,
  };
}

// ============================================================================
// Component
// ============================================================================

export function CatalogModal({ isOpen, onClose, forceTour = false, onTourComplete }: CatalogModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('devices');
  const [catalogTourKey, setCatalogTourKey] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newValues, setNewValues] = useState<Record<string, any>>({});
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Sort & filter state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Drag & resize state
  const [rect, setRect] = useState(getDefaultRect);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const confirmResolveRef = useRef<((val: boolean) => void) | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const api = getAPIClient();
  const tabConfig = TABS.find(t => t.id === activeTab)!;

  // ---- Load data when tab changes ----
  const loadData = useCallback(async () => {
    setLoading(true);
    setEditingId(null);
    setAddingNew(false);
    setStatusMsg('');
    setSortCol(null);
    setSortDir('asc');
    setFilterValues({});
    setShowFilters(false);
    try {
      const tab = TABS.find(t => t.id === activeTab)!;
      let data: any[];
      switch (tab.apiTable) {
        case 'devices': data = await api.getCatalogDevices(); break;
        case 'antennas': data = await api.getCatalogAntennas(); break;
        case 'cables': data = await api.getCatalogCables(); break;
        case 'pa-modules': data = await api.getCatalogPAModules(); break;
        case 'power': data = await api.getCatalogPower(); break;
        case 'regulatory-presets': data = await api.getRegulatoryPresets(); break;
        case 'modem-presets': data = await api.getModemPresets(); break;
        default: data = [];
      }
      setItems(data);
    } catch (err: any) {
      showError(`Failed to load catalog data.\n\n${err.message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, api]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, activeTab, loadData]);

  // Trigger catalog tour when forceTour is set from Help section
  useEffect(() => {
    if (forceTour) {
      setCatalogTourKey((k) => k + 1);
    }
  }, [forceTour]);

  // Reset position/size when modal opens
  useEffect(() => {
    if (isOpen) setRect(getDefaultRect());
  }, [isOpen]);

  // Focus trap: constrain Tab key to elements within the modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ---- Drag handlers ----
  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from the header area, not from buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.x, origY: rect.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setRect(prev => ({
        ...prev,
        x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current!.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current!.origY + dy)),
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect.x, rect.y]);

  // ---- Resize handlers ----
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.w, origH: rect.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      setRect(prev => ({
        ...prev,
        w: Math.max(600, resizeRef.current!.origW + dw),
        h: Math.max(400, resizeRef.current!.origH + dh),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect.w, rect.h]);

  if (!isOpen) return null;

  // Helper to show formatted error dialog
  const showError = (msg: string) => setErrorMsg(msg);

  // Helper to show styled confirmation dialog (replaces window.confirm)
  const showConfirm = (msg: string): Promise<boolean> =>
    new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({
        message: msg,
        onConfirm: () => { setConfirmState(null); resolve(true); confirmResolveRef.current = null; },
      });
    });
  const cancelConfirm = () => {
    setConfirmState(null);
    if (confirmResolveRef.current) { confirmResolveRef.current(false); confirmResolveRef.current = null; }
  };

  // ---- Edit handlers ----
  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditValues({ ...item });
    setAddingNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const fields: Record<string, any> = {};
      for (const col of tabConfig.columns) {
        if (editValues[col.key] !== undefined) {
          let val = editValues[col.key];
          if (col.type === 'number' && val !== null && val !== '') val = Number(val);
          if (col.type === 'boolean') val = val ? 1 : 0;
          fields[col.key] = val;
        }
      }
      await api.updateCatalogItem(tabConfig.apiTable, editingId, fields);
      setEditingId(null);
      setStatusMsg('Saved successfully');
      loadData();
    } catch (err: any) {
      showError(`Save failed.\n\n${err.message}`);
    }
  };

  const deleteItem = async (item: any) => {
    const ok = await showConfirm(`Delete "${item.name || item.id}"?\n\nThis cannot be undone.`);
    if (!ok) return;
    try {
      await api.deleteCatalogItem(tabConfig.apiTable, item.id);
      setStatusMsg('Deleted');
      loadData();
    } catch (err: any) {
      showError(`Delete failed.\n\n${err.message}`);
    }
  };

  // ---- Add new ----
  const startAdd = () => {
    setAddingNew(true);
    setEditingId(null);
    const defaults: Record<string, any> = {};
    for (const col of tabConfig.columns) {
      if (col.type === 'boolean') defaults[col.key] = false;
      else if (col.type === 'number') defaults[col.key] = '';
      else defaults[col.key] = '';
    }
    setNewValues(defaults);
  };

  const cancelAdd = () => {
    setAddingNew(false);
    setNewValues({});
  };

  const saveNew = async () => {
    // Validate all required fields are filled
    const missing: string[] = [];
    for (const col of tabConfig.columns) {
      if (col.type === 'boolean') continue; // booleans default to false
      const val = newValues[col.key];
      if (val === '' || val === undefined || val === null) {
        missing.push(col.label);
      }
    }
    if (missing.length > 0) {
      showError(`All fields are required before saving.\n\nMissing: ${missing.join(', ')}`);
      return;
    }

    try {
      const data: Record<string, any> = {};
      for (const col of tabConfig.columns) {
        let val = newValues[col.key];
        if (val === '' || val === undefined) {
          if (col.type === 'boolean') val = false;
          else continue;
        }
        if (col.type === 'number' && val !== null) val = Number(val);
        if (col.type === 'boolean') val = !!val;
        data[col.key] = val;
      }
      await api.createCatalogItem(tabConfig.apiTable, data);
      setAddingNew(false);
      setStatusMsg('Created successfully');
      loadData();
    } catch (err: any) {
      showError(`Create failed.\n\n${err.message}`);
    }
  };

  // ---- CSV Export / Import / Reset ----
  const handleExport = async () => {
    try {
      const blob = await api.exportCatalogCSV(tabConfig.apiTable);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MeshCommunityPlanner_${tabConfig.label.replace(/\s+/g, '')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg('Exported CSV');
    } catch (err: any) {
      showError(`Export failed.\n\n${err.message}`);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const result = await api.importCatalogCSV(tabConfig.apiTable, file, 'merge');
        setStatusMsg(`Imported ${result.imported} custom row(s). Built-in items were not modified.`);
        loadData();
      } catch (err: any) {
        showError(`Import failed.\n\n${err.message}`);
      }
    };
    input.click();
  };

  const handleReset = async () => {
    const ok = await showConfirm('Reset this table to defaults?\n\nAll custom entries will be removed. This cannot be undone.');
    if (!ok) return;
    try {
      await api.resetCatalogTable(tabConfig.apiTable);
      setStatusMsg('Reset to defaults');
      loadData();
    } catch (err: any) {
      showError(`Reset failed.\n\n${err.message}`);
    }
  };

  // ---- Render cell (display or edit mode) ----
  const renderCell = (item: any, col: ColumnDef, isEditing: boolean, values: Record<string, any>, setValues: (v: Record<string, any>) => void) => {
    if (!isEditing) {
      return <span title={String(item[col.key] ?? '')}>{formatCellValue(item[col.key], col)}</span>;
    }

    const val = values[col.key] ?? '';
    const onChange = (newVal: any) => setValues({ ...values, [col.key]: newVal });

    if (col.type === 'boolean') {
      return <input type="checkbox" className="catalog-cell-checkbox" checked={!!val} onChange={(e) => onChange(e.target.checked)} />;
    }
    if (col.type === 'select' && col.options) {
      return (
        <select className="catalog-cell-select" value={val} onChange={(e) => onChange(e.target.value)}>
          <option value="">--</option>
          {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (col.type === 'number') {
      return <input type="number" className="catalog-cell-input" step="any" value={val} onChange={(e) => onChange(e.target.value)} />;
    }
    // text & json
    return <input type="text" className="catalog-cell-input" value={val} onChange={(e) => onChange(e.target.value)} />;
  };

  const isHardwareTab = !tabConfig.isReference;

  // ---- Sort toggle ----
  const toggleSort = (colKey: string) => {
    if (sortCol === colKey) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); } // third click: clear sort
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  };

  // ---- Filter & sort items ----
  const hasActiveFilters = Object.values(filterValues).some(v => v.length > 0);
  let displayItems = [...items];
  // Apply filters
  if (hasActiveFilters) {
    displayItems = displayItems.filter(item => {
      return tabConfig.columns.every(col => {
        const fv = filterValues[col.key];
        if (!fv) return true;
        const cellVal = String(item[col.key] ?? '').toLowerCase();
        return cellVal.includes(fv.toLowerCase());
      });
    });
  }
  // Apply sort
  if (sortCol) {
    const col = tabConfig.columns.find(c => c.key === sortCol);
    displayItems.sort((a, b) => {
      let va = a[sortCol!];
      let vb = b[sortCol!];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (col?.type === 'number') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else if (col?.type === 'boolean') {
        va = va ? 1 : 0;
        vb = vb ? 1 : 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <div className="catalog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Hardware Catalog Manager" ref={modalRef}>
      <div
        className="catalog-modal"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (drag handle) */}
        <div className="catalog-header" onMouseDown={onDragStart}>
          <h2 className="catalog-title">Hardware Catalog Manager</h2>
          <button className="catalog-close" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Tabs */}
        <div className="catalog-tabs">
          <span className="catalog-tab-group-label" title={GROUP_TOOLTIPS.hardware}>HARDWARE</span>
          {TABS.filter(t => t.group === 'hardware').map(tab => (
            <button
              key={tab.id}
              className={`catalog-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.tooltip}
            >
              {tab.label}
            </button>
          ))}
          <span className="catalog-tab-divider" />
          <span className="catalog-tab-group-label" title={GROUP_TOOLTIPS.reference}>REFERENCE</span>
          {TABS.filter(t => t.group === 'reference').map(tab => (
            <button
              key={tab.id}
              className={`catalog-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.tooltip}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="catalog-toolbar">
          <button className="catalog-toolbar-btn primary" onClick={startAdd} title="Create a new custom catalog entry">+ Add Item</button>
          {isHardwareTab && (
            <>
              <button className="catalog-toolbar-btn" onClick={handleImport} title="Import custom items from a CSV file — built-in items are never overwritten">Import CSV</button>
              <button className="catalog-toolbar-btn" onClick={handleExport} title="Export this table as a CSV file">Export CSV</button>
              <button className="catalog-toolbar-btn danger" onClick={handleReset} title="Remove all custom entries and restore built-in items to defaults">Reset Defaults</button>
            </>
          )}
          {!isHardwareTab && (
            <button className="catalog-toolbar-btn" onClick={handleExport} title="Export this table as a CSV file">Export CSV</button>
          )}
          <span className="catalog-toolbar-spacer" />
          {hasActiveFilters && <span className="catalog-toolbar-status">Showing {displayItems.length} of {items.length}</span>}
          {statusMsg && <span className="catalog-toolbar-status">{statusMsg}</span>}
        </div>

        {/* Table */}
        <div className="catalog-body">
          {loading ? (
            <div className="catalog-loading">Loading...</div>
          ) : (
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th style={{ width: '20px', padding: '0.3rem 0.2rem', textAlign: 'center' }} title="Item type — lock icon = built-in (read-only), custom badge = user-created (editable)">
                      <button
                        className={`catalog-filter-toggle${showFilters ? ' active' : ''}${hasActiveFilters ? ' has-filters' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        title={showFilters ? 'Hide column filters' : 'Show column filters'}
                      >&#9698;</button>
                    </th>
                    {tabConfig.columns.map(col => (
                      <th
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        title={col.tooltip}
                        className="catalog-th-sortable"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="catalog-th-label">{col.label}</span>
                        <span className="catalog-sort-icon">
                          {sortCol === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}
                        </span>
                      </th>
                    ))}
                    <th style={{ width: '100px' }} title="Edit and delete actions — only available for custom items">Actions</th>
                  </tr>
                  {showFilters && (
                    <tr className="catalog-filter-row">
                      <th>
                        {hasActiveFilters && (
                          <button
                            className="catalog-filter-clear"
                            onClick={() => setFilterValues({})}
                            title="Clear all filters"
                          >&times;</button>
                        )}
                      </th>
                      {tabConfig.columns.map(col => (
                        <th key={col.key}>
                          <input
                            type="text"
                            className="catalog-filter-input"
                            placeholder={`Filter...`}
                            value={filterValues[col.key] || ''}
                            onChange={(e) => setFilterValues(prev => ({ ...prev, [col.key]: e.target.value }))}
                          />
                        </th>
                      ))}
                      <th />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {/* New row at top when adding */}
                  {addingNew && (
                    <tr className="editing">
                      <td><span className="catalog-badge-custom">new</span></td>
                      {tabConfig.columns.map(col => (
                        <td key={col.key}>{renderCell({}, col, true, newValues, setNewValues)}</td>
                      ))}
                      <td>
                        <div className="catalog-row-actions">
                          <button className="catalog-row-btn save" onClick={saveNew}>Save</button>
                          <button className="catalog-row-btn cancel" onClick={cancelAdd}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {displayItems.length === 0 && !addingNew && (
                    <tr><td colSpan={tabConfig.columns.length + 2} className="catalog-empty">
                      {hasActiveFilters ? `No items match the current filters` : 'No items'}
                    </td></tr>
                  )}

                  {displayItems.map(item => {
                    const isCustom = 'is_custom' in item ? !!item.is_custom : false;
                    const isEditing = editingId === item.id;
                    // Only custom items can be edited or deleted
                    const canEdit = isCustom;
                    const canDelete = isCustom;

                    return (
                      <tr key={item.id} className={`${isEditing ? 'editing' : ''} ${!isCustom ? 'readonly' : ''}`}>
                        <td>
                          {!isCustom && <span className="catalog-badge-builtin" title="Built-in item — cannot be edited or deleted">&#128274;</span>}
                          {isCustom && <span className="catalog-badge-custom" title="Custom item — can be edited and deleted">custom</span>}
                        </td>
                        {tabConfig.columns.map(col => (
                          <td key={col.key}>
                            {renderCell(item, col, isEditing, editValues, setEditValues)}
                          </td>
                        ))}
                        <td>
                          <div className="catalog-row-actions">
                            {isEditing ? (
                              <>
                                <button className="catalog-row-btn save" onClick={saveEdit}>Save</button>
                                <button className="catalog-row-btn cancel" onClick={cancelEdit}>Cancel</button>
                              </>
                            ) : (
                              <>
                                {canEdit && <button className="catalog-row-btn" onClick={() => startEdit(item)} title="Edit this custom item">Edit</button>}
                                {canDelete && <button className="catalog-row-btn delete" onClick={() => deleteItem(item)} title="Delete this custom item">Del</button>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div className="catalog-resize-handle" onMouseDown={onResizeStart} title="Drag to resize" />

        {/* Catalog Tour — shows on first open, or when forced from Help */}
        <CatalogTour
          key={catalogTourKey}
          forceShow={catalogTourKey > 0}
          onComplete={onTourComplete}
        />
      </div>

      {/* Custom error dialog */}
      {errorMsg && <ErrorDialog message={errorMsg} onClose={() => setErrorMsg(null)} />}
      {/* Custom confirm dialog */}
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={cancelConfirm} />}
    </div>
  );
}
