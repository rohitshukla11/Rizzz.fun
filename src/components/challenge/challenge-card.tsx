'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Coins, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn, formatTokenAmount, formatTimeRemaining } from '@/lib/utils';
import type { Challenge } from '@/store/app-store';

interface ChallengeCardProps {
  challenge: Challenge;
  index?: number;
}

const statusColors = {
  upcoming: 'bg-reel-secondary/20 text-reel-secondary border-reel-secondary/30',
  active: 'bg-reel-success/20 text-reel-success border-reel-success/30',
  voting: 'bg-reel-warning/20 text-reel-warning border-reel-warning/30',
  settled: 'bg-reel-muted/20 text-reel-muted border-reel-muted/30',
};

const statusLabels = {
  upcoming: 'Starting Soon',
  active: 'Live Now',
  voting: 'Voting Open',
  settled: 'Ended',
};

export function ChallengeCard({ challenge, index = 0 }: ChallengeCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('');

  // Client-side only time calculation to prevent hydration mismatch
  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(formatTimeRemaining(challenge.endTime));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [challenge.endTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Link 
        href={`/challenge/${challenge.id}`}
        className="block group relative overflow-hidden rounded-2xl bg-reel-card border border-reel-border hover:border-reel-primary/50 transition-all duration-300"
        prefetch={false}
      >
          {/* Background gradient overlay */}
          <div 
            className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity"
            style={{
              background: `linear-gradient(135deg, rgba(255, 61, 138, 0.2), rgba(168, 85, 247, 0.2))`,
            }}
          />
          
          {/* Cover image area */}
          <div className="relative h-32 overflow-hidden">
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
                    hsl(${(index * 60) % 360}, 80%, 50%), 
                    hsl(${(index * 60 + 60) % 360}, 80%, 40%)
                  )`,
                }}
              />
            )}
            
            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <span className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold border',
                statusColors[challenge.status]
              )}>
                {statusLabels[challenge.status]}
              </span>
            </div>
            
            {/* Time remaining */}
            <div className="absolute top-3 right-3 glass-strong rounded-lg px-2 py-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-reel-muted" />
              <span className="text-xs font-mono text-white">
                {timeRemaining || 'Loading...'}
              </span>
            </div>
          </div>
          
          {/* Content */}
          <div className="relative p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-semibold text-white truncate group-hover:text-reel-primary transition-colors">
                  {challenge.title}
                </h3>
                <p className="mt-1 text-sm text-reel-muted line-clamp-2">
                  {challenge.description}
                </p>
              </div>
              <div className="flex-shrink-0 p-2 rounded-full bg-reel-surface group-hover:bg-reel-primary/20 transition-colors">
                <ChevronRight className="w-5 h-5 text-reel-muted group-hover:text-reel-primary transition-colors" />
              </div>
            </div>
            
            {/* Stats row */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-lg bg-reel-primary/10">
                  <Coins className="w-3.5 h-3.5 text-reel-primary" />
                </div>
                <span className="text-reel-muted">Pool:</span>
                <span className="font-mono font-medium text-white">
                  {formatTokenAmount(challenge.totalPool)}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-lg bg-reel-secondary/10">
                  <Users className="w-3.5 h-3.5 text-reel-secondary" />
                </div>
                <span className="text-reel-muted">{challenge.participantCount}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-lg bg-reel-accent/10">
                  <TrendingUp className="w-3.5 h-3.5 text-reel-accent" />
                </div>
                <span className="text-reel-muted">{challenge.reelCount} reels</span>
              </div>
            </div>
          </div>
          
          {/* Bottom gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-reel-primary via-reel-accent to-reel-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </motion.div>
  );
}

// Skeleton loader for challenge cards
export function ChallengeCardSkeleton() {
  return (
    <div className="rounded-2xl bg-reel-card border border-reel-border overflow-hidden animate-pulse">
      <div className="h-32 skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="flex gap-4 mt-4">
          <div className="h-6 w-20 skeleton rounded" />
          <div className="h-6 w-12 skeleton rounded" />
          <div className="h-6 w-16 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}
