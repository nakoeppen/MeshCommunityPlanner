/**
 * Formatting utilities
 * Common formatting functions used across components
 */

/**
 * Format number with thousand separators
 * @example formatNumber(1234) => "1,234"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format currency (USD)
 * @example formatCurrency(123.45) => "$123.45"
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format percentage
 * @example formatPercentage(0.75) => "75%"
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format distance based on units preference
 * @example formatDistance(5.5, 'metric') => "5.5 km"
 */
export function formatDistance(
  distance: number,
  units: 'metric' | 'imperial'
): string {
  if (units === 'imperial') {
    const miles = distance * 0.621371;
    return `${miles.toFixed(2)} mi`;
  }
  return `${distance.toFixed(2)} km`;
}

/**
 * Format file size
 * @example formatFileSize(1536) => "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format date/time
 * @example formatDateTime(new Date()) => "2024-01-15 14:30"
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time only
 * @example formatTime(new Date()) => "14:30:45"
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}
