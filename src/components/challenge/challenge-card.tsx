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
  upcoming: { color: 'bg-reel-secondary text-white', label: 'Starting Soon', icon: Clock },
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
    >
      <Link
        href={`/challenge/${challenge.id}`}
        className={cn(
          'block group relative rounded-2xl overflow-hidden transition-all duration-300 card-hover',
          isDemo
            ? 'ring-1 ring-reel-primary/40 hover:ring-reel-primary/70'
            : 'ring-1 ring-reel-border/30 hover:ring-reel-primary/40',
        )}
        prefetch={false}
      >
        {/* ── Full-bleed thumbnail ── */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {challenge.coverImage ? (
            <img
              src={challenge.coverImage}
              alt={challenge.title}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
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

          {/* Thin bottom fade — keeps image bright on top, text readable at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

          {/* Top row: status + timer */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide shadow-lg',
              status.color,
            )}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white text-[11px] font-mono shadow-lg">
              <Timer className="w-3 h-3 text-white/60" />
              {timeRemaining || '…'}
            </span>
          </div>

          {/* Reel count — bottom-right */}
          {challenge.reelCount > 0 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur shadow-lg">
              <Play className="w-3 h-3 text-white" />
              <span className="text-[11px] font-semibold text-white">{challenge.reelCount}</span>
            </div>
          )}
        </div>

        {/* ── Info bar below the image ── */}
        <div className="relative bg-reel-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[15px] font-semibold text-white truncate group-hover:text-reel-primary transition-colors">
                {challenge.title}
              </h3>
              <p className="mt-0.5 text-xs text-reel-muted line-clamp-1">
                {challenge.description}
              </p>
            </div>
            <div className="flex-shrink-0 p-1.5 rounded-full bg-reel-surface group-hover:bg-reel-primary/20 transition-colors mt-0.5">
              <ChevronRight className="w-4 h-4 text-reel-muted group-hover:text-reel-primary transition-colors" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-reel-primary/8 text-reel-primary text-xs font-medium">
              <Coins className="w-3.5 h-3.5" />
              {formatTokenAmount(challenge.totalPool, 6)} USDC
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-reel-secondary/8 text-reel-secondary text-xs font-medium">
              <Users className="w-3.5 h-3.5" />
              {challenge.participantCount}
            </span>
            {isDemo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-reel-warning/10 text-reel-warning text-xs font-bold ml-auto">
                <Flame className="w-3 h-3" /> 5× Early
              </span>
            )}
          </div>

          {/* Bottom glow line on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reel-primary via-reel-accent to-reel-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}

// Skeleton loader
export function ChallengeCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-reel-border/30">
      <div className="aspect-[16/9] skeleton" />
      <div className="bg-reel-card p-4 space-y-3">
        <div className="h-5 w-3/4 skeleton rounded" />
        <div className="h-3 w-full skeleton rounded" />
        <div className="flex gap-2.5 mt-3">
          <div className="h-7 w-24 skeleton rounded-lg" />
          <div className="h-7 w-16 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}
