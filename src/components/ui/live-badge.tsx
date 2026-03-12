'use client';

import { cn } from '@/lib/utils';

interface LiveBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LiveBadge({ className, size = 'md' }: LiveBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-[10px]',
    lg: 'px-3 py-1.5 text-xs',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[#FF4D4D] text-white font-mono font-bold uppercase',
        sizeClasses[size],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse" />
      LIVE
    </div>
  );
}
