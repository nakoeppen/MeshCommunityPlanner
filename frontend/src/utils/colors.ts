/**
 * Color palette utilities
 * Provides colorblind-safe color palettes and color helpers
 * Based on design.md Decision 15
 */

export type PaletteName =
  | 'default'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'monochrome'
  | 'high_contrast';

export interface ColorPalette {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export type NodeStatus = 'online' | 'offline' | 'degraded' | 'unknown';

/**
 * Colorblind-safe palettes
 * Each palette provides distinct colors that work for different types of color vision deficiency
 */
export const PALETTES: Record<PaletteName, ColorPalette> = {
  default: {
    primary: '#0066CC',      // Blue
    secondary: '#6B7280',    // Gray
    success: '#059669',      // Green
    warning: '#D97706',      // Orange
    error: '#DC2626',        // Red
    info: '#2563EB',         // Blue
  },
  deuteranopia: {
    // Red-green colorblind (most common)
    primary: '#1E40AF',      // Dark blue
    secondary: '#6B7280',    // Gray
    success: '#0891B2',      // Cyan
    warning: '#D97706',      // Orange
    error: '#7C3AED',        // Purple
    info: '#2563EB',         // Blue
  },
  protanopia: {
    // Red-blind
    primary: '#0066CC',      // Blue
    secondary: '#6B7280',    // Gray
    success: '#0891B2',      // Cyan
    warning: '#F59E0B',      // Amber
    error: '#7C3AED',        // Purple
    info: '#2563EB',         // Blue
  },
  tritanopia: {
    // Blue-yellow colorblind
    primary: '#DC2626',      // Red
    secondary: '#6B7280',    // Gray
    success: '#059669',      // Green
    warning: '#DC2626',      // Red
    error: '#7C3AED',        // Purple
    info: '#EC4899',         // Pink
  },
  monochrome: {
    // Grayscale for complete color blindness
    primary: '#000000',      // Black
    secondary: '#6B7280',    // Gray
    success: '#374151',      // Dark gray
    warning: '#9CA3AF',      // Light gray
    error: '#1F2937',        // Very dark gray
    info: '#4B5563',         // Medium gray
  },
  high_contrast: {
    // High contrast for low vision
    primary: '#0000FF',      // Pure blue
    secondary: '#808080',    // Pure gray
    success: '#00FF00',      // Pure green
    warning: '#FFFF00',      // Pure yellow
    error: '#FF0000',        // Pure red
    info: '#00FFFF',         // Pure cyan
  },
};

/**
 * Get a color palette by name
 */
export function getColorPalette(name: PaletteName = 'default'): ColorPalette {
  return PALETTES[name] || PALETTES.default;
}

/**
 * Get color for node/link status
 */
export function getStatusColor(
  status: NodeStatus,
  palette: PaletteName = 'default'
): string {
  const colors = getColorPalette(palette);
  switch (status) {
    case 'online':
      return colors.success;
    case 'offline':
      return colors.error;
    case 'degraded':
      return colors.warning;
    case 'unknown':
    default:
      return colors.info;
  }
}

/**
 * Get color based on signal strength (dBm)
 * Typical ranges:
 * - Excellent: > -70 dBm
 * - Good: -70 to -85 dBm
 * - Fair: -86 to -100 dBm
 * - Poor: < -100 dBm
 */
export function getSignalStrengthColor(
  signalDbm: number,
  palette: PaletteName = 'default'
): string {
  if (signalDbm > -70) {
    return getStatusColor('online', palette);
  } else if (signalDbm > -85) {
    return getStatusColor('online', palette);
  } else if (signalDbm >= -100) {
    return getStatusColor('degraded', palette);
  } else {
    return getStatusColor('offline', palette);
  }
}

/**
 * Get color based on link quality percentage (0-100)
 */
export function getLinkQualityColor(
  qualityPercent: number,
  palette: PaletteName = 'default'
): string {
  // Clamp to 0-100 range
  const quality = Math.max(0, Math.min(100, qualityPercent));

  if (quality >= 70) {
    return getStatusColor('online', palette);
  } else if (quality >= 40) {
    return getStatusColor('degraded', palette);
  } else {
    return getStatusColor('offline', palette);
  }
}
