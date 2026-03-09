/**
 * ElevationLegend component
 * Hypsometric color scale, dual-handle range slider, number inputs,
 * opacity slider, range-lock checkbox, mouse-wheel fine-tuning.
 * Only visible when the elevation heatmap layer is enabled.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useMapStore, ELEVATION_RANGE_BUILD_ID } from '../../stores/mapStore';
import './ElevationLegend.css';

// Same 10 color stops as the backend (elevation_tiles.py _COLOR_STOPS)
const COLOR_STOPS: [number, number, number][] = [
  [ 70, 130, 180],  // -500  Deep below sea level — steel blue
  [ 34, 139,  34],  //    0  Sea level — forest green
  [ 85, 185,  85],  //   50  Low — medium green
  [180, 220,  90],  //  200  Moderate — yellow-green
  [240, 230,  80],  //  500  Medium — bright yellow
  [230, 175,  45],  //  800  High-medium — amber-gold
  [200, 120,  40],  // 1200  High — deep orange
  [170,  90,  70],  // 2000  Mountain — terracotta
  [180, 180, 180],  // 3000  Alpine — medium gray
  [245, 245, 252],  // 4500  Peak — snow white
];

/** Interpolate through the 10 color stops evenly spaced across [0, 1]. */
function interpolateColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const n = COLOR_STOPS.length;
  const scaled = clamped * (n - 1);
  const idx = Math.min(Math.floor(scaled), n - 2);
  const frac = scaled - idx;
  const [r0, g0, b0] = COLOR_STOPS[idx];
  const [r1, g1, b1] = COLOR_STOPS[idx + 1];
  return [
    Math.round(r0 + frac * (r1 - r0)),
    Math.round(g0 + frac * (g1 - g0)),
    Math.round(b0 + frac * (b1 - b0)),
  ];
}

/** Short terrain-type label for a given elevation in metres. */
function terrainLabel(elevM: number): string {
  if (elevM < -100) return 'Sub-sea';
  if (elevM <   10) return 'Coastal';
  if (elevM <  200) return 'Lowland';
  if (elevM <  500) return 'Upland';
  if (elevM <  900) return 'Foothill';
  if (elevM < 1500) return 'Mountain';
  if (elevM < 2500) return 'Highland';
  if (elevM < 3500) return 'Alpine';
  if (elevM < 5000) return 'Glacial';
  return 'Summit';
}

/** Build legend items for the current elevation range. */
function buildLegendItems(eMin: number, eMax: number) {
  const n = COLOR_STOPS.length;
  const items: Array<{ color: string; label: string; terrain: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const elev = Math.round(eMin + t * (eMax - eMin));
    const [r, g, b] = interpolateColor(t);
    items.push({
      color: `rgb(${r}, ${g}, ${b})`,
      label: `${elev}m`,
      terrain: terrainLabel(elev),
    });
  }
  return items;
}

const DEFAULT_MIN = -500;
const DEFAULT_MAX = 9000;
const SLIDER_MIN = -500;
const SLIDER_MAX = 9000;
const STEP = 10;
const PAGE_STEP = 100;

const ELEVATION_RANGE_KEY = 'meshPlanner_elevationRange';

export function ElevationLegend() {
  const elevationEnabled   = useMapStore((s) => s.elevation_layer_enabled);
  const elevationOpacity   = useMapStore((s) => s.elevationOpacity);
  const setElevationOpacity = useMapStore((s) => s.setElevationOpacity);
  const elevationMin       = useMapStore((s) => s.elevationMin);
  const elevationMax       = useMapStore((s) => s.elevationMax);
  const setElevationRange  = useMapStore((s) => s.setElevationRange);

  const [localMin, setLocalMin] = useState<number | null>(null);
  const [localMax, setLocalMax] = useState<number | null>(null);
  const [inputMinText, setInputMinText] = useState<string | null>(null);
  const [inputMaxText, setInputMaxText] = useState<string | null>(null);
  const [inputMinError, setInputMinError] = useState(false);
  const [inputMaxError, setInputMaxError] = useState(false);
  const [isLocked, setIsLocked] = useState<boolean>(
    () => !!localStorage.getItem(ELEVATION_RANGE_KEY)
  );

  const minSliderRef = useRef<HTMLInputElement>(null);
  const maxSliderRef = useRef<HTMLInputElement>(null);

  // Non-passive wheel listeners so we can call preventDefault
  useEffect(() => {
    const attach = (
      el: HTMLInputElement | null,
      getVal: () => number,
      setVal: (v: number) => void,
      getOther: () => number,
      isMin: boolean
    ) => {
      if (!el) return () => {};
      const handler = (e: WheelEvent) => {
        if (document.activeElement !== el) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? STEP : -STEP;
        const raw = getVal() + delta;
        const clamped = isMin
          ? Math.max(SLIDER_MIN, Math.min(raw, getOther() - STEP))
          : Math.min(SLIDER_MAX, Math.max(raw, getOther() + STEP));
        setVal(clamped);
        if (isMin) setElevationRange(clamped, useMapStore.getState().elevationMax);
        else       setElevationRange(useMapStore.getState().elevationMin, clamped);
      };
      el.addEventListener('wheel', handler, { passive: false });
      return () => el.removeEventListener('wheel', handler);
    };

    const cleanMin = attach(
      minSliderRef.current,
      () => useMapStore.getState().elevationMin,
      (v) => setLocalMin(v),
      () => useMapStore.getState().elevationMax,
      true
    );
    const cleanMax = attach(
      maxSliderRef.current,
      () => useMapStore.getState().elevationMax,
      (v) => setLocalMax(v),
      () => useMapStore.getState().elevationMin,
      false
    );
    return () => { cleanMin(); cleanMax(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevationEnabled]);

  if (!elevationEnabled) return null;

  const displayMin = localMin ?? elevationMin;
  const displayMax = localMax ?? elevationMax;
  const isCustomRange = elevationMin !== DEFAULT_MIN || elevationMax !== DEFAULT_MAX;

  // Percentage positions for the dual-range track fill
  const range    = SLIDER_MAX - SLIDER_MIN;
  const minPct   = ((displayMin - SLIDER_MIN) / range) * 100;
  const maxPct   = ((displayMax - SLIDER_MIN) / range) * 100;
  // Put min thumb on top when it's near the top so the user can still drag it left
  const minZ = minPct > maxPct - 5 ? 3 : 1;
  const maxZ = minPct > maxPct - 5 ? 1 : 3;

  const legendItems = buildLegendItems(displayMin, displayMax);

  // ── Dual-range slider handlers ──────────────────────────────────────────

  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setLocalMin(Math.min(parseInt(e.target.value, 10), displayMax - STEP));

  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setLocalMax(Math.max(parseInt(e.target.value, 10), displayMin + STEP));

  const handleMinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp')   { e.preventDefault(); setLocalMin(Math.min(displayMin + PAGE_STEP, displayMax - STEP)); }
    if (e.key === 'PageDown') { e.preventDefault(); setLocalMin(Math.max(displayMin - PAGE_STEP, SLIDER_MIN)); }
  };

  const handleMaxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp')   { e.preventDefault(); setLocalMax(Math.min(displayMax + PAGE_STEP, SLIDER_MAX)); }
    if (e.key === 'PageDown') { e.preventDefault(); setLocalMax(Math.max(displayMax - PAGE_STEP, displayMin + STEP)); }
  };

  const commitRange = () => {
    const newMin = localMin ?? elevationMin;
    const newMax = localMax ?? elevationMax;
    setElevationRange(newMin, newMax);
    setLocalMin(null);
    setLocalMax(null);
    if (isLocked)
      localStorage.setItem(ELEVATION_RANGE_KEY, JSON.stringify({ min: newMin, max: newMax, buildId: ELEVATION_RANGE_BUILD_ID }));
  };

  // ── Number input handlers ────────────────────────────────────────────────

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMinText(e.target.value);
    setInputMinError(false);
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMaxText(e.target.value);
    setInputMaxError(false);
  };

  const handleMinInputFocus = () => {
    setInputMinText(String(displayMin));
    setInputMinError(false);
  };

  const handleMaxInputFocus = () => {
    setInputMaxText(String(displayMax));
    setInputMaxError(false);
  };

  const commitMinNumber = () => {
    if (inputMinText === null) return;
    const trimmed = inputMinText.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      setInputMinError(true);
      return;
    }
    const v = parseInt(trimmed, 10);
    const clamped = Math.max(SLIDER_MIN, Math.min(v, displayMax - STEP));
    setElevationRange(clamped, elevationMax);
    setLocalMin(null);
    setInputMinText(null);
    setInputMinError(false);
    if (isLocked)
      localStorage.setItem(ELEVATION_RANGE_KEY, JSON.stringify({ min: clamped, max: elevationMax, buildId: ELEVATION_RANGE_BUILD_ID }));
  };

  const commitMaxNumber = () => {
    if (inputMaxText === null) return;
    const trimmed = inputMaxText.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      setInputMaxError(true);
      return;
    }
    const v = parseInt(trimmed, 10);
    const clamped = Math.min(SLIDER_MAX, Math.max(v, elevationMin + STEP));
    setElevationRange(elevationMin, clamped);
    setLocalMax(null);
    setInputMaxText(null);
    setInputMaxError(false);
    if (isLocked)
      localStorage.setItem(ELEVATION_RANGE_KEY, JSON.stringify({ min: elevationMin, max: clamped, buildId: ELEVATION_RANGE_BUILD_ID }));
  };

  const handleNumberKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    commit: () => void
  ) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') {
      e.preventDefault();
      setLocalMin(null); setLocalMax(null);
      setInputMinText(null); setInputMaxText(null);
      setInputMinError(false); setInputMaxError(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setLocalMin(null);
    setLocalMax(null);
    setInputMinText(null);
    setInputMaxText(null);
    setInputMinError(false);
    setInputMaxError(false);
    setElevationRange(DEFAULT_MIN, DEFAULT_MAX);
    if (isLocked)
      localStorage.setItem(ELEVATION_RANGE_KEY, JSON.stringify({ min: DEFAULT_MIN, max: DEFAULT_MAX, buildId: ELEVATION_RANGE_BUILD_ID }));
  };

  // ── Lock checkbox ────────────────────────────────────────────────────────

  const handleLockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsLocked(checked);
    if (checked)
      localStorage.setItem(ELEVATION_RANGE_KEY, JSON.stringify({ min: elevationMin, max: elevationMax, buildId: ELEVATION_RANGE_BUILD_ID }));
    else
      localStorage.removeItem(ELEVATION_RANGE_KEY);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="elevation-legend">

      {/* Title + optional Reset */}
      <div className="elevation-legend-title">
        Elevation
        {isCustomRange && (
          <button
            className="elevation-legend-reset"
            type="button"
            onClick={handleReset}
            title="Reset elevation range to defaults (−500 m to 9000 m)"
          >
            Reset
          </button>
        )}
      </div>

      {/* Color swatches with terrain labels */}
      <div className="elevation-legend-items" title="Hypsometric color scale — colors represent terrain elevation">
        {legendItems.map((item, i) => (
          <div
            key={i}
            className="elevation-legend-item"
            title={`${item.label} — ${item.terrain}`}
          >
            <span className="elevation-legend-swatch" style={{ backgroundColor: item.color }} />
            <span className="elevation-legend-elev">{item.label}</span>
            <span className="elevation-legend-terrain">{item.terrain}</span>
          </div>
        ))}
      </div>

      <div className="elevation-legend-separator" />

      {/* Dual-handle range section */}
      <div
        className="elevation-legend-range"
        role="group"
        aria-labelledby="elevation-range-label"
      >
        <span id="elevation-range-label" className="elevation-legend-range-group-label">
          Elevation range
        </span>

        {/* Dual slider track */}
        <div className="elevation-dual-range">
          {/* Coloured fill between the two thumbs */}
          <div className="elevation-dual-track">
            <div
              className="elevation-dual-fill"
              style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
            />
          </div>

          {/* Min thumb */}
          <input
            ref={minSliderRef}
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={STEP}
            value={displayMin}
            onChange={handleMinSliderChange}
            onKeyDown={handleMinKeyDown}
            onPointerUp={commitRange}
            onMouseUp={commitRange}
            aria-label="Minimum elevation"
            title={`Minimum elevation: ${displayMin} m. Drag, scroll wheel, or use arrow keys (±10 m) / Page Up/Down (±100 m)`}
            style={{ zIndex: minZ }}
          />

          {/* Max thumb */}
          <input
            ref={maxSliderRef}
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={STEP}
            value={displayMax}
            onChange={handleMaxSliderChange}
            onKeyDown={handleMaxKeyDown}
            onPointerUp={commitRange}
            onMouseUp={commitRange}
            aria-label="Maximum elevation"
            title={`Maximum elevation: ${displayMax} m. Drag, scroll wheel, or use arrow keys (±10 m) / Page Up/Down (±100 m)`}
            style={{ zIndex: maxZ }}
          />
        </div>

        {/* Number inputs beneath the dual slider */}
        <div className="elevation-dual-inputs">
          <span className="elevation-dual-side">
            <span className="elevation-dual-side-label">Min</span>
            <span className="elevation-legend-range-value-wrap">
              <input
                type="text"
                inputMode="numeric"
                className={`elevation-legend-range-value${inputMinError ? ' elevation-input-error' : ''}`}
                value={inputMinText !== null ? inputMinText : String(displayMin)}
                onChange={handleMinInputChange}
                onFocus={handleMinInputFocus}
                onBlur={commitMinNumber}
                onKeyDown={(e) => handleNumberKeyDown(e, commitMinNumber)}
                aria-label="Minimum elevation value"
                aria-invalid={inputMinError}
                title="Type a minimum elevation in metres, then press Enter to apply"
              />
              <span className="elevation-legend-unit">m</span>
            </span>
            {inputMinError && <span className="elevation-input-error-msg">Enter a number</span>}
          </span>
          <span className="elevation-dual-side elevation-dual-side-right">
            <span className="elevation-dual-side-label">Max</span>
            <span className="elevation-legend-range-value-wrap">
              <input
                type="text"
                inputMode="numeric"
                className={`elevation-legend-range-value${inputMaxError ? ' elevation-input-error' : ''}`}
                value={inputMaxText !== null ? inputMaxText : String(displayMax)}
                onChange={handleMaxInputChange}
                onFocus={handleMaxInputFocus}
                onBlur={commitMaxNumber}
                onKeyDown={(e) => handleNumberKeyDown(e, commitMaxNumber)}
                aria-label="Maximum elevation value"
                aria-invalid={inputMaxError}
                title="Type a maximum elevation in metres, then press Enter to apply"
              />
              <span className="elevation-legend-unit">m</span>
            </span>
            {inputMaxError && <span className="elevation-input-error-msg">Enter a number</span>}
          </span>
        </div>
        <span className="elevation-input-hint">Press Enter to apply</span>
      </div>

      <div className="elevation-legend-separator" />

      {/* Remember range checkbox */}
      <label
        className="elevation-legend-lock"
        title="Save the current Min/Max range to local storage so it is restored automatically when you next open the app"
      >
        <input
          type="checkbox"
          checked={isLocked}
          onChange={handleLockChange}
          aria-label="Remember elevation range across sessions"
        />
        Remember range
      </label>

      <div className="elevation-legend-separator" />

      {/* Opacity slider */}
      <div
        className="elevation-legend-slider"
        title="Adjust how transparent the elevation overlay is (0 % = invisible, 100 % = fully opaque)"
      >
        <span>Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={elevationOpacity}
          onChange={(e) => setElevationOpacity(parseFloat(e.target.value))}
          aria-label="Elevation layer opacity"
          title={`Elevation overlay opacity: ${Math.round(elevationOpacity * 100)} %`}
        />
        <span>{Math.round(elevationOpacity * 100)}%</span>
      </div>

    </div>
  );
}
