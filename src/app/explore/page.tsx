'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, X, Flame, Clock, Coins, Trophy } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { ChallengeCard, ChallengeCardSkeleton } from '@/components/challenge/challenge-card';
import type { Challenge } from '@/store/app-store';

const allChallenges: Challenge[] = [
  {
    id: 'challenge_001',
    title: 'Best Dance Move Challenge',
    description: 'Show us your best dance moves!',
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
    title: 'Cooking Hacks',
    description: 'Share your favorite cooking tips.',
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
    description: 'Your pets deserve the spotlight!',
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
    description: 'Capture beautiful sunsets.',
    theme: 'photography',
    coverImage: '',
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
    coverImage: '',
    startTime: Date.now() - 43200000,
    endTime: Date.now() + 86400000 * 4,
    totalPool: 67000n * 10n ** 18n,
    reelCount: 28,
    participantCount: 145,
    status: 'active',
  },
];

const themes = ['All', 'Dance', 'Cooking', 'Pets', 'Photography', 'Fitness', 'Comedy', 'Music'];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const filteredChallenges = allChallenges.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTheme = selectedTheme === 'All' || 
                        c.theme.toLowerCase() === selectedTheme.toLowerCase();
    return matchesSearch && matchesTheme;
  });

  return (
    <div className="min-h-screen bg-reel-bg pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-display text-xl font-bold text-white">Explore</h1>
          <ConnectButton />
        </div>
      </header>

      {/* Search bar */}
      <section className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-reel-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search challenges..."
            className="w-full h-12 pl-12 pr-12 rounded-xl bg-reel-card border border-reel-border focus:border-reel-primary outline-none text-white placeholder:text-reel-muted transition-colors"
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

      {/* Theme filters */}
      <section className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {themes.map((theme) => (
            <button
              key={theme}
              onClick={() => setSelectedTheme(theme)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all ${
                selectedTheme === theme
                  ? 'bg-reel-primary text-white'
                  : 'bg-reel-card text-reel-muted hover:bg-reel-card/80'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-reel-muted">
            {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-reel-muted hover:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <div className="grid gap-4">
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
