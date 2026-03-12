'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Wallet, Trophy, TrendingUp, History, 
  Settings, Copy, Check, ExternalLink 
} from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { Button } from '@/components/ui/button';
import { TabGroup } from '@/components/ui/tab-group';
import { useYellowSession } from '@/lib/yellow';
import { cn, formatTokenAmount, truncateAddress } from '@/lib/utils';
import { useENSIdentity, useENSSocialProfile, formatENSOrAddress } from '@/lib/ens';
import { ENSAvatar } from '@/components/ens/ens-identity';
import { PredictionPassportEditor } from '@/components/ens/prediction-passport';

// Mock stats
const mockStats = {
  totalPredictions: 47,
  totalWins: 12,
  winRate: 25.5,
  totalEarnings: 4532n * 1_000_000n,
  totalDeposited: 3000n * 1_000_000n,
};

const mockHistory = [
  { id: '1', challenge: 'Dance Challenge', reel: '@DanceMaster', amount: 200n * 10n ** 18n, won: true, earnings: 450n * 10n ** 18n },
  { id: '2', challenge: 'Cooking Hacks', reel: '@ChefLife', amount: 150n * 10n ** 18n, won: false, earnings: 0n },
  { id: '3', challenge: 'Pet Tricks', reel: '@DogWhisperer', amount: 100n * 10n ** 18n, won: true, earnings: 280n * 10n ** 18n },
];

export default function ProfilePage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'achievements'>('active');
  
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { session } = useYellowSession();

  // ENS hooks
  const { name: ensName, avatar: ensAvatar, isLoading: ensLoading } = useENSIdentity(address);
  const social = useENSSocialProfile(ensName);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-reel-bg pb-20 flex flex-col">
        <header className="sticky top-0 z-30 glass-strong safe-top">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="font-display text-[28px] text-white">
              PROFILE<span className="text-[#F5FF00]">.</span>
            </h1>
            <ConnectButton />
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-reel-elevated mx-auto mb-4 flex items-center justify-center">
              <Wallet className="w-10 h-10 text-reel-muted" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-reel-muted mb-6 max-w-xs">
              Connect your wallet to view your predictions, earnings, and ENS profile.
            </p>
            <ConnectButton />
          </motion.div>
        </div>

        <BottomNav />
      </div>
    );
  }

  const tabs = [
    { id: 'active', label: 'Active Bets' },
    { id: 'history', label: 'History' },
    { id: 'achievements', label: 'Achievements' },
  ];

  return (
    <div className="min-h-screen bg-reel-bg pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-display text-[28px] text-white">
            PROFILE<span className="text-[#F5FF00]">.</span>
          </h1>
          <button className="p-2 rounded-lg hover:bg-reel-surface transition-colors">
            <Settings className="w-5 h-5 text-reel-muted" />
          </button>
        </div>
      </header>

      {/* Hero band */}
      <section className="relative h-[200px] bg-gradient-to-b from-[#1A1400] to-reel-surface overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8">
          <ENSAvatar 
            address={address} 
            size="lg"
            className="ring-4 ring-[#F5FF00] mb-3"
          />
          <h2 className="font-display text-white text-[36px] uppercase">
            {ensName || truncateAddress(address || '', 6)}
          </h2>
        </div>
      </section>

      {/* Stats row */}
      <section className="px-4 py-6 -mt-8">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-reel-elevated rounded-xl p-4 border border-reel-border text-center">
            <p className="font-mono text-[#F5FF00] text-xl font-bold">{mockStats.totalPredictions}</p>
            <p className="font-sans text-reel-muted text-xs mt-1">Predictions</p>
          </div>
          <div className="bg-reel-elevated rounded-xl p-4 border border-reel-border text-center">
            <p className="font-mono text-[#F5FF00] text-xl font-bold">{mockStats.winRate}%</p>
            <p className="font-sans text-reel-muted text-xs mt-1">Win Rate</p>
          </div>
          <div className="bg-reel-elevated rounded-xl p-4 border border-reel-border text-center">
            <p className="font-mono text-[#F5FF00] text-xl font-bold">{formatTokenAmount(mockStats.totalEarnings, 0)}</p>
            <p className="font-sans text-reel-muted text-xs mt-1">Total Won</p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="px-4">
        <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as any)} />
      </section>

      {/* Tab content */}
      <section className="px-4 py-6">
        {activeTab === 'active' && (
          <div className="space-y-3">
            {mockHistory.filter(h => h.won === false).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl bg-reel-surface border border-reel-border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.challenge}</p>
                    <p className="text-sm text-reel-muted">{item.reel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-white">
                      {formatTokenAmount(item.amount)}
                    </p>
                    <div className="w-24 h-1 bg-reel-elevated rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-[#F5FF00] rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {mockHistory.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl bg-reel-surface border border-reel-border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.challenge}</p>
                    <p className="text-sm text-reel-muted">{item.reel}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-mono font-semibold',
                      item.won ? 'text-[#00ff88]' : 'text-reel-muted'
                    )}>
                      {item.won ? '+' : '-'}{formatTokenAmount(item.won ? item.earnings : item.amount)}
                    </p>
                    <p className={cn(
                      'text-xs mt-1',
                      item.won ? 'text-[#00ff88]' : 'text-reel-muted'
                    )}>
                      {item.won ? 'Won' : 'Lost'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'aspect-square rounded-xl border-2 flex items-center justify-center',
                  i <= 2
                    ? 'bg-[#F5FF00]/10 border-[#F5FF00] glow-yellow'
                    : 'bg-reel-elevated border-reel-border grayscale'
                )}
              >
                <Trophy className={cn(
                  'w-8 h-8',
                  i <= 2 ? 'text-[#F5FF00]' : 'text-reel-muted'
                )} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Disconnect button */}
      <section className="px-4 py-6">
        <Button
          onClick={() => disconnect()}
          variant="outline"
          className="w-full"
        >
          Disconnect Wallet
        </Button>
      </section>

      <BottomNav />
    </div>
  );
}
