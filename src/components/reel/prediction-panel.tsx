'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, TrendingUp, Zap, AlertCircle, CheckCircle, Clock, Flame } from 'lucide-react';
import { useAppStore, type Reel } from '@/store/app-store';
import { usePredictions, useYellowSession } from '@/lib/yellow';
import { Button } from '@/components/ui/button';
import { cn, formatTokenAmount, parseTokenAmount, calculatePercentage, formatPercentage } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { getCurrentMultiplierInfo, estimatePayout, formatMultiplier } from '@/lib/payout-algorithm';
import { ENSName } from '@/components/ens/ens-identity';

interface PredictionPanelProps {
  reel: Reel | null;
  challengeId: string;
  onClose: () => void;
}

const quickAmounts = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

export function PredictionPanel({ reel, challengeId, onClose }: PredictionPanelProps) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { session, availableBalance } = useYellowSession();
  const { makePrediction, getTotalForReel, isLoading } = usePredictions(challengeId);
  const { addToast } = useToast();
  const { addPrediction, activeChallenge } = useAppStore();

  // USDC-style tokens use 6 decimals
  const parsedAmount = amount ? parseTokenAmount(amount, 6) : 0n;
  const isValidAmount = parsedAmount > 0n && parsedAmount <= availableBalance;
  
  const currentPredictionOnReel = reel ? getTotalForReel(challengeId, reel.id) : 0n;
  const totalPoolAfterPrediction = (activeChallenge?.totalPool || 0n) + parsedAmount;
  const potentialPercentage = calculatePercentage(
    (reel?.predictionPool || 0n) + parsedAmount,
    totalPoolAfterPrediction
  );

  // ── Live multiplier ───────────────────────────
  const [multiplierInfo, setMultiplierInfo] = useState(() =>
    activeChallenge
      ? getCurrentMultiplierInfo(activeChallenge.startTime, activeChallenge.endTime)
      : null
  );

  // Refresh multiplier every second so the user sees it ticking down
  useEffect(() => {
    if (!activeChallenge) return;
    const tick = () =>
      setMultiplierInfo(getCurrentMultiplierInfo(activeChallenge.startTime, activeChallenge.endTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeChallenge]);

  // Estimated payout if user wins
  const estimatedPayout =
    activeChallenge && parsedAmount > 0n
      ? estimatePayout(
          parsedAmount,
          activeChallenge.totalPool,
          activeChallenge.startTime,
          activeChallenge.endTime,
        )
      : 0n;

  useEffect(() => {
    if (!reel) {
      setAmount('');
      setShowSuccess(false);
    }
  }, [reel]);

  const handleSubmit = useCallback(async () => {
    if (!reel || !isValidAmount) return;

    setIsSubmitting(true);
    try {
      await makePrediction(challengeId, reel.id, parsedAmount);
      
      addPrediction({
        challengeId,
        reelId: reel.id,
        amount: parsedAmount,
        timestamp: Date.now(),
      });

      setShowSuccess(true);
      addToast({
        type: 'success',
        title: 'Prediction placed!',
        message: `${formatTokenAmount(parsedAmount, 6)} USDC on ${reel.title} at ${multiplierInfo?.formatted || '1×'} multiplier`,
      });

      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        setAmount('');
      }, 1500);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Prediction failed',
        message: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [reel, isValidAmount, parsedAmount, challengeId, makePrediction, addPrediction, addToast, onClose, multiplierInfo]);

  const handleQuickAmount = useCallback((value: number) => {
    setAmount(value.toString());
  }, []);

  if (!reel) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute bottom-0 left-0 right-0 bg-reel-surface rounded-t-3xl overflow-hidden safe-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 bg-reel-border rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">
                Make Prediction
              </h3>
              <p className="text-sm text-reel-muted mt-0.5">
                Instant & gasless via Yellow Network
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-reel-card transition-colors"
            >
              <X className="w-5 h-5 text-reel-muted" />
            </button>
          </div>

          {/* Success state */}
          {showSuccess ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-5 py-12 flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full bg-reel-success/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-reel-success" />
              </div>
              <h4 className="font-display text-2xl font-semibold text-white">
                Prediction Placed!
              </h4>
              <p className="text-reel-muted mt-2">
                No gas fees, instant confirmation
              </p>
            </motion.div>
          ) : (
            <>
              {/* ── Multiplier badge ─────────────────── */}
              {multiplierInfo && (
                <div className="px-5 pb-3">
                  <div className={cn(
                    'flex items-center justify-between p-3 rounded-xl border',
                    multiplierInfo.multiplier >= 3.0
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : multiplierInfo.multiplier >= 2.0
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-blue-500/10 border-blue-500/30',
                  )}>
                    <div className="flex items-center gap-2">
                      <Flame className={cn('w-5 h-5', multiplierInfo.color)} />
                      <div>
                        <p className={cn('text-sm font-bold', multiplierInfo.color)}>
                          {multiplierInfo.label}
                        </p>
                        <p className="text-[10px] text-reel-muted">
                          Early predictions earn more
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xl font-mono font-bold', multiplierInfo.color)}>
                        {multiplierInfo.formatted}
                      </p>
                      <p className="text-[10px] text-reel-muted flex items-center gap-0.5 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        {Math.round(multiplierInfo.timeProgress * 100)}% elapsed
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reel preview */}
              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-reel-card">
                  <div className="w-16 h-24 rounded-lg bg-reel-surface overflow-hidden flex-shrink-0">
                    {reel.thumbnailUrl ? (
                      <img 
                        src={reel.thumbnailUrl} 
                        alt={reel.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-reel-primary/30 to-reel-accent/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{reel.title}</p>
                    <p className="text-sm text-reel-muted">
                      <ENSName
                        address={reel.creatorAddress}
                        className="text-reel-muted"
                        showLoading={false}
                      />
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 text-xs text-reel-muted">
                        <Coins className="w-3.5 h-3.5 text-reel-primary" />
                        {formatTokenAmount(reel.predictionPool)}
                      </div>
                      {currentPredictionOnReel > 0n && (
                        <div className="flex items-center gap-1 text-xs text-reel-success">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Your: {formatTokenAmount(currentPredictionOnReel)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount input */}
              <div className="px-5 pb-4">
                <label className="block text-sm text-reel-muted mb-2">
                  Prediction Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      setAmount(value);
                    }}
                    placeholder="0.00"
                    className="w-full h-14 px-4 pr-20 rounded-xl bg-reel-card border border-reel-border focus:border-reel-primary focus:ring-1 focus:ring-reel-primary/50 outline-none text-2xl font-mono text-white placeholder:text-reel-muted/50 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-reel-muted font-medium">USDC</span>
                  </div>
                </div>

                {/* Balance info */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-reel-muted">
                    Available: {formatTokenAmount(availableBalance, 6)} USDC
                  </span>
                  {parsedAmount > availableBalance && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Insufficient balance
                    </span>
                  )}
                </div>
              </div>

              {/* Quick amounts */}
              <div className="px-5 pb-4">
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((value) => (
                    <button
                      key={value}
                      onClick={() => handleQuickAmount(value)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        parseFloat(amount) === value
                          ? 'bg-reel-primary text-white'
                          : 'bg-reel-card text-reel-muted hover:bg-reel-card/80 hover:text-white'
                      )}
                    >
                      {value}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(formatTokenAmount(availableBalance))}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-reel-card text-reel-muted hover:bg-reel-card/80 hover:text-white transition-all"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* ── Potential outcome (time-weighted) ───────── */}
              {parsedAmount > 0n && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-5 pb-4"
                >
                  <div className="p-3 rounded-xl bg-reel-card border border-reel-border space-y-2">
                    {/* Pool share */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-reel-muted flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-reel-primary" />
                        Pool share
                      </span>
                      <span className="text-white font-medium">{formatPercentage(potentialPercentage)}</span>
                    </div>

                    {/* Multiplier applied */}
                    {multiplierInfo && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-reel-muted flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-400" />
                          Your multiplier
                        </span>
                        <span className={cn('font-mono font-bold', multiplierInfo.color)}>
                          {multiplierInfo.formatted}
                        </span>
                      </div>
                    )}

                    {/* Estimated payout */}
                    {estimatedPayout > 0n && (
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-reel-border">
                        <span className="text-reel-muted flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-reel-success" />
                          Est. payout if wins
                        </span>
                        <span className="text-reel-success font-mono font-bold">
                          +{formatTokenAmount(estimatedPayout, 6)} USDC
                        </span>
                      </div>
                    )}

                    {/* Fee note */}
                    <p className="text-[10px] text-reel-muted/60 pt-1">
                      10% → reel creator • 2.5% → platform • rest distributed by time-weighted share
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Submit button */}
              <div className="px-5 pb-6">
                <Button
                  onClick={handleSubmit}
                  disabled={!isValidAmount || isSubmitting}
                  isLoading={isSubmitting}
                  className="w-full h-14 text-lg"
                  variant="default"
                >
                  <Zap className="w-5 h-5" />
                  {isSubmitting
                    ? 'Placing Prediction...'
                    : `Predict Now${multiplierInfo ? ` (${multiplierInfo.formatted})` : ''}`}
                </Button>
                
                <p className="text-center text-xs text-reel-muted mt-3 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3 text-reel-warning" />
                  Powered by Yellow Network • No gas fees
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
