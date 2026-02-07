/**
 * Time-Weighted Payout Algorithm — inspired by jpeg.fun
 *
 * Core idea:
 *   Early bids receive a higher payout multiplier than late bids.
 *   A portion of the pool goes to the winning reel's **creator**.
 *
 * ──────────────────────────────────────────────
 * MULTIPLIER FORMULA  (quadratic decay)
 * ──────────────────────────────────────────────
 *
 *   timeProgress = (bidTime − contestStart) / (contestEnd − contestStart)
 *   multiplier   = MIN + (MAX − MIN) × (1 − timeProgress)²
 *
 *   At t=0%   → 5.00×
 *   At t=25%  → 3.25×
 *   At t=50%  → 2.00×
 *   At t=75%  → 1.25×
 *   At t=100% → 1.00×
 *
 * ──────────────────────────────────────────────
 * PAYOUT DISTRIBUTION
 * ──────────────────────────────────────────────
 *
 *   1. Creator fee  = CREATOR_FEE_BPS of totalPool  → to winning reel creator
 *   2. Platform fee = PLATFORM_FEE_BPS of totalPool → to platform
 *   3. distributablePool = totalPool − creatorFee − platformFee
 *   4. For each prediction on the WINNING reel:
 *        weight = amount × multiplier(bidTime)
 *   5. payout = (weight / totalWeight) × distributablePool
 *
 * This means a 1 USDC bid at minute 1 earns ~2.5× the share of
 * the same 1 USDC bid placed halfway through the contest.
 */

// ── Constants ───────────────────────────────────

/** Maximum multiplier for bids placed at t = 0 */
export const MAX_MULTIPLIER = 5.0;

/** Minimum multiplier for bids placed at t = contestEnd */
export const MIN_MULTIPLIER = 1.0;

/** Creator fee in basis points (500 = 5%) */
export const CREATOR_FEE_BPS = 500;

/** Platform fee in basis points (250 = 2.5%) */
export const PLATFORM_FEE_BPS = 250;

// ── Types ───────────────────────────────────────

export interface TimedPrediction {
  id: string;
  /** Which reel this prediction is on */
  reelId: string;
  /** USDC amount in raw units (6 decimals) */
  amount: bigint;
  /** Unix ms timestamp when the prediction was placed */
  timestamp: number;
  /** Address / identifier of the predictor */
  predictor?: string;
}

export interface PayoutBreakdown {
  /** Map of predictionId → payout amount */
  predictorPayouts: Map<string, bigint>;
  /** Amount allocated to the winning reel's creator */
  creatorFee: bigint;
  /** Amount allocated to the platform */
  platformFee: bigint;
  /** Total pool used for distribution */
  distributablePool: bigint;
  /** The total pool before fees */
  totalPool: bigint;
  /** The winning reel ID */
  winnerReelId: string;
}

export interface MultiplierInfo {
  /** Current multiplier value (1.0 – 5.0) */
  multiplier: number;
  /** How far through the contest we are (0 – 1) */
  timeProgress: number;
  /** Formatted string like "3.25×" */
  formatted: string;
  /** Descriptive label like "Early Bird" */
  label: string;
  /** Tailwind colour class */
  color: string;
}

// ── Core Algorithm ──────────────────────────────

/**
 * Calculate the time-weighted multiplier for a prediction placed at `bidTime`.
 *
 * Uses a **quadratic decay** so early bidders get a dramatically higher
 * multiplier, with the advantage tapering off smoothly.
 */
export function getMultiplier(
  bidTime: number,
  contestStart: number,
  contestEnd: number,
): number {
  const duration = contestEnd - contestStart;
  if (duration <= 0) return MIN_MULTIPLIER;

  const elapsed = Math.max(0, Math.min(duration, bidTime - contestStart));
  const timeProgress = elapsed / duration; // 0.0 → 1.0

  // Quadratic decay: (1 − t)²
  const decay = (1 - timeProgress) ** 2;
  return MIN_MULTIPLIER + (MAX_MULTIPLIER - MIN_MULTIPLIER) * decay;
}

/**
 * Get multiplier info for UI display at the current moment.
 */
export function getCurrentMultiplierInfo(
  contestStart: number,
  contestEnd: number,
  now: number = Date.now(),
): MultiplierInfo {
  const multiplier = getMultiplier(now, contestStart, contestEnd);
  const duration = contestEnd - contestStart;
  const timeProgress = duration > 0 ? Math.max(0, Math.min(1, (now - contestStart) / duration)) : 1;

  let label: string;
  let color: string;

  if (multiplier >= 4.0) {
    label = '🔥 Early Bird';
    color = 'text-red-400';
  } else if (multiplier >= 3.0) {
    label = '⚡ Fast Mover';
    color = 'text-orange-400';
  } else if (multiplier >= 2.0) {
    label = '💫 Good Timing';
    color = 'text-yellow-400';
  } else if (multiplier >= 1.5) {
    label = '⏰ Late Entry';
    color = 'text-blue-400';
  } else {
    label = '🕐 Last Minute';
    color = 'text-gray-400';
  }

  return {
    multiplier,
    timeProgress,
    formatted: `${multiplier.toFixed(2)}×`,
    label,
    color,
  };
}

/**
 * Calculate the weight of a single prediction (amount × multiplier).
 * Returns a bigint-safe integer by scaling the multiplier by 10000.
 */
function weightedAmount(
  amount: bigint,
  bidTime: number,
  contestStart: number,
  contestEnd: number,
): bigint {
  const mul = getMultiplier(bidTime, contestStart, contestEnd);
  // Scale to 4 decimal places for bigint precision
  const mulScaled = BigInt(Math.round(mul * 10000));
  return (amount * mulScaled) / 10000n;
}

/**
 * Calculate full payout breakdown for a contest.
 *
 * @param predictions   - All predictions across all reels for this challenge
 * @param winnerReelId  - The reel that won
 * @param contestStart  - Unix ms timestamp when the contest started
 * @param contestEnd    - Unix ms timestamp when the contest ended
 * @param creatorFeeBps - Creator fee in basis points (default 500 = 5%)
 * @param platformFeeBps- Platform fee in basis points (default 250 = 2.5%)
 */
export function calculateTimeWeightedPayouts(
  predictions: TimedPrediction[],
  winnerReelId: string,
  contestStart: number,
  contestEnd: number,
  creatorFeeBps: number = CREATOR_FEE_BPS,
  platformFeeBps: number = PLATFORM_FEE_BPS,
): PayoutBreakdown {
  // 1. Total pool = sum of ALL predictions (winners + losers)
  const totalPool = predictions.reduce((sum, p) => sum + p.amount, 0n);

  // 2. Fees
  const creatorFee = (totalPool * BigInt(creatorFeeBps)) / 10000n;
  const platformFee = (totalPool * BigInt(platformFeeBps)) / 10000n;
  const distributablePool = totalPool - creatorFee - platformFee;

  // 3. Winning predictions with time-weighted amounts
  const winningPredictions = predictions.filter((p) => p.reelId === winnerReelId);

  const predictorPayouts = new Map<string, bigint>();

  if (winningPredictions.length === 0 || distributablePool <= 0n) {
    return { predictorPayouts, creatorFee, platformFee, distributablePool, totalPool, winnerReelId };
  }

  // 4. Calculate weighted amounts for each winning prediction
  const weights: { id: string; weight: bigint }[] = [];
  let totalWeight = 0n;

  for (const pred of winningPredictions) {
    const w = weightedAmount(pred.amount, pred.timestamp, contestStart, contestEnd);
    weights.push({ id: pred.id, weight: w });
    totalWeight += w;
  }

  // 5. Distribute pool proportionally to weights
  if (totalWeight > 0n) {
    let distributed = 0n;
    for (let i = 0; i < weights.length; i++) {
      const { id, weight } = weights[i];
      let payout: bigint;
      if (i === weights.length - 1) {
        // Last one gets the remainder to avoid rounding dust
        payout = distributablePool - distributed;
      } else {
        payout = (weight * distributablePool) / totalWeight;
      }
      distributed += payout;
      predictorPayouts.set(id, payout);
    }
  }

  return { predictorPayouts, creatorFee, platformFee, distributablePool, totalPool, winnerReelId };
}

/**
 * Estimate what a user would earn if they predicted right now.
 * Useful for showing "potential payout" in the UI.
 *
 * Simplified model: assumes user is the only predictor at this moment
 * and the rest of the pool stays the same.
 *
 * @returns Estimated payout in raw USDC units (6 decimals)
 */
export function estimatePayout(
  userAmount: bigint,
  currentPoolSize: bigint,
  contestStart: number,
  contestEnd: number,
  now: number = Date.now(),
): bigint {
  if (userAmount <= 0n) return 0n;

  const mul = getMultiplier(now, contestStart, contestEnd);
  const totalPool = currentPoolSize + userAmount;

  // Fees
  const fees = (totalPool * BigInt(CREATOR_FEE_BPS + PLATFORM_FEE_BPS)) / 10000n;
  const distributable = totalPool - fees;

  // Simplified: assume user's weighted share ≈ mul * amount / (pool + mul * amount)
  const mulScaled = BigInt(Math.round(mul * 10000));
  const userWeight = (userAmount * mulScaled) / 10000n;
  // Assume existing pool has average multiplier of ~2x (rough midpoint)
  const existingWeight = (currentPoolSize * 20000n) / 10000n;
  const totalWeight = existingWeight + userWeight;

  if (totalWeight <= 0n) return 0n;

  return (userWeight * distributable) / totalWeight;
}

/**
 * Format multiplier as a human-readable badge.
 * e.g., "5.00×" for a freshly-started contest.
 */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}×`;
}
