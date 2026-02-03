/**
 * Settlement Service for Yellow Network Integration
 * Handles challenge settlement, winner calculation, and payout distribution
 */

import { ethers } from 'ethers';
import { getYellowClient, SettlementProof, Prediction } from './client';

// Contract ABI for settlement
const REEL_PREDICT_ABI = [
  {
    name: 'submitSettlement',
    type: 'function',
    inputs: [
      { name: 'challengeId', type: 'string' },
      {
        name: 'settlementData',
        type: 'tuple',
        components: [
          { name: 'stateHash', type: 'bytes32' },
          { name: 'signatures', type: 'bytes[]' },
          { name: 'participants', type: 'address[]' },
          { name: 'payouts', type: 'uint256[]' },
          { name: 'winnerReelId', type: 'string' },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: 'getChallenge',
    type: 'function',
    inputs: [{ name: 'challengeId', type: 'string' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'challengeId', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'totalPool', type: 'uint256' },
          { name: 'reelCount', type: 'uint256' },
          { name: 'isSettled', type: 'bool' },
          { name: 'winnerReelId', type: 'string' },
        ],
      },
    ],
  },
] as const;

export interface ReelStats {
  reelId: string;
  totalPredictions: bigint;
  totalVotes: number;
  uniquePredictors: number;
}

export interface SettlementResult {
  challengeId: string;
  winnerReelId: string;
  totalPool: bigint;
  payouts: { address: string; amount: bigint }[];
  transactionHash: string;
  timestamp: number;
}

export class SettlementService {
  private contractAddress: string;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.contractAddress = contractAddress;
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Calculate the winner reel based on predictions and votes
   */
  async calculateWinner(
    challengeId: string,
    predictions: Prediction[],
    votes: Map<string, number>
  ): Promise<ReelStats[]> {
    // Aggregate predictions by reel
    const reelStats = new Map<string, ReelStats>();

    for (const prediction of predictions) {
      if (prediction.challengeId !== challengeId) continue;
      if (prediction.status === 'cancelled') continue;

      const existing = reelStats.get(prediction.reelId) || {
        reelId: prediction.reelId,
        totalPredictions: 0n,
        totalVotes: 0,
        uniquePredictors: 0,
      };

      existing.totalPredictions += prediction.amount;
      existing.uniquePredictors += 1;
      existing.totalVotes = votes.get(prediction.reelId) || 0;

      reelStats.set(prediction.reelId, existing);
    }

    // Sort by weighted score (predictions * 0.7 + votes * 0.3)
    const sortedReels = Array.from(reelStats.values()).sort((a, b) => {
      const scoreA = Number(a.totalPredictions) * 0.7 + a.totalVotes * 0.3;
      const scoreB = Number(b.totalPredictions) * 0.7 + b.totalVotes * 0.3;
      return scoreB - scoreA;
    });

    return sortedReels;
  }

  /**
   * Calculate payouts for winning predictions
   */
  calculatePayouts(
    predictions: Prediction[],
    winnerReelId: string,
    totalPool: bigint,
    platformFeePercent: number = 250 // 2.5% in basis points
  ): Map<string, bigint> {
    const payouts = new Map<string, bigint>();

    // Get all predictions on the winning reel
    const winningPredictions = predictions.filter(
      (p) => p.reelId === winnerReelId && p.status !== 'cancelled'
    );

    if (winningPredictions.length === 0) {
      return payouts; // No winners, platform keeps the pool
    }

    // Calculate total winning predictions
    const totalWinningPredictions = winningPredictions.reduce(
      (sum, p) => sum + p.amount,
      0n
    );

    // Calculate distributable pool (after platform fee)
    const platformFee = (totalPool * BigInt(platformFeePercent)) / 10000n;
    const distributablePool = totalPool - platformFee;

    // Distribute proportionally to winning predictors
    for (const prediction of winningPredictions) {
      // Use session ID as proxy for user address (in production, would map to actual address)
      const userKey = prediction.sessionId;
      
      // Proportional share based on prediction amount
      const share = (prediction.amount * distributablePool) / totalWinningPredictions;
      
      const existing = payouts.get(userKey) || 0n;
      payouts.set(userKey, existing + share);
    }

    return payouts;
  }

  /**
   * Request settlement from Yellow Network and submit to smart contract
   */
  async settleChallenge(challengeId: string): Promise<SettlementResult> {
    if (!this.signer) {
      throw new Error('Signer required for settlement');
    }

    const client = getYellowClient();
    
    // Get settlement proof from Yellow Network
    const proof = await client.requestSettlement(challengeId);
    
    // Prepare settlement data for smart contract
    const settlementData = this.prepareSettlementData(proof);
    
    // Submit to smart contract
    const contract = new ethers.Contract(
      this.contractAddress,
      REEL_PREDICT_ABI,
      this.signer
    );

    const tx = await contract.submitSettlement(challengeId, settlementData);
    const receipt = await tx.wait();

    return {
      challengeId,
      winnerReelId: proof.winnerReelId,
      totalPool: Array.from(proof.payouts.values()).reduce((a, b) => a + b, 0n),
      payouts: Array.from(proof.payouts.entries()).map(([address, amount]) => ({
        address,
        amount,
      })),
      transactionHash: receipt.hash,
      timestamp: Date.now(),
    };
  }

  /**
   * Prepare settlement data for smart contract submission
   */
  private prepareSettlementData(proof: SettlementProof) {
    const participants: string[] = [];
    const payouts: bigint[] = [];

    for (const [address, amount] of proof.payouts) {
      participants.push(address);
      payouts.push(amount);
    }

    return {
      stateHash: proof.finalStateHash,
      signatures: proof.signatures,
      participants,
      payouts,
      winnerReelId: proof.winnerReelId,
    };
  }

  /**
   * Check if a challenge can be settled
   */
  async canSettle(challengeId: string): Promise<boolean> {
    const contract = new ethers.Contract(
      this.contractAddress,
      REEL_PREDICT_ABI,
      this.provider
    );

    try {
      const challenge = await contract.getChallenge(challengeId);
      const now = Math.floor(Date.now() / 1000);
      
      return (
        !challenge.isSettled &&
        BigInt(challenge.endTime) <= BigInt(now)
      );
    } catch (error) {
      console.error('Error checking settlement eligibility:', error);
      return false;
    }
  }

  /**
   * Get settlement status for a challenge
   */
  async getSettlementStatus(challengeId: string): Promise<{
    isSettled: boolean;
    winnerReelId: string;
    totalPool: bigint;
  }> {
    const contract = new ethers.Contract(
      this.contractAddress,
      REEL_PREDICT_ABI,
      this.provider
    );

    const challenge = await contract.getChallenge(challengeId);
    
    return {
      isSettled: challenge.isSettled,
      winnerReelId: challenge.winnerReelId,
      totalPool: BigInt(challenge.totalPool),
    };
  }
}

/**
 * Settlement notification service
 */
export class SettlementNotifier {
  private subscribers: Map<string, ((result: SettlementResult) => void)[]> = new Map();

  /**
   * Subscribe to settlement notifications for a challenge
   */
  subscribe(challengeId: string, callback: (result: SettlementResult) => void): () => void {
    const existing = this.subscribers.get(challengeId) || [];
    existing.push(callback);
    this.subscribers.set(challengeId, existing);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(challengeId) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        this.subscribers.set(challengeId, callbacks);
      }
    };
  }

  /**
   * Notify all subscribers of a settlement
   */
  notify(result: SettlementResult): void {
    const callbacks = this.subscribers.get(result.challengeId) || [];
    for (const callback of callbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error('Error in settlement notification callback:', error);
      }
    }
  }
}

// Singleton instances
let settlementServiceInstance: SettlementService | null = null;
let settlementNotifierInstance: SettlementNotifier | null = null;

export function initializeSettlementService(
  contractAddress: string,
  provider: ethers.Provider,
  signer?: ethers.Signer
): SettlementService {
  settlementServiceInstance = new SettlementService(contractAddress, provider, signer);
  return settlementServiceInstance;
}

export function getSettlementService(): SettlementService {
  if (!settlementServiceInstance) {
    throw new Error('Settlement service not initialized');
  }
  return settlementServiceInstance;
}

export function getSettlementNotifier(): SettlementNotifier {
  if (!settlementNotifierInstance) {
    settlementNotifierInstance = new SettlementNotifier();
  }
  return settlementNotifierInstance;
}
