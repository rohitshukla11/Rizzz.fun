import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) {
    return whole.toLocaleString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 2);
  return `${whole.toLocaleString()}.${fractionStr}`;
}

/**
 * Parse user input to token amount
 */
export function parseTokenAmount(input: string, decimals: number = 18): bigint {
  const [whole, fraction = ''] = input.split('.');
  const wholeNum = BigInt(whole || '0');
  const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  const fractionNum = BigInt(fractionPadded);
  
  return wholeNum * BigInt(10 ** decimals) + fractionNum;
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(endTime: number): string {
  const now = Date.now();
  const remaining = endTime - now;
  
  if (remaining <= 0) return 'Ended';
  
  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((part * 10000n) / total) / 100;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Generate gradient from hash
 */
export function generateGradientFromHash(hash: string): string {
  const colors = [
    ['#ff3d8a', '#a855f7'],
    ['#00d4ff', '#00ff88'],
    ['#ffaa00', '#ff3d8a'],
    ['#a855f7', '#00d4ff'],
    ['#00ff88', '#00d4ff'],
  ];
  
  const index = parseInt(hash.slice(2, 4), 16) % colors.length;
  const [start, end] = colors[index];
  
  return `linear-gradient(135deg, ${start}, ${end})`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
