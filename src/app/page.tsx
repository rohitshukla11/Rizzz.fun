'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Clock, TrendingUp, Sparkles, Zap, ArrowRight,
  Play, Trophy, Users, Coins, Star, Wallet, Shield, Timer,
} from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { ChallengeCard } from '@/components/challenge/challenge-card';
import { useAccount } from 'wagmi';
import type { Challenge } from '@/store/app-store';

// Quick demo: 2-minute challenge
const DEMO_DURATION_MS = 2 * 60 * 1000;

// Mock data with vibrant thumbnails
const mockChallenges: Challenge[] = [
  {
    id: 'demo_5min',
    title: '⚡ 2-Min Speed Predict',
    description: 'Live demo! Pick the viral reel in 2 minutes. Early birds get up to 5x payout. Zero gas fees.',
    theme: 'demo',
    coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=400&fit=crop&q=80',
    startTime: Date.now(),
    endTime: Date.now() + DEMO_DURATION_MS,
    totalPool: 10_000_000n,
    reelCount: 4,
    participantCount: 12,
    status: 'active',
  },
  {
    id: 'challenge_001',
    title: 'Best Dance Move Challenge',
    description: 'Show us your best dance moves! The most creative and entertaining dancer wins the grand prize.',
    theme: 'dance',
    coverImage: 'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000 * 5,
    totalPool: 12_500_000n,
    reelCount: 47,
    participantCount: 312,
    status: 'active',
  },
  {
    id: 'challenge_002',
    title: 'Cooking Hacks That Actually Work',
    description: 'Share your favorite cooking tips and kitchen hacks in under 60 seconds.',
    theme: 'cooking',
    coverImage: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() - 172800000,
    endTime: Date.now() + 86400000 * 3,
    totalPool: 8_950_000n,
    reelCount: 34,
    participantCount: 198,
    status: 'active',
  },
  {
    id: 'challenge_003',
    title: 'Pet Tricks Showdown',
    description: 'Your pets deserve the spotlight! Show off their cutest and funniest tricks.',
    theme: 'pets',
    coverImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() + 86400000,
    endTime: Date.now() + 86400000 * 7,
    totalPool: 0n,
    reelCount: 0,
    participantCount: 56,
    status: 'upcoming',
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
    <div className="min-h-screen bg-reel-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-6 h-6 text-reel-primary" />
            </motion.div>
            <h1 className="font-display text-xl font-bold text-gradient">
              Rizzz.fun
            </h1>
          </div>
          <ConnectButton />
        </div>
        <div className="neon-line" />
      </header>

      {/* Compact hero banner */}
      <section className="px-4 pt-4 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-reel-card border border-reel-border/40"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-reel-primary/8 via-reel-accent/5 to-reel-secondary/8" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-reel-primary/10 rounded-full blur-[60px]" />

          <div className="relative px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded-full bg-reel-primary/15 border border-reel-primary/20 text-reel-primary text-[10px] font-bold uppercase tracking-wider">
                  Prediction Market
                </span>
                <span className="px-2 py-0.5 rounded-full bg-reel-warning/15 border border-reel-warning/20 text-reel-warning text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> Gasless
                </span>
              </div>
              <h2 className="font-display text-lg font-bold text-white leading-snug">
                Predict viral reels. <span className="text-gradient">Win big.</span>
              </h2>
              <p className="mt-1 text-reel-muted text-[11px] leading-relaxed">
                Stake on short videos · Early predictions earn up to 5× · Powered by Yellow Network
              </p>
            </div>

            {/* Compact stats */}
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {[
                { value: '$1.2M+', icon: Coins, color: 'text-reel-primary' },
                { value: '12.4K', icon: Users, color: 'text-reel-secondary' },
                { value: '847', icon: Play, color: 'text-reel-accent' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <stat.icon className={`w-3 h-3 ${stat.color}`} />
                  <span className="text-xs font-bold text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Category tabs */}
      <section className="px-4 pt-2 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-all text-xs font-medium ${
                  isActive
                    ? 'bg-reel-primary text-white shadow-lg shadow-reel-primary/20'
                    : 'bg-reel-card/60 text-reel-muted hover:text-white hover:bg-reel-card border border-reel-border/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Section header */}
      <section className="px-4 pb-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-white flex items-center gap-1.5">
            {activeCategory === 'trending' ? (
              <><Flame className="w-4 h-4 text-reel-warning" /> Hot Challenges</>
            ) : activeCategory === 'live' ? (
              <><Zap className="w-4 h-4 text-reel-success" /> Live Now</>
            ) : activeCategory === 'upcoming' ? (
              <><Clock className="w-4 h-4 text-reel-secondary" /> Coming Soon</>
            ) : (
              <><Trophy className="w-4 h-4 text-reel-accent" /> Past Winners</>
            )}
          </h3>
          <span className="text-[10px] text-reel-muted bg-reel-card/60 px-2 py-0.5 rounded-full">
            {filteredChallenges.length} found
          </span>
        </div>
      </section>

      {/* Challenges list — compact vertical layout */}
      <section className="px-4">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map((challenge, index) => (
                <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Star className="w-10 h-10 text-reel-muted/30 mx-auto mb-2" />
                <p className="text-reel-muted font-medium text-sm">No challenges in this category</p>
                <p className="text-reel-muted/60 text-xs mt-0.5">Check back soon!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Compact footer */}
      <section className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl bg-reel-card/30 border border-reel-border/15">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-reel-warning" />
            <span className="text-[10px] text-reel-muted">Yellow Network</span>
          </div>
          <div className="w-px h-3 bg-reel-border/30" />
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-reel-success" />
            <span className="text-[10px] text-reel-muted">ERC-7824</span>
          </div>
          <div className="w-px h-3 bg-reel-border/30" />
          <span className="text-[10px] text-reel-muted/60">Gasless · On-chain settlement</span>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
