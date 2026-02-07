'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Coins, TrendingUp, ChevronRight, Play, Flame, Timer, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn, formatTokenAmount, formatTimeRemaining } from '@/lib/utils';
import type { Challenge } from '@/store/app-store';

interface ChallengeCardProps {
  challenge: Challenge;
  index?: number;
}

const statusConfig = {
  upcoming: { color: 'bg-reel-secondary text-white', label: 'Soon', icon: Clock },
  active: { color: 'bg-reel-success text-black', label: 'Live', icon: Zap },
  voting: { color: 'bg-reel-warning text-black', label: 'Voting', icon: Flame },
  settled: { color: 'bg-reel-muted/60 text-white', label: 'Ended', icon: TrendingUp },
};

export function ChallengeCard({ challenge, index = 0 }: ChallengeCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTime = () => setTimeRemaining(formatTimeRemaining(challenge.endTime));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [challenge.endTime]);

  const status = statusConfig[challenge.status];
  const StatusIcon = status.icon;
  const isDemo = challenge.id.includes('demo');

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Link
        href={`/challenge/${challenge.id}`}
        className={cn(
          'flex gap-3 p-2.5 rounded-xl group transition-all duration-200 card-hover',
          isDemo
            ? 'bg-reel-card ring-1 ring-reel-primary/30 hover:ring-reel-primary/60'
            : 'bg-reel-card/60 ring-1 ring-reel-border/20 hover:ring-reel-primary/40 hover:bg-reel-card',
        )}
        prefetch={false}
      >
        {/* Thumbnail — compact square */}
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
          {challenge.coverImage ? (
            <img
              src={challenge.coverImage}
              alt={challenge.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, 
                  hsl(${(index * 80 + 200) % 360}, 75%, 45%), 
                  hsl(${(index * 80 + 260) % 360}, 75%, 30%))`,
              }}
            />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

          {/* Reel count badge */}
          {challenge.reelCount > 0 && (
            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
              <Play className="w-2.5 h-2.5 text-white" />
              <span className="text-[9px] font-bold text-white">{challenge.reelCount}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Top: title + status */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-display text-sm font-semibold text-white truncate group-hover:text-reel-primary transition-colors">
                {challenge.title}
              </h3>
            </div>
            <p className="text-[11px] text-reel-muted truncate leading-tight">
              {challenge.description}
            </p>
          </div>

          {/* Bottom: stats row */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide',
              status.color,
            )}>
              <StatusIcon className="w-2.5 h-2.5" />
              {status.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-reel-primary font-medium">
              <Coins className="w-3 h-3" />
              {formatTokenAmount(challenge.totalPool, 6)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-reel-muted font-medium">
              <Users className="w-3 h-3" />
              {challenge.participantCount}
            </span>
            {isDemo && (
              <span className="flex items-center gap-0.5 text-[9px] text-reel-warning font-bold ml-auto">
                <Flame className="w-2.5 h-2.5" /> 5×
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px] text-reel-muted/70 font-mono ml-auto">
              <Timer className="w-2.5 h-2.5" />
              {timeRemaining || '…'}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <div className="flex items-center flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-reel-muted/40 group-hover:text-reel-primary transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}

// Skeleton loader
export function ChallengeCardSkeleton() {
  return (
    <div className="flex gap-3 p-2.5 rounded-xl bg-reel-card/40 ring-1 ring-reel-border/20">
      <div className="w-20 h-20 rounded-lg skeleton flex-shrink-0" />
      <div className="flex-1 flex flex-col justify-between py-0.5">
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 skeleton rounded" />
          <div className="h-3 w-full skeleton rounded" />
        </div>
        <div className="flex gap-2 mt-1.5">
          <div className="h-5 w-12 skeleton rounded-full" />
          <div className="h-5 w-16 skeleton rounded-full" />
          <div className="h-5 w-10 skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
}
