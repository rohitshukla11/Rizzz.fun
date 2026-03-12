'use client';

import { cn } from '@/lib/utils';

interface StatBadgeProps {
  value: string;
  label: string;
  className?: string;
}

export function StatBadge({ value, label, className }: StatBadgeProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span className="font-display text-2xl text-white">{value}</span>
      <span className="font-sans text-[11px] text-reel-muted uppercase">{label}</span>
    </div>
  );
}
