'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Flame } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { ChallengeCard } from '@/components/challenge/challenge-card';
import type { Challenge } from '@/store/app-store';

const allChallenges: Challenge[] = [
  {
    id: 'challenge_001',
    title: 'Best Dance Move Challenge',
    description: 'Show us your best dance moves!',
    theme: 'dance',
    coverImage: 'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000 * 5,
    totalPool: 125000n * 10n ** 18n,
    reelCount: 47,
    participantCount: 312,
    status: 'active',
  },
  {
    id: 'challenge_002',
    title: 'Cooking Hacks',
    description: 'Share your favorite cooking tips.',
    theme: 'cooking',
    coverImage: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&h=400&fit=crop&q=80',
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
    description: 'Your pets deserve the spotlight!',
    theme: 'pets',
    coverImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=400&fit=crop&q=80',
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
    description: 'Capture beautiful sunsets.',
    theme: 'photography',
    coverImage: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() - 604800000,
    endTime: Date.now() - 86400000,
    totalPool: 234000n * 10n ** 18n,
    reelCount: 89,
    participantCount: 521,
    status: 'settled',
  },
  {
    id: 'challenge_005',
    title: 'Workout Motivation',
    description: 'Show your fitness journey!',
    theme: 'fitness',
    coverImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop&q=80',
    startTime: Date.now() - 43200000,
    endTime: Date.now() + 86400000 * 4,
    totalPool: 67000n * 10n ** 18n,
    reelCount: 28,
    participantCount: 145,
    status: 'active',
  },
];

const themes = ['ALL', 'DANCE', 'COOKING', 'PETS', 'PHOTOGRAPHY', 'FITNESS', 'COMEDY', 'MUSIC', 'TECH', 'GAMING'];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('ALL');

  const filteredChallenges = allChallenges.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTheme = selectedTheme === 'ALL' || 
                        c.theme.toLowerCase() === selectedTheme.toLowerCase();
    return matchesSearch && matchesTheme;
  });

  const trendingChallenges = allChallenges.filter(c => c.status === 'active').slice(0, 5);

  return (
    <div className="min-h-screen bg-reel-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-display text-[28px] text-white">
            EXPLORE<span className="text-[#F5FF00]">.</span>
          </h1>
          <ConnectButton />
        </div>
      </header>

      {/* Search bar */}
      <section className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#F5FF00]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search challenges..."
            className="w-full h-12 pl-12 pr-12 rounded-xl bg-reel-surface border border-reel-border focus:border-[#F5FF00] focus:ring-2 focus:ring-[#F5FF00]/20 outline-none text-white placeholder:text-reel-muted transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="w-5 h-5 text-reel-muted hover:text-white transition-colors" />
            </button>
          )}
        </div>
      </section>

      {/* Filter chips */}
      <section className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {themes.map((theme) => (
            <button
              key={theme}
              onClick={() => setSelectedTheme(theme)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                selectedTheme === theme
                  ? 'bg-[#F5FF00] text-black'
                  : 'bg-reel-elevated text-reel-muted hover:text-white'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      {/* Trending Now Carousel */}
      {trendingChallenges.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-[#FF4D4D]" />
            <h2 className="font-display text-white text-xl uppercase">TRENDING NOW</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {trendingChallenges.map((challenge, index) => (
              <div key={challenge.id} className="flex-shrink-0 w-[280px]">
                <ChallengeCard challenge={challenge} index={index} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-reel-muted">
            {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredChallenges.map((challenge, index) => (
            <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
          ))}
        </div>

        {filteredChallenges.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <p className="text-reel-muted">No challenges found</p>
            <p className="text-sm text-reel-muted/70 mt-1">
              Try adjusting your search or filters
            </p>
          </motion.div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
