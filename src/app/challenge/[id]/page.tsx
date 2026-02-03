'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Users, Coins, Trophy, Zap, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ReelViewer } from '@/components/reel/reel-viewer';
import { PredictionPanel } from '@/components/reel/prediction-panel';
import { DepositModal } from '@/components/wallet/deposit-modal';
import { ConnectButton } from '@/components/wallet/connect-button';
import { Button } from '@/components/ui/button';
import { useAppStore, type Reel, type Challenge } from '@/store/app-store';
import { useYellowSession } from '@/lib/yellow';
import { cn, formatTokenAmount, formatTimeRemaining } from '@/lib/utils';

// Mock data
const mockChallenge: Challenge = {
  id: 'challenge_001',
  title: 'Best Dance Move Challenge',
  description: 'Show us your best dance moves! The most creative and entertaining dancer wins the grand prize pool.',
  theme: 'dance',
  coverImage: '',
  startTime: Date.now() - 86400000,
  endTime: Date.now() + 86400000 * 5,
  totalPool: 125000n * 10n ** 18n,
  reelCount: 47,
  participantCount: 312,
  status: 'active',
};

const mockReels: Reel[] = [
  {
    id: 'reel_001',
    challengeId: 'challenge_001',
    creatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
    creatorName: 'DanceMaster',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnailUrl: '',
    title: 'Crazy moonwalk combo 🌙✨',
    votes: 2453,
    predictionPool: 45000n * 10n ** 18n,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'reel_002',
    challengeId: 'challenge_001',
    creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    creatorName: 'GrooveQueen',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: '',
    title: 'When the beat drops 🔥',
    votes: 1897,
    predictionPool: 32000n * 10n ** 18n,
    createdAt: Date.now() - 72000000,
  },
  {
    id: 'reel_003',
    challengeId: 'challenge_001',
    creatorAddress: '0x7890abcdef1234567890abcdef1234567890abcd',
    creatorName: 'PopLockDrop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: '',
    title: 'Robot dance perfection 🤖',
    votes: 1654,
    predictionPool: 28000n * 10n ** 18n,
    createdAt: Date.now() - 58000000,
  },
  {
    id: 'reel_004',
    challengeId: 'challenge_001',
    creatorAddress: '0xdef1234567890abcdef1234567890abcdef123456',
    creatorName: 'FlexKing',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: '',
    title: 'Flexibility goals 💪',
    votes: 1432,
    predictionPool: 20000n * 10n ** 18n,
    createdAt: Date.now() - 43000000,
  },
];

type ViewMode = 'grid' | 'feed';

export default function ChallengePage() {
  const params = useParams();
  const challengeId = params.id as string;
  const { isConnected } = useAccount();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [showPredictionPanel, setShowPredictionPanel] = useState(false);
  
  const { 
    isDepositModalOpen, 
    setDepositModalOpen,
    setActiveChallenge,
    setReels,
    activeChallenge,
    reels,
  } = useAppStore();
  
  const { session } = useYellowSession();

  // Load challenge data
  useEffect(() => {
    setActiveChallenge(mockChallenge);
    setReels(mockReels);
  }, [setActiveChallenge, setReels]);

  const handlePredictClick = useCallback((reel: Reel) => {
    if (!isConnected) {
      // Prompt to connect wallet
      return;
    }
    
    if (!session) {
      // Need to deposit first
      setDepositModalOpen(true);
      return;
    }
    
    setSelectedReel(reel);
    setShowPredictionPanel(true);
  }, [isConnected, session, setDepositModalOpen]);

  const handleStartViewing = useCallback((index: number = 0) => {
    setViewMode('feed');
  }, []);

  const challenge = activeChallenge || mockChallenge;
  const displayReels = reels.length > 0 ? reels : mockReels;

  return (
    <div className="min-h-screen bg-reel-bg">
      {viewMode === 'grid' ? (
        <>
          {/* Header */}
          <header className="sticky top-0 z-30 glass-strong safe-top">
            <div className="flex items-center justify-between px-4 h-14">
              <div className="flex items-center gap-3">
                <Link href="/">
                  <button className="p-2 -ml-2 rounded-lg hover:bg-reel-surface transition-colors">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                </Link>
                <h1 className="font-display text-lg font-semibold text-white truncate max-w-[200px]">
                  {challenge.title}
                </h1>
              </div>
              <ConnectButton />
            </div>
          </header>

          {/* Challenge info */}
          <section className="px-4 py-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-reel-card border border-reel-border p-4"
            >
              <p className="text-reel-muted text-sm">{challenge.description}</p>
              
              {/* Stats row */}
              <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-2">
                <StatBadge 
                  icon={<Clock className="w-4 h-4" />}
                  label="Ends in"
                  value={formatTimeRemaining(challenge.endTime)}
                  variant="warning"
                />
                <StatBadge 
                  icon={<Coins className="w-4 h-4" />}
                  label="Pool"
                  value={formatTokenAmount(challenge.totalPool)}
                  variant="primary"
                />
                <StatBadge 
                  icon={<Users className="w-4 h-4" />}
                  label="Predictors"
                  value={challenge.participantCount.toString()}
                  variant="secondary"
                />
                <StatBadge 
                  icon={<Trophy className="w-4 h-4" />}
                  label="Reels"
                  value={challenge.reelCount.toString()}
                  variant="accent"
                />
              </div>

              {/* Session status */}
              {isConnected && (
                <div className="mt-4 pt-4 border-t border-reel-border">
                  {session ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-reel-success animate-pulse" />
                        <span className="text-sm text-reel-success">Session Active</span>
                      </div>
                      <span className="text-sm font-mono text-white">
                        {formatTokenAmount(session.availableBalance)} RIZZZ
                      </span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setDepositModalOpen(true)}
                      variant="default"
                      className="w-full"
                    >
                      <Zap className="w-4 h-4" />
                      Deposit to Start Predicting
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          </section>

          {/* Reels grid */}
          <section className="px-4 pb-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-white">
                Competing Reels
              </h3>
              <Button
                onClick={() => handleStartViewing(0)}
                variant="glass"
                size="sm"
              >
                <Play className="w-4 h-4" />
                Watch All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {displayReels.map((reel, index) => (
                <ReelGridItem
                  key={reel.id}
                  reel={reel}
                  index={index}
                  totalPool={challenge.totalPool}
                  onWatch={() => handleStartViewing(index)}
                  onPredict={() => handlePredictClick(reel)}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Full-screen reel feed */
        <div className="fixed inset-0 bg-black z-50">
          <ReelViewer
            reels={displayReels}
            onPredictClick={handlePredictClick}
          />
          
          {/* Back button */}
          <button
            onClick={() => setViewMode('grid')}
            className="absolute top-4 left-4 safe-top z-10 p-2 rounded-full glass"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Prediction panel */}
      <AnimatePresence>
        {showPredictionPanel && (
          <PredictionPanel
            reel={selectedReel}
            challengeId={challengeId}
            onClose={() => {
              setShowPredictionPanel(false);
              setSelectedReel(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Deposit modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        challengeId={challengeId}
      />
    </div>
  );
}

function StatBadge({ 
  icon, 
  label, 
  value, 
  variant 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  variant: 'primary' | 'secondary' | 'accent' | 'warning';
}) {
  const colors = {
    primary: 'bg-reel-primary/10 text-reel-primary border-reel-primary/20',
    secondary: 'bg-reel-secondary/10 text-reel-secondary border-reel-secondary/20',
    accent: 'bg-reel-accent/10 text-reel-accent border-reel-accent/20',
    warning: 'bg-reel-warning/10 text-reel-warning border-reel-warning/20',
  };

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl border flex-shrink-0',
      colors[variant]
    )}>
      {icon}
      <div>
        <p className="text-[10px] opacity-70">{label}</p>
        <p className="text-sm font-mono font-medium">{value}</p>
      </div>
    </div>
  );
}

function ReelGridItem({ 
  reel, 
  index,
  totalPool,
  onWatch,
  onPredict,
}: { 
  reel: Reel; 
  index: number;
  totalPool: bigint;
  onWatch: () => void;
  onPredict: () => void;
}) {
  const percentage = totalPool > 0n 
    ? Number((reel.predictionPool * 100n) / totalPool) 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-reel-surface"
    >
      {/* Thumbnail or gradient */}
      {reel.thumbnailUrl ? (
        <img
          src={reel.thumbnailUrl}
          alt={reel.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, 
              hsl(${(index * 60) % 360}, 70%, 30%), 
              hsl(${(index * 60 + 120) % 360}, 70%, 20%)
            )`,
          }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Play button */}
      <button
        onClick={onWatch}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </button>

      {/* Rank badge */}
      <div className="absolute top-2 left-2">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          index === 0 ? 'bg-reel-warning text-black' :
          index === 1 ? 'bg-gray-300 text-black' :
          index === 2 ? 'bg-amber-700 text-white' :
          'bg-reel-surface text-white'
        )}>
          {index + 1}
        </div>
      </div>

      {/* Prediction percentage */}
      <div className="absolute top-2 right-2 glass rounded-lg px-2 py-1">
        <span className="text-xs font-mono text-white">{percentage}%</span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white text-sm font-medium truncate">@{reel.creatorName}</p>
        <p className="text-white/70 text-xs truncate mt-0.5">{reel.title}</p>
        
        {/* Predict button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPredict();
          }}
          className="mt-2 w-full py-2 rounded-lg bg-reel-primary/90 hover:bg-reel-primary text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Coins className="w-3.5 h-3.5" />
          {formatTokenAmount(reel.predictionPool)}
        </button>
      </div>
    </motion.div>
  );
}
