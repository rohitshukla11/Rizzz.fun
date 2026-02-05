'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, TrendingUp, Sparkles, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { ChallengeCard, ChallengeCardSkeleton } from '@/components/challenge/challenge-card';
import { Button } from '@/components/ui/button';
import { useAccount } from 'wagmi';
import type { Challenge } from '@/store/app-store';

// Mock data for demo
const mockChallenges: Challenge[] = [
  {
    id: 'challenge_001',
    title: 'Best Dance Move Challenge',
    description: 'Show us your best dance moves! The most creative dancer wins.',
    theme: 'dance',
    coverImage: '',
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000 * 5,
    totalPool: 125000n * 10n ** 18n,
    reelCount: 47,
    participantCount: 312,
    status: 'active',
  },
  {
    id: 'challenge_002',
    title: 'Cooking Hacks That Actually Work',
    description: 'Share your favorite cooking tips and kitchen hacks in under 60 seconds.',
    theme: 'cooking',
    coverImage: '',
    startTime: Date.now() - 172800000,
    endTime: Date.now() + 86400000 * 3,
    totalPool: 89500n * 10n ** 18n,
    reelCount: 34,
    participantCount: 198,
    status: 'active',
  },
  {
    id: 'challenge_003',
    title: 'Pet Tricks Showdown',
    description: 'Your pets deserve the spotlight! Show off their best tricks.',
    theme: 'pets',
    coverImage: '',
    startTime: Date.now() + 86400000,
    endTime: Date.now() + 86400000 * 7,
    totalPool: 0n,
    reelCount: 0,
    participantCount: 56,
    status: 'upcoming',
  },
  {
    id: 'challenge_004',
    title: 'Sunset Time-lapse',
    description: 'Capture the most beautiful sunset in your area.',
    theme: 'photography',
    coverImage: '',
    startTime: Date.now() - 604800000,
    endTime: Date.now() - 86400000,
    totalPool: 234000n * 10n ** 18n,
    reelCount: 89,
    participantCount: 521,
    status: 'settled',
    winnerReelId: 'reel_winner_001',
  },
];

const categories = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'live', label: 'Live Now', icon: Zap },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'ended', label: 'Ended', icon: TrendingUp },
];

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('trending');
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();

  const filteredChallenges = mockChallenges.filter((c) => {
    switch (activeCategory) {
      case 'live':
        return c.status === 'active' || c.status === 'voting';
      case 'upcoming':
        return c.status === 'upcoming';
      case 'ended':
        return c.status === 'settled';
      default:
        return true;
    }
  });

  return (
    <div className="min-h-screen bg-reel-bg pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 10 }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            >
              <Sparkles className="w-6 h-6 text-reel-primary" />
            </motion.div>
            <h1 className="font-display text-xl font-bold text-gradient">
              Rizzz.fun
            </h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Hero section */}
      <section className="px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-reel-primary/20 via-reel-accent/10 to-reel-secondary/20 p-6 border border-reel-border"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-reel-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-reel-secondary/20 rounded-full blur-2xl" />
          
          <div className="relative">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
              Predict viral reels.<br />
              <span className="text-gradient">Win big rewards.</span>
            </h2>
            <p className="mt-3 text-reel-muted max-w-sm">
              Instant predictions powered by Yellow Network. No gas fees, no waiting.
            </p>
            
            <div className="mt-5 flex flex-wrap gap-3">
              {!isConnected ? (
                <Button variant="default" size="lg">
                  <Zap className="w-5 h-5" />
                  Get Started
                </Button>
              ) : (
                <Link href="/challenge/challenge_001" className="inline-block">
                  <Button variant="default" size="lg">
                    Start Predicting
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="mt-6 flex gap-6">
              <div>
                <p className="text-2xl font-display font-bold text-white">$1.2M+</p>
                <p className="text-xs text-reel-muted">Total Predicted</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">12.4K</p>
                <p className="text-xs text-reel-muted">Predictors</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">847</p>
                <p className="text-xs text-reel-muted">Reels</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Category tabs */}
      <section className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-reel-primary text-white'
                    : 'bg-reel-card text-reel-muted hover:bg-reel-card/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Challenges grid */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-white">
            {activeCategory === 'trending' ? 'Hot Challenges' :
             activeCategory === 'live' ? 'Live Now' :
             activeCategory === 'upcoming' ? 'Coming Soon' : 'Past Winners'}
          </h3>
          <Link href="/explore" className="text-sm text-reel-primary hover:text-reel-primary/80">
            View All
          </Link>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <ChallengeCardSkeleton key={i} />
            ))
          ) : filteredChallenges.length > 0 ? (
            filteredChallenges.map((challenge, index) => (
              <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-reel-muted">No challenges found</p>
            </div>
          )}
        </div>
      </section>

      {/* Yellow Network badge */}
      <section className="px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-2 text-reel-muted"
        >
          <Zap className="w-4 h-4 text-reel-warning" />
          <span className="text-xs">Powered by Yellow Network • Instant & Gasless</span>
        </motion.div>
      </section>

      <BottomNav />
    </div>
  );
}
