'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Wallet, Trophy, TrendingUp, History, 
  Settings, ChevronRight, Copy, Check, ExternalLink 
} from 'lucide-react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { Button } from '@/components/ui/button';
import { useYellowSession } from '@/lib/yellow';
import { cn, formatTokenAmount, truncateAddress } from '@/lib/utils';

// Mock stats
const mockStats = {
  totalPredictions: 47,
  totalWins: 12,
  winRate: 25.5,
  totalEarnings: 4532n * 10n ** 18n,
  totalDeposited: 3000n * 10n ** 18n,
};

const mockHistory = [
  { id: '1', challenge: 'Dance Challenge', reel: '@DanceMaster', amount: 200n * 10n ** 18n, won: true, earnings: 450n * 10n ** 18n },
  { id: '2', challenge: 'Cooking Hacks', reel: '@ChefLife', amount: 150n * 10n ** 18n, won: false, earnings: 0n },
  { id: '3', challenge: 'Pet Tricks', reel: '@DogWhisperer', amount: 100n * 10n ** 18n, won: true, earnings: 280n * 10n ** 18n },
];

export default function ProfilePage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'predictions' | 'earnings'>('predictions');
  
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { disconnect } = useDisconnect();
  const { session } = useYellowSession();

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
            <h1 className="font-display text-xl font-bold text-white">Profile</h1>
            <ConnectButton />
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-reel-card mx-auto mb-4 flex items-center justify-center">
              <Wallet className="w-10 h-10 text-reel-muted" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-reel-muted mb-6 max-w-xs">
              Connect your wallet to view your predictions, earnings, and stats.
            </p>
            <ConnectButton />
          </motion.div>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-reel-bg pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-display text-xl font-bold text-white">Profile</h1>
          <button className="p-2 rounded-lg hover:bg-reel-surface transition-colors">
            <Settings className="w-5 h-5 text-reel-muted" />
          </button>
        </div>
      </header>

      {/* Profile card */}
      <section className="px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-reel-card border border-reel-border p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {address?.slice(2, 4).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">
                  {truncateAddress(address || '', 6)}
                </span>
                <button onClick={handleCopy} className="p-1">
                  {copied ? (
                    <Check className="w-4 h-4 text-reel-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-reel-muted" />
                  )}
                </button>
              </div>
              <p className="text-sm text-reel-muted">
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '...'}
              </p>
            </div>
          </div>

          {/* Session status */}
          {session && (
            <div className="mt-4 p-3 rounded-xl bg-reel-success/10 border border-reel-success/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-reel-success animate-pulse" />
                  <span className="text-sm text-reel-success font-medium">
                    Yellow Session Active
                  </span>
                </div>
                <span className="text-sm font-mono text-white">
                  {formatTokenAmount(session.availableBalance)} REEL
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* Stats grid */}
      <section className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-reel-primary" />}
            label="Total Predictions"
            value={mockStats.totalPredictions.toString()}
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-reel-warning" />}
            label="Wins"
            value={mockStats.totalWins.toString()}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-reel-success" />}
            label="Win Rate"
            value={`${mockStats.winRate}%`}
          />
          <StatCard
            icon={<Wallet className="w-5 h-5 text-reel-accent" />}
            label="Earnings"
            value={formatTokenAmount(mockStats.totalEarnings)}
          />
        </div>
      </section>

      {/* Tabs */}
      <section className="px-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('predictions')}
            className={cn(
              'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
              activeTab === 'predictions'
                ? 'bg-reel-primary text-white'
                : 'bg-reel-card text-reel-muted'
            )}
          >
            <History className="w-4 h-4 inline-block mr-2" />
            History
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={cn(
              'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
              activeTab === 'earnings'
                ? 'bg-reel-primary text-white'
                : 'bg-reel-card text-reel-muted'
            )}
          >
            <Wallet className="w-4 h-4 inline-block mr-2" />
            Earnings
          </button>
        </div>

        {/* History list */}
        <div className="space-y-3">
          {mockHistory.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-reel-card border border-reel-border"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{item.challenge}</p>
                  <p className="text-sm text-reel-muted">{item.reel}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'font-mono font-medium',
                    item.won ? 'text-reel-success' : 'text-reel-muted'
                  )}>
                    {item.won ? '+' : '-'}{formatTokenAmount(item.won ? item.earnings : item.amount)}
                  </p>
                  <p className={cn(
                    'text-xs',
                    item.won ? 'text-reel-success' : 'text-reel-muted'
                  )}>
                    {item.won ? 'Won' : 'Lost'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-xl bg-reel-card border border-reel-border"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-reel-muted">{label}</span>
      </div>
      <p className="text-xl font-display font-bold text-white">{value}</p>
    </motion.div>
  );
}
