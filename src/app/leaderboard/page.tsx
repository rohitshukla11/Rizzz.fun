'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { cn, formatTokenAmount, truncateAddress } from '@/lib/utils';
import { ENSName, ENSAvatar } from '@/components/ens/ens-identity';

// Mock leaderboard data with real ENS-named addresses
const mockLeaderboard = [
  { rank: 1, address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', username: 'PredictionKing', winRate: 78.5, totalEarnings: 125000n * 10n ** 18n, streak: 12 },
  { rank: 2, address: '0x983110309620D911731Ac0932219af06091b6744', username: 'ReelMaster', winRate: 72.3, totalEarnings: 98000n * 10n ** 18n, streak: 8 },
  { rank: 3, address: '0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5', username: 'VoteWizard', winRate: 68.9, totalEarnings: 87500n * 10n ** 18n, streak: 6 },
  { rank: 4, address: '0x4f3a120E72C76c22ae802D129F599BFDbc31cb81', username: 'CryptoSeer', winRate: 65.2, totalEarnings: 72000n * 10n ** 18n, streak: 5 },
  { rank: 5, address: '0x8ba1f109551bD432803012645Hac136c22C9E8', username: 'TrendHunter', winRate: 62.8, totalEarnings: 65000n * 10n ** 18n, streak: 4 },
  { rank: 6, address: '0x2f587c2A9c4E0B5a3bA3d5d5f5f5f5f5f5f5f5f5f5f', username: 'ReelPro', winRate: 60.1, totalEarnings: 58000n * 10n ** 18n, streak: 3 },
  { rank: 7, address: '0x890abcdef1234567890abcdef1234567890abcdef', username: 'PredictNinja', winRate: 58.4, totalEarnings: 52000n * 10n ** 18n, streak: 2 },
  { rank: 8, address: '0xcdef1234567890abcdef1234567890abcdef1234', username: 'VoteKing', winRate: 55.7, totalEarnings: 45000n * 10n ** 18n, streak: 1 },
];

type TimeFrame = 'weekly' | 'monthly' | 'allTime';

export default function LeaderboardPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');

  return (
    <div className="min-h-screen bg-reel-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-display text-white text-[64px] uppercase leading-none">HALL OF RIZZZ</h1>
          <ConnectButton />
        </div>
      </header>

      {/* Time frame selector */}
      <section className="px-4 py-6">
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'allTime'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={cn(
                'flex-1 py-3 rounded-lg text-sm font-medium transition-all',
                timeFrame === tf
                  ? 'bg-[#F5FF00] text-black'
                  : 'bg-reel-elevated text-reel-muted hover:text-white'
              )}
            >
              {tf === 'weekly' ? 'This Week' : tf === 'monthly' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </section>

      {/* Top 3 podium */}
      <section className="px-4 pb-8">
        <div className="flex items-end justify-center gap-4 h-64">
          {/* 2nd place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center flex-1 max-w-[120px]"
          >
            <ENSAvatar 
              address={mockLeaderboard[1].address} 
              size="lg"
              className="mb-2 ring-2 ring-gray-400"
            />
            <Medal className="w-6 h-6 text-gray-300 mb-1" />
            <ENSName 
              address={mockLeaderboard[1].address} 
              className="text-sm text-white font-semibold truncate w-full text-center"
              chars={6}
            />
            <p className="text-xs font-mono text-[#F5FF00] mt-1">
              {formatTokenAmount(mockLeaderboard[1].totalEarnings)}
            </p>
            <div className="w-full h-24 rounded-t-2xl bg-gradient-to-t from-gray-500/50 to-gray-400/30 mt-2 flex items-center justify-center">
              <span className="text-3xl font-display font-bold text-gray-300">2</span>
            </div>
          </motion.div>

          {/* 1st place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center flex-1 max-w-[140px]"
          >
            <Crown className="w-8 h-8 text-[#F5FF00] mb-1" />
            <ENSAvatar 
              address={mockLeaderboard[0].address} 
              size="lg"
              className="mb-2 ring-4 ring-[#F5FF00]/50 glow-yellow"
            />
            <ENSName 
              address={mockLeaderboard[0].address} 
              className="text-base text-white font-bold truncate w-full text-center"
              chars={6}
            />
            <p className="text-sm font-mono text-[#F5FF00] mt-1 font-bold">
              {formatTokenAmount(mockLeaderboard[0].totalEarnings)}
            </p>
            <div className="w-full h-32 rounded-t-2xl bg-gradient-to-t from-[#F5FF00]/50 to-[#F5FF00]/30 mt-2 flex items-center justify-center glow-yellow">
              <span className="text-4xl font-display font-bold text-black">1</span>
            </div>
          </motion.div>

          {/* 3rd place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center flex-1 max-w-[120px]"
          >
            <ENSAvatar 
              address={mockLeaderboard[2].address} 
              size="md"
              className="mb-2 ring-2 ring-amber-600"
            />
            <Medal className="w-6 h-6 text-amber-600 mb-1" />
            <ENSName 
              address={mockLeaderboard[2].address} 
              className="text-sm text-white font-semibold truncate w-full text-center"
              chars={6}
            />
            <p className="text-xs font-mono text-[#F5FF00] mt-1">
              {formatTokenAmount(mockLeaderboard[2].totalEarnings)}
            </p>
            <div className="w-full h-20 rounded-t-2xl bg-gradient-to-t from-amber-600/50 to-amber-500/30 mt-2 flex items-center justify-center">
              <span className="text-3xl font-display font-bold text-amber-600">3</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Full leaderboard */}
      <section className="px-4">
        <h3 className="font-display text-white text-2xl uppercase mb-4">RANKINGS</h3>
        <div className="space-y-2">
          {mockLeaderboard.map((user, index) => (
            <motion.div
              key={user.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border border-reel-border transition-colors',
                index % 2 === 0 ? 'bg-[#0F0F0F]' : 'bg-reel-surface',
                'hover:bg-[rgba(245,255,0,0.04)]'
              )}
            >
              {/* Rank */}
              <div className="w-8 flex justify-center">
                <span className="font-mono text-lg font-bold text-reel-muted">{user.rank}</span>
              </div>

              {/* Avatar */}
              <ENSAvatar 
                address={user.address} 
                size="md"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ENSName 
                    address={user.address} 
                    className="font-semibold text-white truncate"
                    chars={4}
                  />
                </div>
                <p className="text-xs text-reel-muted">
                  {user.winRate}% win rate
                </p>
              </div>

              {/* Stats */}
              <div className="text-right">
                <p className="font-mono font-semibold text-[#F5FF00]">
                  {formatTokenAmount(user.totalEarnings)}
                </p>
                <p className="text-xs text-reel-muted">
                  {formatTokenAmount(user.totalEarnings, 6)} staked
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
