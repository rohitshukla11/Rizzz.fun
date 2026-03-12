'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Coins, Eye } from 'lucide-react';
import Link from 'next/link';
import { cn, formatTokenAmount, formatTimeRemaining } from '@/lib/utils';
import { LiveBadge } from '@/components/ui/live-badge';
import { MultiplierBadge } from '@/components/ui/multiplier-badge';
import type { Challenge } from '@/store/app-store';

interface ChallengeCardProps {
  challenge: Challenge;
  index?: number;
}

const statusConfig = {
  upcoming: { color: 'bg-[#00E5FF]', label: 'SOON' },
  active: { color: 'bg-[#FF4D4D]', label: 'LIVE' },
  voting: { color: 'bg-[#FF4D4D]', label: 'LIVE' },
  settled: { color: 'bg-reel-muted', label: 'ENDED' },
};

export function ChallengeCard({ challenge, index = 0 }: ChallengeCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const isLive = challenge.status === 'active' || challenge.status === 'voting';
  const isUpcoming = challenge.status === 'upcoming';

  useEffect(() => {
    const updateTime = () => setTimeRemaining(formatTimeRemaining(challenge.endTime));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [challenge.endTime]);

  const status = statusConfig[challenge.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link
        href={`/challenge/${challenge.id}`}
        className="block group"
        prefetch={false}
      >
        <div className="relative rounded-2xl overflow-hidden bg-reel-surface border border-reel-border card-hover">
          {/* Thumbnail */}
          <div className="relative aspect-[16/9] overflow-hidden">
            {challenge.coverImage ? (
              <img
                src={challenge.coverImage}
                alt={challenge.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg, 
                    hsl(${(index * 60) % 360}, 70%, 25%), 
                    hsl(${(index * 60 + 120) % 360}, 70%, 15%))`,
                }}
              />
            )}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Top-left badge */}
            <div className="absolute top-3 left-3">
              {isLive ? (
                <LiveBadge size="sm" />
              ) : isUpcoming ? (
                <div className="px-2 py-0.5 rounded-full bg-[#00E5FF] text-white font-mono text-[10px] font-bold uppercase">
                  SOON
                </div>
              ) : null}
            </div>

            {/* Top-right participant count */}
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
              <Eye className="w-3 h-3 text-white" />
              <span className="text-[10px] font-mono text-white">{challenge.participantCount}</span>
            </div>

            {/* Bottom-left multiplier badge */}
            <div className="absolute bottom-3 left-3">
              <MultiplierBadge multiplier="5" />
            </div>
          </div>

          {/* Card body */}
          <div className="p-4">
            <h3 className="font-sans text-[15px] font-semibold text-white line-clamp-2 mb-2">
              {challenge.title}
            </h3>
            <p className="font-sans text-[13px] text-reel-muted line-clamp-2 mb-3">
              {challenge.description}
            </p>

            {/* Footer row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#F5FF00]" />
                <span className="font-mono text-[#F5FF00] text-xs font-semibold">
                  {formatTokenAmount(challenge.totalPool, 6)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-reel-muted" />
                <span className="font-mono text-reel-muted text-xs">
                  {timeRemaining || '…'}
                </span>
              </div>
            </div>

            {/* Predict button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `/challenge/${challenge.id}`;
              }}
              className="w-full mt-3 py-2.5 rounded-lg border border-[#F5FF00] text-[#F5FF00] bg-transparent hover:bg-[#F5FF00] hover:text-black font-semibold text-sm transition-all duration-200"
            >
              PREDICT
            </motion.button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Skeleton loader
export function ChallengeCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-reel-surface border border-reel-border">
      <div className="aspect-[16/9] skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="h-3 w-full skeleton rounded" />
        <div className="flex justify-between">
          <div className="h-4 w-20 skeleton rounded" />
          <div className="h-4 w-16 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}
