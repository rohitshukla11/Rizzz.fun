'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, TrendingUp, Flame } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { cn, formatTokenAmount, truncateAddress } from '@/lib/utils';

// Mock leaderboard data
const mockLeaderboard = [
  { rank: 1, address: '0x1234567890abcdef1234567890abcdef12345678', username: 'PredictionKing', winRate: 78.5, totalEarnings: 125000n * 10n ** 18n, streak: 12 },
  { rank: 2, address: '0xabcdef1234567890abcdef1234567890abcdef12', username: 'ReelMaster', winRate: 72.3, totalEarnings: 98000n * 10n ** 18n, streak: 8 },
  { rank: 3, address: '0x7890abcdef1234567890abcdef1234567890abcd', username: 'VoteWizard', winRate: 68.9, totalEarnings: 87500n * 10n ** 18n, streak: 6 },
  { rank: 4, address: '0xdef1234567890abcdef1234567890abcdef123456', username: 'CryptoSeer', winRate: 65.2, totalEarnings: 72000n * 10n ** 18n, streak: 5 },
  { rank: 5, address: '0x567890abcdef1234567890abcdef1234567890ab', username: 'TrendHunter', winRate: 62.8, totalEarnings: 65000n * 10n ** 18n, streak: 4 },
  { rank: 6, address: '0x234567890abcdef1234567890abcdef12345678cd', username: 'ReelPro', winRate: 60.1, totalEarnings: 58000n * 10n ** 18n, streak: 3 },
  { rank: 7, address: '0x890abcdef1234567890abcdef1234567890abcdef', username: 'PredictNinja', winRate: 58.4, totalEarnings: 52000n * 10n ** 18n, streak: 2 },
  { rank: 8, address: '0xcdef1234567890abcdef1234567890abcdef1234', username: 'VoteKing', winRate: 55.7, totalEarnings: 45000n * 10n ** 18n, streak: 1 },
];

type TimeFrame = 'weekly' | 'monthly' | 'allTime';

export default function LeaderboardPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-reel-warning" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-reel-warning/20 to-transparent border-reel-warning/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/10 to-transparent border-gray-400/20';
      case 3:
        return 'bg-gradient-to-r from-amber-600/10 to-transparent border-amber-600/20';
      default:
        return 'bg-reel-card border-reel-border';
    }
  };

  return (
    <div className="min-h-screen bg-reel-bg pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-reel-warning" />
            <h1 className="font-display text-xl font-bold text-white">Leaderboard</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Time frame selector */}
      <section className="px-4 py-4">
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'allTime'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
                timeFrame === tf
                  ? 'bg-reel-primary text-white'
                  : 'bg-reel-card text-reel-muted hover:bg-reel-card/80'
              )}
            >
              {tf === 'weekly' ? 'This Week' : tf === 'monthly' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </section>

      {/* Top 3 podium */}
      <section className="px-4 pb-6">
        <div className="flex items-end justify-center gap-3 h-48">
          {/* 2nd place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center mb-2">
              <span className="text-lg font-bold text-white">
                {mockLeaderboard[1].username.slice(0, 2)}
              </span>
            </div>
            <Medal className="w-5 h-5 text-gray-300 mb-1" />
            <p className="text-xs text-white font-medium truncate max-w-[80px]">
              {mockLeaderboard[1].username}
            </p>
            <p className="text-xs text-reel-muted">
              {formatTokenAmount(mockLeaderboard[1].totalEarnings)}
            </p>
            <div className="w-20 h-24 rounded-t-lg bg-gradient-to-t from-gray-500/50 to-gray-400/30 mt-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-300">2</span>
            </div>
          </motion.div>

          {/* 1st place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <Crown className="w-8 h-8 text-reel-warning mb-1" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-reel-warning to-amber-600 flex items-center justify-center mb-2 ring-4 ring-reel-warning/30">
              <span className="text-xl font-bold text-white">
                {mockLeaderboard[0].username.slice(0, 2)}
              </span>
            </div>
            <p className="text-sm text-white font-medium truncate max-w-[100px]">
              {mockLeaderboard[0].username}
            </p>
            <p className="text-xs text-reel-muted">
              {formatTokenAmount(mockLeaderboard[0].totalEarnings)}
            </p>
            <div className="w-24 h-32 rounded-t-lg bg-gradient-to-t from-reel-warning/50 to-amber-500/30 mt-2 flex items-center justify-center">
              <span className="text-4xl font-bold text-reel-warning">1</span>
            </div>
          </motion.div>

          {/* 3rd place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center mb-2">
              <span className="text-lg font-bold text-white">
                {mockLeaderboard[2].username.slice(0, 2)}
              </span>
            </div>
            <Medal className="w-5 h-5 text-amber-600 mb-1" />
            <p className="text-xs text-white font-medium truncate max-w-[80px]">
              {mockLeaderboard[2].username}
            </p>
            <p className="text-xs text-reel-muted">
              {formatTokenAmount(mockLeaderboard[2].totalEarnings)}
            </p>
            <div className="w-20 h-20 rounded-t-lg bg-gradient-to-t from-amber-600/50 to-amber-500/30 mt-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-amber-600">3</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Full leaderboard */}
      <section className="px-4">
        <h3 className="font-display text-lg font-semibold text-white mb-3">Rankings</h3>
        <div className="space-y-2">
          {mockLeaderboard.map((user, index) => (
            <motion.div
              key={user.address}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border',
                getRankStyle(user.rank)
              )}
            >
              {/* Rank */}
              <div className="w-8 flex justify-center">
                {getRankIcon(user.rank) || (
                  <span className="text-lg font-bold text-reel-muted">{user.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                user.rank === 1 ? 'bg-gradient-to-br from-reel-warning to-amber-600' :
                user.rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                user.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                'bg-reel-surface'
              )}>
                <span className="text-sm font-bold text-white">
                  {user.username.slice(0, 2)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{user.username}</p>
                <p className="text-xs text-reel-muted">
                  {truncateAddress(user.address)} • {user.winRate}% win rate
                </p>
              </div>

              {/* Stats */}
              <div className="text-right">
                <p className="font-mono font-medium text-white">
                  {formatTokenAmount(user.totalEarnings)}
                </p>
                {user.streak > 0 && (
                  <div className="flex items-center justify-end gap-1 text-reel-warning">
                    <Flame className="w-3 h-3" />
                    <span className="text-xs">{user.streak} streak</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
