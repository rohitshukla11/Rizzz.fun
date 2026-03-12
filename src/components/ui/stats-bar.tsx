'use client';

import { StatBadge } from './stat-badge';

interface StatsBarProps {
  stats: Array<{ value: string; label: string }>;
  className?: string;
}

export function StatsBar({ stats, className }: StatsBarProps) {
  return (
    <div
      className={`flex items-center gap-6 px-4 py-3 bg-reel-elevated border-t border-[#F5FF00] overflow-x-auto scrollbar-hide ${className}`}
    >
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-6 flex-shrink-0">
          <StatBadge value={stat.value} label={stat.label} />
          {index < stats.length - 1 && (
            <div className="w-px h-8 bg-[#F5FF00]/30" />
          )}
        </div>
      ))}
    </div>
  );
}
