'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, Users, Coins, Trophy, Zap, Play, Pause,
  CheckCircle, XCircle, Flame, Gift, Volume2, VolumeX, Eye, TrendingUp,
} from 'lucide-react';
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

const DEMO_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// ── Video URLs for demo reels ──
const DEMO_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];

// ── Thumbnails for reels ──
const REEL_THUMBNAILS = [
  'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=700&fit=crop',
  'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=700&fit=crop',
  'https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=400&h=700&fit=crop',
  'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=400&h=700&fit=crop',
];

// ── Challenge + Reel data factories ──

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
    title: '⚡ 2-Min Speed Predict',
    description: 'Predict which reel wins! Early predictions earn up to 5× multiplier. Creator earns 10% of the winning pool.',
    theme: 'demo',
    coverImage: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=800&h=400&fit=crop',
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
    description: 'The most creative and entertaining dancer wins! Early predictions get higher multiplier. Creator earns 10%.',
    theme: 'dance',
    coverImage: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&h=400&fit=crop',
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
    videoUrl: DEMO_VIDEOS[0],
    thumbnailUrl: REEL_THUMBNAILS[0],
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
    videoUrl: DEMO_VIDEOS[1],
    thumbnailUrl: REEL_THUMBNAILS[1],
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
    videoUrl: DEMO_VIDEOS[2],
    thumbnailUrl: REEL_THUMBNAILS[2],
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
    videoUrl: DEMO_VIDEOS[3],
    thumbnailUrl: REEL_THUMBNAILS[3],
    title: 'Flexibility goals 💪',
    votes: 1432,
    predictionPool: 2_000_000n,
    createdAt: Date.now() - 43000000,
  },
];

type ViewMode = 'grid' | 'feed';

// ── Countdown ring component ──

function CountdownRing({ endTime, startTime }: { endTime: number; startTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, endTime - Date.now()));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [endTime]);

  const total = endTime - startTime;
  const progress = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - progress);
  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);
  const isUrgent = timeLeft < 30000;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="4"
        />
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={isUrgent ? '#ff4444' : '#ff3d8a'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-200"
          style={{ filter: isUrgent ? 'drop-shadow(0 0 8px rgba(255,68,68,0.6))' : 'drop-shadow(0 0 6px rgba(255,61,138,0.4))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          'text-lg font-mono font-bold',
          isUrgent ? 'text-reel-error countdown-urgent' : 'text-white',
        )}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        <span className="text-[10px] text-reel-muted">remaining</span>
      </div>
    </div>
  );
}

// ── Video preview card for reel grid ──

function VideoReelCard({
  reel,
  index,
  totalPool,
  onWatch,
  onPredict,
  isDemo,
}: {
  reel: Reel;
  index: number;
  totalPool: bigint;
  onWatch: () => void;
  onPredict: () => void;
  isDemo: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const percentage = totalPool > 0n ? Number((reel.predictionPool * 100n) / totalPool) : 0;

  // Play video preview on hover / touch
  useEffect(() => {
    if (!videoRef.current) return;
    if (isHovering && isVideoLoaded) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      if (videoRef.current.readyState > 0) {
        videoRef.current.currentTime = 0;
      }
    }
  }, [isHovering, isVideoLoaded]);

  const rankBadge = index === 0
    ? { bg: 'bg-gradient-to-br from-yellow-400 to-amber-500', text: 'text-black', emoji: '🥇' }
    : index === 1
    ? { bg: 'bg-gradient-to-br from-gray-300 to-gray-400', text: 'text-black', emoji: '🥈' }
    : index === 2
    ? { bg: 'bg-gradient-to-br from-amber-700 to-amber-800', text: 'text-white', emoji: '🥉' }
    : { bg: 'bg-reel-surface/80', text: 'text-white', emoji: `#${index + 1}` };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 200 }}
      className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-reel-surface border border-reel-border/30 hover:border-reel-primary/40 transition-all duration-300 card-hover"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={() => setIsHovering(true)}
      onTouchEnd={() => setIsHovering(false)}
    >
      {/* Thumbnail image */}
      {reel.thumbnailUrl && (
        <img
          src={reel.thumbnailUrl}
          alt={reel.title}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
            isHovering && isVideoLoaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Video preview (preloaded, plays on hover) */}
      {isDemo && (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
            isHovering && isVideoLoaded ? 'opacity-100' : 'opacity-0',
          )}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setIsVideoLoaded(true)}
        />
      )}

      {/* Gradient fallback if no thumbnail */}
      {!reel.thumbnailUrl && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, 
              hsl(${(index * 60) % 360}, 70%, 25%), 
              hsl(${(index * 60 + 120) % 360}, 70%, 15%))`,
          }}
        />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      {/* Play indicator on hover */}
      <AnimatePresence>
        {isHovering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-6 h-6 text-white ml-0.5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top row: rank + percentage */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg',
          rankBadge.bg, rankBadge.text,
        )}>
          {index < 3 ? rankBadge.emoji : rankBadge.emoji}
        </div>
        <div className="glass rounded-full px-2.5 py-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-reel-success" />
          <span className="text-xs font-mono font-bold text-white">{percentage}%</span>
        </div>
      </div>

      {/* Views badge */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        {/* Creator info */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {reel.creatorName.charAt(0)}
            </span>
          </div>
          <span className="text-white text-xs font-medium truncate">@{reel.creatorName}</span>
        </div>
        <p className="text-white/60 text-[11px] truncate mb-1.5">{reel.title}</p>

        {/* Creator fee badge */}
        <div className="flex items-center gap-1 mb-2 text-[10px] text-purple-300/80">
          <Gift className="w-2.5 h-2.5" />
          <span>Creator earns 10% if wins</span>
        </div>

        {/* Predict button */}
        <button
          onClick={(e) => { e.stopPropagation(); onPredict(); }}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-reel-primary to-reel-accent hover:opacity-90 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-reel-primary/20"
        >
          <Coins className="w-3.5 h-3.5" />
          {formatTokenAmount(reel.predictionPool, 6)} USDC
        </button>
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]">
        <div
          className="h-full bg-gradient-to-r from-reel-primary to-reel-accent"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </motion.div>
  );
}

// ── Demo results overlay ──

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
  const winnerIdx = Math.abs(challenge.startTime) % reels.length;
  const winner = reels[winnerIdx];

  const allPredictions: TimedPrediction[] = [];
  for (const p of predictions) {
    allPredictions.push({
      id: p.id || `user_${allPredictions.length}`,
      reelId: p.reelId,
      amount: BigInt(p.amount ?? 0),
      timestamp: p.timestamp || (challenge.startTime + 60_000),
      predictor: 'user',
    });
  }
  const mockOtherPredictions: TimedPrediction[] = reels.map((reel, i) => ({
    id: `mock_${i}`,
    reelId: reel.id,
    amount: reel.predictionPool,
    timestamp: challenge.startTime + (i + 1) * 30_000,
    predictor: `other_${i}`,
  }));
  allPredictions.push(...mockOtherPredictions);

  const payoutBreakdown = calculateTimeWeightedPayouts(
    allPredictions, winner?.id || '', challenge.startTime, challenge.endTime,
  );

  let userPayout = 0n;
  let userBetOnWinner = false;
  for (const p of predictions) {
    const id = p.id || `user_${predictions.indexOf(p)}`;
    if (p.reelId === winner?.id) userBetOnWinner = true;
    const payout = payoutBreakdown.predictorPayouts.get(id);
    if (payout) userPayout += payout;
  }
  const userTotalStaked = predictions.reduce((s: bigint, p: any) => s + BigInt(p.amount ?? 0), 0n);
  const userMult = predictions.length > 0
    ? getMultiplier(predictions[0].timestamp || challenge.startTime + 60_000, challenge.startTime, challenge.endTime)
    : 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 180 }}
        className="bg-reel-surface rounded-3xl border border-reel-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header animation */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Trophy className="w-16 h-16 text-reel-warning mx-auto mb-3 drop-shadow-[0_0_20px_rgba(255,170,0,0.5)]" />
          </motion.div>
          <h2 className="font-display text-2xl font-bold text-gradient">Challenge Complete!</h2>
          <p className="text-reel-muted text-sm mt-1">Settled via Yellow Network ⚡</p>
        </div>

        {/* Winner card */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-reel-warning/10 to-reel-warning/5 rounded-2xl p-4 mb-4 border border-reel-warning/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-reel-warning/20 flex items-center justify-center text-2xl">🏆</div>
            <div className="flex-1">
              <p className="text-white font-semibold">@{winner?.creatorName || 'Unknown'}</p>
              <p className="text-reel-muted text-xs">{winner?.title}</p>
            </div>
            <div className="text-right">
              <p className="text-reel-warning font-mono text-sm font-bold">{formatTokenAmount(winner?.predictionPool ?? 0n, 6)}</p>
              <p className="text-reel-muted text-[10px]">USDC pool</p>
            </div>
          </div>
        </motion.div>

        {/* Pool breakdown */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-reel-card rounded-2xl p-4 mb-4 border border-reel-border space-y-2.5"
        >
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-reel-primary" /> Pool Breakdown
          </h4>
          {[
            { label: 'Total Pool', value: payoutBreakdown.totalPool, color: 'text-white', icon: null },
            { label: 'Creator Fee (10%)', value: payoutBreakdown.creatorFee, color: 'text-purple-400', icon: <Gift className="w-3 h-3 text-purple-400" /> },
            { label: 'Platform Fee (2.5%)', value: payoutBreakdown.platformFee, color: 'text-reel-warning', icon: <Zap className="w-3 h-3 text-reel-warning" /> },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-reel-muted flex items-center gap-1.5">{item.icon} {item.label}</span>
              <span className={cn('font-mono', item.color)}>{formatTokenAmount(item.value, 6)} USDC</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-reel-border">
            <span className="text-reel-muted font-medium">Distributed to winners</span>
            <span className="text-reel-success font-mono font-bold">{formatTokenAmount(payoutBreakdown.distributablePool, 6)} USDC</span>
          </div>
        </motion.div>

        {/* User result */}
        {predictions.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={cn(
              'rounded-2xl p-4 mb-4 border',
              userBetOnWinner ? 'bg-reel-success/5 border-reel-success/20' : 'bg-reel-error/5 border-reel-error/20',
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              {userBetOnWinner ? (
                <CheckCircle className="w-5 h-5 text-reel-success" />
              ) : (
                <XCircle className="w-5 h-5 text-reel-error" />
              )}
              <span className={cn('font-semibold', userBetOnWinner ? 'text-reel-success' : 'text-reel-error')}>
                {userBetOnWinner ? 'You predicted correctly! 🎉' : 'Better luck next time'}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-reel-muted">Your stake</span>
                <span className="text-white font-mono">{formatTokenAmount(userTotalStaked, 6)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-reel-muted flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Multiplier</span>
                <span className="text-orange-400 font-mono font-bold">{formatMultiplier(userMult)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-reel-border/50">
                <span className="text-reel-muted font-medium">Payout</span>
                <span className={cn('font-mono font-bold text-base', userBetOnWinner ? 'text-reel-success' : 'text-reel-error')}>
                  {userBetOnWinner ? '+' : ''}{formatTokenAmount(userPayout, 6)} USDC
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Settlement info */}
        <div className="bg-reel-card/50 rounded-xl p-3 mb-5 text-xs text-reel-muted">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-reel-warning" />
            <span className="text-reel-warning font-semibold">Yellow Network</span>
          </div>
          <p>State signed & settled on-chain. Early bird payouts weighted by prediction time.</p>
        </div>

        <Button onClick={onRestart} className="w-full h-12 text-base font-semibold">
          🔄 Start New 2-Min Challenge
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ── Main challenge page ──

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

  const mockChallenge = useMemo(() => (isDemo ? getDemoChallenge() : getDefaultChallenge()), [isDemo]);

  useEffect(() => {
    setActiveChallenge(mockChallenge);
    setReels(mockReels.map((r) => ({ ...r, challengeId })));
  }, [setActiveChallenge, setReels, mockChallenge, challengeId]);

  // Demo countdown
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
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isDemo, mockChallenge.endTime, showResults, challengeId, requestSettlement]);

  // Live multiplier
  const [currentMultiplier, setCurrentMultiplier] = useState('');
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

  const handlePredictClick = useCallback(
    (reel: Reel) => {
      if (!isConnected) return;
      if (!session) {
        setDepositModalOpen(true);
        return;
      }
      setSelectedReel(reel);
      setShowPredictionPanel(true);
    },
    [isConnected, session, setDepositModalOpen],
  );

  const handleStartViewing = useCallback(() => setViewMode('feed'), []);

  const challenge = activeChallenge || mockChallenge;
  const displayReels = reels.length > 0 ? reels : mockReels;

  return (
    <div className="min-h-screen bg-reel-bg">
      {/* Results overlay */}
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
              <div className="flex items-center gap-2">
                <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-reel-surface transition-colors inline-flex">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </Link>
                <h1 className="font-display text-base font-semibold text-white truncate max-w-[140px]">
                  {challenge.title.replace('⚡ ', '')}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {currentMultiplier && (
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center gap-1"
                  >
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono font-bold text-orange-400">{currentMultiplier}</span>
                  </motion.div>
                )}
                <ConnectButton />
              </div>
            </div>
            <div className="neon-line" />
          </header>

          {/* Hero banner with countdown */}
          <section className="px-4 pt-4 pb-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-reel-border/40"
            >
              {/* Background cover */}
              {challenge.coverImage ? (
                <div className="absolute inset-0">
                  <img src={challenge.coverImage} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/50" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-reel-primary/10 to-reel-accent/10" />
              )}

              <div className="relative p-4 flex items-center gap-4">
                {/* Countdown ring (demo) or timer */}
                {isDemo ? (
                  <CountdownRing endTime={mockChallenge.endTime} startTime={mockChallenge.startTime} />
                ) : (
                  <div className="flex-shrink-0 px-3 py-2 rounded-xl glass">
                    <Clock className="w-4 h-4 text-reel-muted mx-auto mb-1" />
                    <span className="text-xs font-mono text-white">{formatTimeRemaining(challenge.endTime)}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs line-clamp-2 mb-3">{challenge.description}</p>

                  {/* Stat chips */}
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-reel-primary/10 text-reel-primary text-[11px] font-medium">
                      <Coins className="w-3 h-3" /> {formatTokenAmount(challenge.totalPool, 6)} USDC
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-reel-secondary/10 text-reel-secondary text-[11px] font-medium">
                      <Users className="w-3 h-3" /> {challenge.participantCount}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-reel-accent/10 text-reel-accent text-[11px] font-medium">
                      <Play className="w-3 h-3" /> {challenge.reelCount} reels
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Early bird + Session bar */}
          <section className="px-4 py-2 flex gap-2">
            {/* Early bird badge */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15 flex items-center gap-2"
            >
              <Flame className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-orange-400 text-xs font-semibold">Early Bird Bonus</p>
                <p className="text-[10px] text-reel-muted">Up to 5× payout multiplier</p>
              </div>
            </motion.div>

            {/* Session status */}
            {isConnected && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1"
              >
                {session ? (
                  <div className="h-full p-3 rounded-xl bg-reel-success/5 border border-reel-success/15 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-reel-success live-dot" />
                    <div>
                      <p className="text-reel-success text-xs font-semibold">Session Active</p>
                      <p className="text-[10px] font-mono text-white">{formatTokenAmount(session.availableBalance, 6)} USDC</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setDepositModalOpen(true)}
                    className="h-full w-full p-3 rounded-xl bg-reel-primary/10 border border-reel-primary/20 flex items-center gap-2 hover:bg-reel-primary/15 transition-colors"
                  >
                    <Zap className="w-5 h-5 text-reel-primary flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-reel-primary text-xs font-semibold">Deposit</p>
                      <p className="text-[10px] text-reel-muted">Start predicting</p>
                    </div>
                  </button>
                )}
              </motion.div>
            )}
          </section>

          {/* Reels grid */}
          <section className="px-4 pb-24 pt-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-reel-primary" />
                Competing Reels
              </h3>
              <Button onClick={handleStartViewing} variant="glass" size="sm">
                <Eye className="w-3.5 h-3.5" />
                Watch All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {displayReels.map((reel, index) => (
                <VideoReelCard
                  key={reel.id}
                  reel={reel}
                  index={index}
                  totalPool={challenge.totalPool}
                  onWatch={handleStartViewing}
                  onPredict={() => handlePredictClick(reel)}
                  isDemo={isDemo}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Full-screen reel feed */
        <div className="fixed inset-0 bg-black z-50">
          <ReelViewer reels={displayReels} onPredictClick={handlePredictClick} />
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
            onClose={() => { setShowPredictionPanel(false); setSelectedReel(null); }}
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
