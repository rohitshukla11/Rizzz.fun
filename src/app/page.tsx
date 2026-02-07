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

const HOW_IT_WORKS = [
  {
    icon: Wallet,
    title: 'Deposit Once',
    desc: 'Fund your session with USDC. One transaction opens your channel.',
    color: 'text-reel-secondary',
    bg: 'bg-reel-secondary/10',
    border: 'border-reel-secondary/20',
  },
  {
    icon: Zap,
    title: 'Predict Instantly',
    desc: 'Place unlimited gasless predictions. Early bids earn up to 5× multiplier.',
    color: 'text-reel-primary',
    bg: 'bg-reel-primary/10',
    border: 'border-reel-primary/20',
  },
  {
    icon: Trophy,
    title: 'Win & Settle',
    desc: 'When the challenge ends, payouts are settled on-chain automatically.',
    color: 'text-reel-warning',
    bg: 'bg-reel-warning/10',
    border: 'border-reel-warning/20',
  },
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

      {/* Hero — General App Description */}
      <section className="px-4 pt-6 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-reel-card border border-reel-border/40"
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-reel-primary/8 via-reel-accent/5 to-reel-secondary/8" />
          <div className="absolute top-0 right-0 w-56 h-56 bg-reel-primary/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-reel-secondary/10 rounded-full blur-[60px]" />

          <div className="relative p-6">
            {/* Tagline */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-reel-primary/15 border border-reel-primary/20 text-reel-primary text-[11px] font-bold uppercase tracking-wider">
                Prediction Market
              </span>
              <span className="px-3 py-1 rounded-full bg-reel-warning/15 border border-reel-warning/20 text-reel-warning text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> Gasless
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
              Predict viral reels.
              <br />
              <span className="text-gradient">Win big rewards.</span>
            </h2>

            <p className="mt-3 text-reel-muted text-sm max-w-md leading-relaxed">
              Stake on which short video will go viral. Early predictions earn higher multipliers.
              Powered by <span className="text-reel-warning font-medium">Yellow Network</span> — instant, gasless, and settled on-chain.
            </p>

            {/* Stats */}
            <div className="mt-5 flex items-center gap-5">
              {[
                { label: 'Total Predicted', value: '$1.2M+', icon: Coins },
                { label: 'Predictors', value: '12.4K', icon: Users },
                { label: 'Challenges', value: '847', icon: Play },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <stat.icon className="w-4 h-4 text-reel-muted/60" />
                  <div>
                    <p className="text-lg font-display font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] text-reel-muted">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-3 gap-2.5">
          {HOW_IT_WORKS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`p-3 rounded-xl ${step.bg} border ${step.border} text-center`}
            >
              <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center mx-auto mb-2`}>
                <step.icon className={`w-4 h-4 ${step.color}`} />
              </div>
              <p className={`text-xs font-semibold ${step.color}`}>{step.title}</p>
              <p className="text-[10px] text-reel-muted mt-0.5 leading-tight">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Category tabs */}
      <section className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-reel-primary text-white shadow-lg shadow-reel-primary/20'
                    : 'bg-reel-card/60 text-reel-muted hover:text-white hover:bg-reel-card border border-reel-border/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Challenges grid */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            {activeCategory === 'trending' ? (
              <><Flame className="w-5 h-5 text-reel-warning" /> Hot Challenges</>
            ) : activeCategory === 'live' ? (
              <><Zap className="w-5 h-5 text-reel-success" /> Live Now</>
            ) : activeCategory === 'upcoming' ? (
              <><Clock className="w-5 h-5 text-reel-secondary" /> Coming Soon</>
            ) : (
              <><Trophy className="w-5 h-5 text-reel-accent" /> Past Winners</>
            )}
          </h3>
          <span className="text-xs text-reel-muted bg-reel-card/60 px-3 py-1 rounded-full">
            {filteredChallenges.length} found
          </span>
        </div>

        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map((challenge, index) => (
                <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Star className="w-12 h-12 text-reel-muted/30 mx-auto mb-3" />
                <p className="text-reel-muted font-medium">No challenges in this category</p>
                <p className="text-reel-muted/60 text-sm mt-1">Check back soon!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Powered by Yellow Network */}
      <section className="px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-reel-card/30 border border-reel-border/20"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-reel-warning/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-reel-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">Powered by Yellow Network</p>
              <p className="text-[10px] text-reel-muted">Instant off-chain predictions · On-chain settlement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-reel-success/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-reel-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">Secured by ERC-7824</p>
              <p className="text-[10px] text-reel-muted">State channels · Smart contracts</p>
            </div>
          </div>
        </motion.div>
      </section>

      <BottomNav />
    </div>
  );
}
