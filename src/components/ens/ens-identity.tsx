'use client';

/**
 * ENS Identity Components
 *
 * Displays an Ethereum address with its ENS name and avatar.
 * Falls back to a truncated address + generated avatar when no ENS is found.
 */

import { memo } from 'react';
import { useENSIdentity, formatENSOrAddress } from '@/lib/ens';
import { cn } from '@/lib/utils';

// ── ENSAvatar ──

interface ENSAvatarProps {
  address?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
} as const;

export const ENSAvatar = memo(function ENSAvatar({
  address,
  size = 'md',
  className,
}: ENSAvatarProps) {
  const { avatar, name } = useENSIdentity(address);

  const sizeClass = SIZE_MAP[size];

  // Generate color from address
  const bgColor = address
    ? `hsl(${parseInt(address.slice(2, 8), 16) % 360}, 70%, 50%)`
    : '#666';

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || address || 'Avatar'}
        className={cn(
          sizeClass,
          'rounded-full object-cover border-2 border-black',
          className,
        )}
      />
    );
  }

  // Fallback: colored circle with initials
  const initials = name
    ? name.slice(0, 2).toUpperCase()
    : (address || '0x').slice(2, 4).toUpperCase();

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full flex items-center justify-center font-bold text-white border-2 border-black',
        className,
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );
});

// ── ENSName ──

interface ENSNameProps {
  address?: string;
  /** How many chars to show in truncated address */
  chars?: number;
  className?: string;
  /** Show loading skeleton */
  showLoading?: boolean;
  /** Include a small avatar before the name */
  withAvatar?: boolean;
  avatarSize?: 'xs' | 'sm' | 'md';
}

export const ENSName = memo(function ENSName({
  address,
  chars = 4,
  className,
  showLoading = true,
  withAvatar = false,
  avatarSize = 'xs',
}: ENSNameProps) {
  const { name, isLoading } = useENSIdentity(address);

  if (!address) return null;

  if (isLoading && showLoading) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        {withAvatar && (
          <span className={cn(SIZE_MAP[avatarSize], 'rounded-full bg-gray-300 animate-pulse')} />
        )}
        <span className="inline-block h-4 w-20 bg-gray-300 rounded animate-pulse" />
      </span>
    );
  }

  const displayName = formatENSOrAddress(name, address, chars);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        name ? 'font-medium' : 'font-mono',
        className,
      )}
      title={address}
    >
      {withAvatar && <ENSAvatar address={address} size={avatarSize} />}
      {displayName}
    </span>
  );
});

// ── ENSBadge ──
// A neubrutalist badge showing ENS name with avatar, or truncated address.

interface ENSBadgeProps {
  address?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const ENSBadge = memo(function ENSBadge({
  address,
  className,
  size = 'sm',
}: ENSBadgeProps) {
  const { name, avatar, isLoading } = useENSIdentity(address);

  if (!address) return null;

  const displayName = formatENSOrAddress(name, address, 4);
  const isSmall = size === 'sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 border-2 border-black bg-white text-black font-bold',
        isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        'shadow-brutal-sm',
        className,
      )}
    >
      {isLoading ? (
        <span className="animate-pulse bg-gray-300 rounded-full w-4 h-4" />
      ) : (
        <ENSAvatar address={address} size="xs" className="border-[1px]" />
      )}
      <span className={name ? 'font-bold' : 'font-mono'}>{displayName}</span>
    </div>
  );
});

// ── ENSSearchInput ──
// Resolves ENS names as you type, then returns the resolved address.

interface ENSSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onResolved?: (address: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function ENSSearchInput({
  value,
  onChange,
  onResolved,
  placeholder = 'Search by ENS name or address...',
  className,
}: ENSSearchInputProps) {
  const isENS = value.includes('.');
  // Dynamic import to avoid circular deps
  const { useENSAddress } = require('@/lib/ens');
  const { address: resolved, isLoading } = useENSAddress(isENS ? value : undefined);

  // Notify parent when resolved
  if (onResolved) {
    if (isENS && resolved) {
      onResolved(resolved);
    } else if (!isENS && value.startsWith('0x') && value.length === 42) {
      onResolved(value);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 pr-10 border-3 border-black bg-white text-black font-mono placeholder:text-gray-400 focus:outline-none focus:shadow-brutal transition-shadow"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isENS && resolved && !isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-xs">
          ✓
        </div>
      )}
    </div>
  );
}
