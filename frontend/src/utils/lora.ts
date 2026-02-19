/**
 * Shared LoRa Radio Math Utilities
 * Extracted from TimeOnAirModal for reuse across components (ToA calculator, Channel Capacity Estimator).
 * Uses the standard Semtech time-on-air formula (SX1276/SX1262 datasheets).
 */

/* ---- Types ---- */

export interface ModemPresetEntry {
  id?: string;
  name?: string;
  label?: string;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: string;
}

export interface ToAResult {
  toaMs: number;
  symbolTimeMs: number;
  preambleTimeMs: number;
  payloadSymbols: number;
  payloadTimeMs: number;
  dataRateBps: number;
  maxPacketsPerHour100: number;
  maxPacketsPerHour10: number;
  mahPerPacket: number | null;
}

/* ---- Hardcoded fallback presets (mirrors AppLayout MODEM_PRESETS) ---- */

export const FALLBACK_PRESETS: Record<string, ModemPresetEntry> = {
  LongFast:       { label: 'Long Range / Fast',     spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/5' },
  LongSlow:       { label: 'Long Range / Slow',     spreading_factor: 12, bandwidth_khz: 125, coding_rate: '4/8' },
  LongModerate:   { label: 'Long Range / Moderate',  spreading_factor: 11, bandwidth_khz: 125, coding_rate: '4/8' },
  MediumSlow:     { label: 'Medium Range / Slow',    spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/8' },
  MediumFast:     { label: 'Medium Range / Fast',    spreading_factor: 9,  bandwidth_khz: 250, coding_rate: '4/5' },
  ShortSlow:      { label: 'Short Range / Slow',     spreading_factor: 8,  bandwidth_khz: 250, coding_rate: '4/5' },
  ShortFast:      { label: 'Short Range / Fast',     spreading_factor: 7,  bandwidth_khz: 250, coding_rate: '4/5' },
  ShortTurbo:     { label: 'Short Range / Turbo',    spreading_factor: 5,  bandwidth_khz: 500, coding_rate: '4/5' },
  'MeshCore-US':  { label: 'MeshCore US Preset',     spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/7' },
};

/* ---- LoRa Time-on-Air Calculation (Semtech standard) ---- */

export function parseCodingRateNum(cr: string): number {
  // '4/5' → 1, '4/6' → 2, '4/7' → 3, '4/8' → 4
  const parts = cr.split('/');
  if (parts.length === 2) {
    return parseInt(parts[1]) - 4;
  }
  return 1;
}

export function computeTimeOnAir(
  sf: number,
  bwKhz: number,
  crNum: number,
  payloadBytes: number,
  preambleLen: number,
  implicitHeader: boolean,
  crcEnabled: boolean,
  txCurrentMa?: number,
): ToAResult {
  const bwHz = bwKhz * 1000;

  // Symbol time
  const tSym = Math.pow(2, sf) / bwHz; // seconds
  const tSymMs = tSym * 1000;

  // Preamble time
  const tPreamble = (preambleLen + 4.25) * tSym;
  const preambleTimeMs = tPreamble * 1000;

  // Low data rate optimization: DE=1 if SF>=11 and BW=125kHz
  const DE = (sf >= 11 && bwKhz === 125) ? 1 : 0;
  const IH = implicitHeader ? 1 : 0;
  const CRC = crcEnabled ? 1 : 0;

  // Payload symbol count
  const numerator = 8 * payloadBytes - 4 * sf + 28 + 16 * CRC - 20 * IH;
  const denominator = 4 * (sf - 2 * DE);
  const payloadSymbols = 8 + Math.max(Math.ceil(numerator / denominator) * (crNum + 4), 0);

  // Payload time
  const tPayload = payloadSymbols * tSym;
  const payloadTimeMs = tPayload * 1000;

  // Total ToA
  const toaSeconds = tPreamble + tPayload;
  const toaMs = toaSeconds * 1000;

  // Data rate (effective bits per second)
  const dataRateBps = payloadBytes > 0 ? (payloadBytes * 8) / toaSeconds : 0;

  // Packets per hour
  const maxPacketsPerHour100 = toaMs > 0 ? Math.floor(3600000 / toaMs) : 0;
  const maxPacketsPerHour10 = toaMs > 0 ? Math.floor(360000 / toaMs) : 0;

  // Battery impact
  let mahPerPacket: number | null = null;
  if (txCurrentMa != null && txCurrentMa > 0) {
    mahPerPacket = (txCurrentMa * toaSeconds) / 3600;
  }

  return {
    toaMs,
    symbolTimeMs: tSymMs,
    preambleTimeMs,
    payloadSymbols,
    payloadTimeMs,
    dataRateBps,
    maxPacketsPerHour100,
    maxPacketsPerHour10,
    mahPerPacket,
  };
}
