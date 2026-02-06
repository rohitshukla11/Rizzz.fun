/**
 * Settlement Service for Yellow Network Nitrolite Integration
 * Handles challenge settlement, winner calculation, and payout distribution
 * Based on Yellow Network App Sessions settlement flow
 */

import { ethers } from 'ethers';
import { getYellowClientSafe, type SessionState, type PredictionState } from './nitrolite-client';

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
  stateHash: string;
  signatures: string[];
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
   * Uses Yellow Network App Session state
   */
  async calculateWinner(
    challengeId: string,
    predictions: PredictionState[],
    votes: Map<string, number>
  ): Promise<ReelStats[]> {
    // Aggregate predictions by reel
    const reelStats = new Map<string, ReelStats>();

    for (const prediction of predictions) {
      if (prediction.challengeId !== challengeId) continue;

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
   * Based on Yellow Network App Session final state
   */
  calculatePayouts(
    predictions: PredictionState[],
    winnerReelId: string,
    totalPool: bigint,
    sessionParticipants: string[], // Participants from App Session
    platformFeePercent: number = 250 // 2.5% in basis points
  ): Map<string, bigint> {
    const payouts = new Map<string, bigint>();

    // Get all predictions on the winning reel
    const winningPredictions = predictions.filter(
      (p) => p.reelId === winnerReelId
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

    // Map predictions to participants (in production, would use proper mapping)
    const participantPredictions = new Map<string, bigint>();
    for (let i = 0; i < winningPredictions.length && i < sessionParticipants.length; i++) {
      const participant = sessionParticipants[i];
      const existing = participantPredictions.get(participant) || 0n;
      participantPredictions.set(participant, existing + winningPredictions[i].amount);
    }

    // Distribute proportionally to winning predictors
    for (const [participant, totalAmount] of participantPredictions) {
      const share = (totalAmount * distributablePool) / totalWinningPredictions;
      payouts.set(participant, share);
    }

    return payouts;
  }

  /**
   * Request settlement from Yellow Network App Session and submit to smart contract
   * Based on Yellow Network settlement flow
   */
  async settleChallenge(challengeId: string, winnerReelId: string): Promise<SettlementResult> {
    if (!this.signer) {
      throw new Error('Signer required for settlement');
    }

    const client = getYellowClientSafe();
    if (!client) throw new Error('Yellow Network client not initialised');
    
    // Request settlement from Yellow Network App Session
    // This aggregates all off-chain state
    const settlement = await client.requestSettlement(challengeId);
    
    // Get final state from settlement
    const finalState = settlement.finalState;
    
    // Calculate winner and payouts from final state
    const predictions = Array.from(finalState.predictions.values());
    const votes = Array.from(finalState.votes.values());
    const voteCounts = new Map<string, number>();
    
    for (const vote of votes) {
      const count = voteCounts.get(vote.reelId) || 0;
      voteCounts.set(vote.reelId, count + 1);
    }
    
    const reelStats = await this.calculateWinner(challengeId, predictions, voteCounts);
    const winner = reelStats[0]?.reelId || winnerReelId;
    
    // Get session participants
    const session = client.getSession();
    const participants = session?.participants || [];
    
    // Calculate payouts
    const payouts = this.calculatePayouts(
      predictions,
      winner,
      finalState.balance,
      participants
    );
    
    // Prepare settlement data for smart contract
    const settlementData = this.prepareSettlementData(
      settlement.stateHash,
      settlement.signatures,
      participants,
      payouts,
      winner
    );
    
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
      winnerReelId: winner,
      totalPool: finalState.balance,
      payouts: Array.from(payouts.entries()).map(([address, amount]) => ({
        address,
        amount,
      })),
      transactionHash: receipt.hash,
      timestamp: Date.now(),
      stateHash: settlement.stateHash,
      signatures: settlement.signatures,
    };
  }

  /**
   * Prepare settlement data for smart contract submission
   * Formats Yellow Network App Session settlement for on-chain submission
   */
  private prepareSettlementData(
    stateHash: string,
    signatures: string[],
    participants: string[],
    payouts: Map<string, bigint>,
    winnerReelId: string
  ) {
    const participantList: string[] = [];
    const payoutList: bigint[] = [];

    for (const participant of participants) {
      participantList.push(participant);
      payoutList.push(payouts.get(participant) || 0n);
    }

    return {
      stateHash,
      signatures,
      participants: participantList,
      payouts: payoutList,
      winnerReelId,
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
