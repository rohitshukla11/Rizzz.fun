'use client';

import { cn } from '@/lib/utils';

interface MultiplierBadgeProps {
  multiplier: string;
  className?: string;
}

export function MultiplierBadge({ multiplier, className }: MultiplierBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F5FF00] text-black font-display font-bold text-base',
        className
      )}
    >
      UP TO {multiplier}×
    </div>
  );
}
