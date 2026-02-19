/**
 * Free Space Path Loss (FSPL) calculations
 * Pure math functions for client-side RF propagation estimates
 * Based on design.md Decision 2
 */

import type { RegionCode } from '../types';

/**
 * Get center frequency in MHz for a region code
 */
export function getFrequencyMHz(region: RegionCode): number {
  switch (region) {
    case 'us_fcc':
      return 915;
    case 'eu_868':
      return 868;
    case 'eu_433':
      return 433;
    case 'anz':
      return 915;
    default:
      return 915;  // Default to 915 MHz
  }
}

/**
 * Calculate Free Space Path Loss (FSPL) in dB
 * Formula: FSPL(dB) = 20*log10(d) + 20*log10(f) + 32.44
 * where:
 *   d = distance in kilometers
 *   f = frequency in MHz
 *
 * @param distanceMeters - Distance in meters
 * @param region - Region code for frequency
 * @param customFrequencyMHz - Optional custom frequency (overrides region)
 * @returns Path loss in dB
 */
export function calculateFSPL(
  distanceMeters: number,
  region: RegionCode,
  customFrequencyMHz?: number
): number {
  const distanceKm = distanceMeters / 1000;
  const frequencyMHz = customFrequencyMHz || getFrequencyMHz(region);

  if (distanceKm <= 0) {
    return -Infinity;
  }

  // FSPL(dB) = 20*log10(d) + 20*log10(f) + 32.44
  const fspl =
    20 * Math.log10(distanceKm) +
    20 * Math.log10(frequencyMHz) +
    32.44;

  return fspl;
}

/**
 * Calculate maximum link distance based on link budget
 * Solves FSPL formula for distance
 *
 * @param txPowerDbm - Transmit power in dBm
 * @param rxSensitivityDbm - Receiver sensitivity in dBm (negative value)
 * @param txAntennaGainDbi - TX antenna gain in dBi
 * @param rxAntennaGainDbi - RX antenna gain in dBi
 * @param region - Region code for frequency
 * @param customFrequencyMHz - Optional custom frequency
 * @returns Maximum distance in meters
 */
export function calculateMaxDistance(
  txPowerDbm: number,
  rxSensitivityDbm: number,
  txAntennaGainDbi: number,
  rxAntennaGainDbi: number,
  region: RegionCode,
  customFrequencyMHz?: number
): number {
  const frequencyMHz = customFrequencyMHz || getFrequencyMHz(region);

  // Link budget = TX Power + TX Gain + RX Gain - RX Sensitivity
  const linkBudgetDb =
    txPowerDbm +
    txAntennaGainDbi +
    rxAntennaGainDbi -
    rxSensitivityDbm;

  // Solve FSPL formula for distance:
  // FSPL = 20*log10(d) + 20*log10(f) + 32.44
  // linkBudget = 20*log10(d) + 20*log10(f) + 32.44
  // 20*log10(d) = linkBudget - 20*log10(f) - 32.44
  // log10(d) = (linkBudget - 20*log10(f) - 32.44) / 20
  // d = 10^((linkBudget - 20*log10(f) - 32.44) / 20)

  const distanceKm = Math.pow(
    10,
    (linkBudgetDb - 20 * Math.log10(frequencyMHz) - 32.44) / 20
  );

  return distanceKm * 1000;  // Convert to meters
}

/**
 * Calculate received power at a given distance
 *
 * @param txPowerDbm - Transmit power in dBm
 * @param txAntennaGainDbi - TX antenna gain in dBi
 * @param rxAntennaGainDbi - RX antenna gain in dBi
 * @param distanceMeters - Distance in meters
 * @param region - Region code for frequency
 * @param customFrequencyMHz - Optional custom frequency
 * @returns Received power in dBm
 */
export function calculateReceivedPower(
  txPowerDbm: number,
  txAntennaGainDbi: number,
  rxAntennaGainDbi: number,
  distanceMeters: number,
  region: RegionCode,
  customFrequencyMHz?: number
): number {
  const fspl = calculateFSPL(distanceMeters, region, customFrequencyMHz);

  // RX Power = TX Power + TX Gain + RX Gain - Path Loss
  const rxPowerDbm =
    txPowerDbm +
    txAntennaGainDbi +
    rxAntennaGainDbi -
    fspl;

  return rxPowerDbm;
}
