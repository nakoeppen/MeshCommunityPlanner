/**
 * Unit conversion utilities
 * Handles conversions between metric and imperial units
 */

// Conversion constants
const METERS_TO_FEET = 3.28084;
const METERS_TO_MILES = 0.000621371;
const FEET_TO_METERS = 0.3048;
const MILES_TO_METERS = 1609.34;
const METERS_TO_KILOMETERS = 0.001;
const KILOMETERS_TO_METERS = 1000;
const METERS_TO_CENTIMETERS = 100;
const CENTIMETERS_TO_METERS = 0.01;

export type UnitSystem = 'metric' | 'imperial';

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

/**
 * Convert feet to meters
 */
export function feetToMeters(feet: number): number {
  return feet * FEET_TO_METERS;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * METERS_TO_MILES;
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS;
}

/**
 * Convert meters to kilometers
 */
export function metersToKilometers(meters: number): number {
  return meters * METERS_TO_KILOMETERS;
}

/**
 * Convert kilometers to meters
 */
export function kilometersToMeters(kilometers: number): number {
  return kilometers * KILOMETERS_TO_METERS;
}

/**
 * Convert meters to centimeters
 */
export function metersToCentimeters(meters: number): number {
  return meters * METERS_TO_CENTIMETERS;
}

/**
 * Convert centimeters to meters
 */
export function centimetersToMeters(centimeters: number): number {
  return centimeters * CENTIMETERS_TO_METERS;
}

/**
 * Format distance in appropriate units
 * - Metric: meters for < 1km, kilometers for >= 1km
 * - Imperial: feet for < 1000ft, miles for >= 1000ft
 */
export function formatDistance(meters: number, system: UnitSystem = 'metric'): string {
  if (system === 'metric') {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      const km = metersToKilometers(meters);
      return `${km.toFixed(1)} km`;
    }
  } else {
    // Use 1 mile threshold (1609.34 meters)
    if (meters >= 1609) {
      const miles = metersToMiles(meters);
      return `${miles.toFixed(1)} mi`;
    } else {
      const feet = metersToFeet(meters);
      return `${Math.round(feet).toLocaleString()} ft`;
    }
  }
}

/**
 * Format height/elevation in appropriate units
 */
export function formatHeight(meters: number, system: UnitSystem = 'metric'): string {
  if (system === 'metric') {
    return `${meters.toFixed(1)} m`;
  } else {
    const feet = metersToFeet(meters);
    return `${feet.toFixed(1)} ft`;
  }
}
