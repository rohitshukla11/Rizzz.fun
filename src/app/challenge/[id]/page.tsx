'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Users, Coins, Trophy, Zap, Play, CheckCircle, XCircle, Flame, Gift } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ReelViewer } from '@/components/reel/reel-viewer';
import { PredictionPanel } from '@/components/reel/prediction-panel';
import { DepositModal } from '@/components/wallet/deposit-modal';
import { ConnectButton } from '@/components/wallet/connect-button';
import { Button } from '@/components/ui/button';
import { useAppStore, type Reel, type Challenge } from '@/store/app-store';
import { useYellowSession, usePredictions, useSettlement } from '@/lib/yellow';
import { cn, formatTokenAmount, formatTimeRemaining } from '@/lib/utils';
import {
  getCurrentMultiplierInfo,
  calculateTimeWeightedPayouts,
  getMultiplier,
  formatMultiplier,
  CREATOR_FEE_BPS,
  PLATFORM_FEE_BPS,
  type TimedPrediction,
} from '@/lib/payout-algorithm';

const DEMO_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ── Challenge + Reel data factories ──────────────

function getDemoChallenge(): Challenge {
  let startTime: number;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('rizzz-demo-start');
    if (stored) {
      startTime = parseInt(stored, 10);
    } else {
      startTime = Date.now();
      localStorage.setItem('rizzz-demo-start', startTime.toString());
    }
  } else {
    startTime = Date.now();
  }
  return {
    id: 'demo_5min',
    title: '⚡ Quick Demo — 5 Min Challenge',
    description: 'Predict which reel wins! Early predictions earn up to 5× multiplier. 5% of pool goes to the winning creator.',
    theme: 'demo',
    coverImage: '',
    startTime,
    endTime: startTime + DEMO_DURATION_MS,
    totalPool: 10_000_000n,
    reelCount: 4,
    participantCount: 12,
    status: 'active',
  };
}

function getDefaultChallenge(): Challenge {
  return {
    id: 'challenge_001',
    title: 'Best Dance Move Challenge',
    description: 'Show us your best dance moves! Early predictions earn up to 5× multiplier. 5% of pool goes to the winning creator.',
    theme: 'dance',
    coverImage: '',
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000 * 5,
    totalPool: 12_500_000n,
    reelCount: 47,
    participantCount: 312,
    status: 'active',
  };
}

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
    predictionPool: 4_500_000n,
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
    predictionPool: 3_200_000n,
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
    predictionPool: 2_800_000n,
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
    predictionPool: 2_000_000n,
    createdAt: Date.now() - 43000000,
  },
];

type ViewMode = 'grid' | 'feed';

// ── Demo results overlay — with time-weighted payouts ──

function DemoResultsOverlay({
  challenge,
  reels,
  predictions,
  onRestart,
}: {
  challenge: Challenge;
  reels: Reel[];
  predictions: any[];
  onRestart: () => void;
}) {
  // Pick a random "winner" (seeded by challenge start time for consistency)
  const winnerIdx = Math.abs(challenge.startTime) % reels.length;
  const winner = reels[winnerIdx];

  // Build TimedPrediction[] from user's predictions + mock "other players" predictions
  const allPredictions: TimedPrediction[] = [];

  // Add user's actual predictions
  for (const p of predictions) {
    allPredictions.push({
      id: p.id || `user_${allPredictions.length}`,
      reelId: p.reelId,
      amount: BigInt(p.amount ?? 0),
      timestamp: p.timestamp || (challenge.startTime + 60_000), // default 1 min in
      predictor: 'user',
    });
  }

  // Add simulated "other players" predictions to fill out the pool
  const mockOtherPredictions: TimedPrediction[] = reels.map((reel, i) => ({
    id: `mock_${i}`,
    reelId: reel.id,
    amount: reel.predictionPool,
    timestamp: challenge.startTime + (i + 1) * 30_000, // staggered bids
    predictor: `other_${i}`,
  }));
  allPredictions.push(...mockOtherPredictions);

  // Calculate payouts using the time-weighted algorithm
  const payoutBreakdown = calculateTimeWeightedPayouts(
    allPredictions,
    winner?.id || '',
    challenge.startTime,
    challenge.endTime,
  );

  // Sum user payouts
  let userPayout = 0n;
  let userBetOnWinner = false;
  for (const p of predictions) {
    const id = p.id || `user_${predictions.indexOf(p)}`;
    if (p.reelId === winner?.id) {
      userBetOnWinner = true;
    }
    const payout = payoutBreakdown.predictorPayouts.get(id);
    if (payout) userPayout += payout;
  }

  const userTotalStaked = predictions.reduce((s: bigint, p: any) => s + BigInt(p.amount ?? 0), 0n);

  // Show multiplier user received
  const userMultiplier = predictions.length > 0
    ? getMultiplier(
        predictions[0].timestamp || challenge.startTime + 60_000,
        challenge.startTime,
        challenge.endTime,
      )
    : 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="bg-reel-surface rounded-2xl border border-reel-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="text-center mb-6">
          <Trophy className="w-16 h-16 text-reel-warning mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold text-white">Challenge Complete!</h2>
          <p className="text-reel-muted text-sm mt-1">Settlement finalised via Yellow Network</p>
        </div>

        {/* Winner */}
        <div className="bg-reel-card rounded-xl p-4 mb-4 border border-reel-warning/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-reel-warning text-black flex items-center justify-center text-sm font-bold">🏆</div>
            <div>
              <p className="text-white font-medium">@{winner?.creatorName || 'Unknown'}</p>
              <p className="text-reel-muted text-xs">{winner?.title}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-reel-muted">Winning pool</span>
            <span className="text-reel-warning font-mono">{formatTokenAmount(winner?.predictionPool ?? 0n, 6)} USDC</span>
          </div>
        </div>

        {/* Pool breakdown */}
        <div className="bg-reel-card rounded-xl p-4 mb-4 border border-reel-border space-y-2">
          <h4 className="text-sm font-medium text-white mb-2">Pool Breakdown</h4>
          <div className="flex items-center justify-between text-xs">
            <span className="text-reel-muted flex items-center gap-1">
              <Coins className="w-3 h-3" /> Total Pool
            </span>
            <span className="text-white font-mono">{formatTokenAmount(payoutBreakdown.totalPool, 6)} USDC</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-reel-muted flex items-center gap-1">
              <Gift className="w-3 h-3 text-purple-400" /> Creator Fee (5%)
            </span>
            <span className="text-purple-400 font-mono">{formatTokenAmount(payoutBreakdown.creatorFee, 6)} USDC</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-reel-muted flex items-center gap-1">
              <Zap className="w-3 h-3 text-reel-warning" /> Platform Fee (2.5%)
            </span>
            <span className="text-reel-warning font-mono">{formatTokenAmount(payoutBreakdown.platformFee, 6)} USDC</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-reel-border">
            <span className="text-reel-muted">Distributed to winners</span>
            <span className="text-reel-success font-mono">{formatTokenAmount(payoutBreakdown.distributablePool, 6)} USDC</span>
          </div>
        </div>

        {/* User's result */}
        <div className={cn(
          'rounded-xl p-4 mb-4 border',
          userBetOnWinner
            ? 'bg-reel-success/10 border-reel-success/30'
            : 'bg-reel-error/10 border-reel-error/30',
        )}>
          <div className="flex items-center gap-2 mb-2">
            {userBetOnWinner ? (
              <CheckCircle className="w-5 h-5 text-reel-success" />
            ) : (
              <XCircle className="w-5 h-5 text-reel-error" />
            )}
            <span className={cn(
              'font-medium',
              userBetOnWinner ? 'text-reel-success' : 'text-reel-error',
            )}>
              {predictions.length === 0
                ? 'No predictions placed'
                : userBetOnWinner
                  ? 'You predicted correctly! 🎉'
                  : 'Better luck next time'}
            </span>
          </div>
          {predictions.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-reel-muted">Your stake</span>
                <span className="text-white font-mono">{formatTokenAmount(userTotalStaked, 6)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-reel-muted flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" /> Your multiplier
                </span>
                <span className="text-orange-400 font-mono">{formatMultiplier(userMultiplier)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-reel-border/50">
                <span className="text-reel-muted">Payout</span>
                <span className={cn('font-mono font-bold', userBetOnWinner ? 'text-reel-success' : 'text-reel-error')}>
                  {userBetOnWinner ? '+' : ''}{formatTokenAmount(userPayout, 6)} USDC
                </span>
              </div>
              {userBetOnWinner && userTotalStaked > 0n && (
                <div className="flex justify-between">
                  <span className="text-reel-muted">ROI</span>
                  <span className="text-reel-success font-mono text-xs">
                    {userTotalStaked > 0n ? `${((Number(userPayout) / Number(userTotalStaked) - 1) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settlement info */}
        <div className="bg-reel-card/50 rounded-lg p-3 mb-6 text-xs text-reel-muted">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-reel-warning" />
            <span className="text-reel-warning font-medium">Yellow Network Settlement</span>
          </div>
          <p>Final state signed by all parties and submitted on-chain. Payouts weighted by prediction timing — early birds earn more!</p>
        </div>

        <Button onClick={onRestart} className="w-full">
          🔄 Start New 5-Min Challenge
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default function ChallengePage() {
  const params = useParams();
  const challengeId = params.id as string;
  const isDemo = challengeId === 'demo_5min';
  const { isConnected } = useAccount();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [showPredictionPanel, setShowPredictionPanel] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  const { 
    isDepositModalOpen, 
    setDepositModalOpen,
    setActiveChallenge,
    setReels,
    activeChallenge,
    reels,
  } = useAppStore();
  
  const { session } = useYellowSession();
  const { predictions } = usePredictions(challengeId);
  const { requestSettlement } = useSettlement();

  // Build challenge data based on route
  const mockChallenge = useMemo(() => {
    return isDemo ? getDemoChallenge() : getDefaultChallenge();
  }, [isDemo]);

  // Load challenge data
  useEffect(() => {
    setActiveChallenge(mockChallenge);
    setReels(mockReels.map(r => ({ ...r, challengeId })));
  }, [setActiveChallenge, setReels, mockChallenge, challengeId]);

  // Demo countdown timer
  useEffect(() => {
    if (!isDemo) return;
    const endTime = mockChallenge.endTime;

    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setTimeLeft('00:00');
        if (!showResults) {
          requestSettlement(challengeId).catch(console.warn);
          setShowResults(true);
        }
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isDemo, mockChallenge.endTime, showResults, challengeId, requestSettlement]);

  // ── Live multiplier for the header badge ──────
  const [currentMultiplier, setCurrentMultiplier] = useState<string>('');
  useEffect(() => {
    if (!activeChallenge) return;
    const tick = () => {
      const info = getCurrentMultiplierInfo(activeChallenge.startTime, activeChallenge.endTime);
      setCurrentMultiplier(info.formatted);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeChallenge]);

  const handleRestartDemo = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rizzz-demo-start');
      localStorage.removeItem('rizzz-session');
    }
    setShowResults(false);
    window.location.reload();
  }, []);

  const handlePredictClick = useCallback((reel: Reel) => {
    if (!isConnected) {
      return;
    }
    
    if (!session) {
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
      {/* Demo results overlay */}
      {showResults && (
        <DemoResultsOverlay
          challenge={challenge}
          reels={displayReels}
          predictions={predictions}
          onRestart={handleRestartDemo}
        />
      )}

      {viewMode === 'grid' ? (
        <>
          {/* Header */}
          <header className="sticky top-0 z-30 glass-strong safe-top">
            <div className="flex items-center justify-between px-4 h-14">
              <div className="flex items-center gap-3">
                <Link 
                  href="/"
                  className="p-2 -ml-2 rounded-lg hover:bg-reel-surface transition-colors inline-flex"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </Link>
                <h1 className="font-display text-lg font-semibold text-white truncate max-w-[180px]">
                  {challenge.title}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {/* Live multiplier badge */}
                {currentMultiplier && (
                  <div className="px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono font-bold text-orange-400">{currentMultiplier}</span>
                  </div>
                )}
                {isDemo && timeLeft && (
                  <div className={cn(
                    'px-3 py-1.5 rounded-full font-mono text-sm font-bold flex items-center gap-1.5',
                    timeLeft === '00:00'
                      ? 'bg-reel-error/20 text-reel-error'
                      : parseInt(timeLeft) <= 1
                        ? 'bg-reel-warning/20 text-reel-warning animate-pulse'
                        : 'bg-reel-primary/20 text-reel-primary',
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    {timeLeft}
                  </div>
                )}
                <ConnectButton />
              </div>
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
              
              {/* ── Early bird explainer ──────────── */}
              <div className="mt-3 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-start gap-2">
                  <Flame className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-orange-300/90">
                    <span className="font-semibold">Early Bird Bonus:</span> Predict early for up to <span className="font-mono font-bold">5×</span> multiplier on your payout.
                    The winning reel&apos;s creator earns <span className="font-mono font-bold">5%</span> of the pool.
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-2">
                <StatBadge 
                  icon={<Clock className="w-4 h-4" />}
                  label="Ends in"
                  value={isDemo && timeLeft ? timeLeft : formatTimeRemaining(challenge.endTime)}
                  variant="warning"
                />
                <StatBadge 
                  icon={<Coins className="w-4 h-4" />}
                  label="Pool"
                  value={formatTokenAmount(challenge.totalPool)}
                  variant="primary"
                />
                <StatBadge 
                  icon={<Flame className="w-4 h-4" />}
                  label="Multiplier"
                  value={currentMultiplier || '1.00×'}
                  variant="accent"
                />
                <StatBadge 
                  icon={<Users className="w-4 h-4" />}
                  label="Predictors"
                  value={challenge.participantCount.toString()}
                  variant="secondary"
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
                        {formatTokenAmount(session.availableBalance, 6)} USDC
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
        
        {/* Creator earns badge */}
        <div className="flex items-center gap-1 mt-1 text-[10px] text-purple-300/80">
          <Gift className="w-2.5 h-2.5" />
          Creator earns 5% if wins
        </div>

        {/* Predict button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPredict();
          }}
          className="mt-2 w-full py-2 rounded-lg bg-reel-primary/90 hover:bg-reel-primary text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Coins className="w-3.5 h-3.5" />
          Pool: {formatTokenAmount(reel.predictionPool, 6)} USDC
        </button>
      </div>
    </motion.div>
  );
}
