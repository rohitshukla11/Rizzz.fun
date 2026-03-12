'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { ChallengeCard } from '@/components/challenge/challenge-card';
import { TabGroup } from '@/components/ui/tab-group';
import { StatsBar } from '@/components/ui/stats-bar';
import { FloatingReelsBackground } from '@/components/ui/floating-reels-background';
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

const tabs = [
  { id: 'live', label: '🔴 LIVE' },
  { id: 'upcoming', label: 'UPCOMING' },
  { id: 'ended', label: 'ENDED' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('live');
  const { isConnected } = useAccount();

  const filteredChallenges = mockChallenges.filter((c) => {
    switch (activeTab) {
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
          <h1 className="font-display text-[28px] text-white">
            RIZZZ<span className="text-[#F5FF00]">.</span>
          </h1>
          <ConnectButton />
        </div>
        <div className="flex items-center justify-center pb-2">
          <span className="font-mono text-[10px] text-reel-muted uppercase">
            GASLESS · ON-CHAIN
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-[#1A1400] via-[#080808] to-[#080808] z-0" />
        
        {/* Animated floating reels background */}
        <FloatingReelsBackground />
        
        {/* Diagonal stripe decoration */}
        <div className="absolute inset-0 opacity-15 z-[3] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[#F5FF00] transform rotate-[30deg] origin-left" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-[4] text-center max-w-4xl"
        >
          <h1 className="font-display text-white uppercase leading-[0.95] mb-4" style={{ fontSize: 'clamp(48px, 10vw, 120px)' }}>
            PREDICT VIRAL REELS.
            <br />
            <span className="text-[#F5FF00]">WIN BIG.</span>
          </h1>
          <p className="font-sans text-reel-muted text-sm mb-8 max-w-2xl mx-auto">
            Stake on short videos · Early predictions earn up to 5× · Powered by Yellow Network
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Scroll to challenges section
              const challengesSection = document.getElementById('challenges-section');
              if (challengesSection) {
                challengesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                // Fallback: navigate to explore page
                window.location.href = '/explore';
              }
            }}
            className="px-8 py-4 rounded-full bg-[#F5FF00] text-black font-bold text-base hover:bg-[#F5FF00]/90 transition-colors inline-flex items-center gap-2"
          >
            START PREDICTING <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>

      {/* Live Stats Bar */}
      <StatsBar
        stats={[
          { value: '$1.2M+', label: 'VOLUME' },
          { value: '12.4K', label: 'PLAYERS' },
          { value: '847', label: 'ACTIVE NOW' },
        ]}
      />

      {/* Challenge Tabs */}
      <section className="px-4 py-6">
        <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </section>

      {/* Hot Challenges Section */}
      <section id="challenges-section" className="px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-white text-[32px] uppercase">HOT CHALLENGES</h2>
          <div className="px-3 py-1 rounded-full bg-[#F5FF00] text-black font-display text-sm font-bold">
            {filteredChallenges.length}
          </div>
        </div>

        {/* Challenge Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map((challenge, index) => (
                <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-12"
              >
                <p className="text-reel-muted font-medium text-sm">No challenges in this category</p>
                <p className="text-reel-muted/60 text-xs mt-1">Check back soon!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
