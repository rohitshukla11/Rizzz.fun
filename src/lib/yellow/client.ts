/**
 * Yellow Network SDK Client Integration
 * Handles state channel management for gasless predictions
 */

import { EventEmitter } from 'events';

// Yellow Network Clearnode endpoints
const CLEARNODE_ENDPOINTS = {
  production: 'wss://clearnet.yellow.com/ws',
  sandbox: 'wss://clearnet-sandbox.yellow.com/ws',
} as const;

export type YellowEnvironment = keyof typeof CLEARNODE_ENDPOINTS;

// Types for Yellow Network integration
export interface YellowSession {
  sessionId: string;
  channelId: string;
  userAddress: string;
  depositedAmount: bigint;
  availableBalance: bigint;
  lockedInPredictions: bigint;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'settling' | 'settled' | 'expired';
}

export interface Prediction {
  id: string;
  sessionId: string;
  challengeId: string;
  reelId: string;
  amount: bigint;
  timestamp: number;
  nonce: number;
  signature: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'settled';
}

export interface Vote {
  id: string;
  sessionId: string;
  challengeId: string;
  reelId: string;
  timestamp: number;
  signature: string;
}

export interface SettlementProof {
  channelId: string;
  finalStateHash: string;
  signatures: string[];
  predictions: Prediction[];
  winnerReelId: string;
  payouts: Map<string, bigint>;
}

export interface YellowClientConfig {
  environment: YellowEnvironment;
  signer: any; // viem WalletClient or ethers Signer
  onSessionUpdate?: (session: YellowSession) => void;
  onPredictionConfirmed?: (prediction: Prediction) => void;
  onSettlement?: (proof: SettlementProof) => void;
}

export class YellowClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: YellowClientConfig;
  private session: YellowSession | null = null;
  private predictions: Map<string, Prediction> = new Map();
  private votes: Map<string, Vote> = new Map();
  private messageQueue: Map<string, { resolve: Function; reject: Function }> = new Map();
  private nonce: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: YellowClientConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to Yellow Network Clearnode
   */
  async connect(): Promise<void> {
    const endpoint = CLEARNODE_ENDPOINTS[this.config.environment];
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        console.log('Connected to Yellow Network Clearnode');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('Yellow Network WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Yellow Network');
        this.stopHeartbeat();
        this.emit('disconnected');
        this.attemptReconnect();
      };
    });
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Open a new state channel with initial deposit
   * This is the only on-chain operation required before making predictions
   */
  async openSession(depositAmount: bigint, challengeId: string): Promise<YellowSession> {
    const userAddress = await this.getUserAddress();
    
    // Create channel opening message
    const openMessage = {
      method: 'channel_open',
      params: {
        participant: userAddress,
        amount: depositAmount.toString(),
        challengeId,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    // Sign the channel opening request
    const signature = await this.signMessage(JSON.stringify(openMessage.params));
    openMessage.params = { ...openMessage.params, signature } as any;

    const response = await this.sendMessage(openMessage);

    this.session = {
      sessionId: response.sessionId,
      channelId: response.channelId,
      userAddress,
      depositedAmount: depositAmount,
      availableBalance: depositAmount,
      lockedInPredictions: 0n,
      createdAt: Date.now(),
      expiresAt: response.expiresAt,
      status: 'active',
    };

    this.emit('sessionOpened', this.session);
    this.config.onSessionUpdate?.(this.session);

    return this.session;
  }

  /**
   * Make a prediction on a reel - INSTANT & GASLESS
   * This happens entirely off-chain through Yellow Network
   */
  async makePrediction(challengeId: string, reelId: string, amount: bigint): Promise<Prediction> {
    if (!this.session) {
      throw new Error('No active session. Please open a session first.');
    }

    if (this.session.availableBalance < amount) {
      throw new Error('Insufficient balance for prediction');
    }

    const predictionId = this.generatePredictionId();
    const currentNonce = ++this.nonce;

    const predictionData = {
      method: 'prediction_submit',
      params: {
        sessionId: this.session.sessionId,
        channelId: this.session.channelId,
        challengeId,
        reelId,
        amount: amount.toString(),
        nonce: currentNonce,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    // Sign the prediction
    const signature = await this.signMessage(JSON.stringify(predictionData.params));

    const prediction: Prediction = {
      id: predictionId,
      sessionId: this.session.sessionId,
      challengeId,
      reelId,
      amount,
      timestamp: Date.now(),
      nonce: currentNonce,
      signature,
      status: 'pending',
    };

    // Send to Clearnode
    const response = await this.sendMessage({
      ...predictionData,
      params: { ...predictionData.params, signature },
    });

    // Update local state immediately (optimistic update)
    prediction.status = 'confirmed';
    this.predictions.set(predictionId, prediction);

    // Update session balance
    this.session.availableBalance -= amount;
    this.session.lockedInPredictions += amount;

    this.emit('predictionMade', prediction);
    this.config.onPredictionConfirmed?.(prediction);
    this.config.onSessionUpdate?.(this.session);

    return prediction;
  }

  /**
   * Update an existing prediction - INSTANT & GASLESS
   * Allows changing prediction amount before deadline
   */
  async updatePrediction(predictionId: string, newAmount: bigint): Promise<Prediction> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const existingPrediction = this.predictions.get(predictionId);
    if (!existingPrediction) {
      throw new Error('Prediction not found');
    }

    const amountDiff = newAmount - existingPrediction.amount;
    if (amountDiff > 0 && this.session.availableBalance < amountDiff) {
      throw new Error('Insufficient balance for prediction increase');
    }

    const currentNonce = ++this.nonce;

    const updateData = {
      method: 'prediction_update',
      params: {
        sessionId: this.session.sessionId,
        channelId: this.session.channelId,
        predictionId,
        previousNonce: existingPrediction.nonce,
        newAmount: newAmount.toString(),
        nonce: currentNonce,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    const signature = await this.signMessage(JSON.stringify(updateData.params));

    await this.sendMessage({
      ...updateData,
      params: { ...updateData.params, signature },
    });

    // Update local state
    const oldAmount = existingPrediction.amount;
    existingPrediction.amount = newAmount;
    existingPrediction.nonce = currentNonce;
    existingPrediction.signature = signature;
    existingPrediction.timestamp = Date.now();

    // Update session balance
    this.session.availableBalance -= amountDiff;
    this.session.lockedInPredictions += amountDiff;

    this.emit('predictionUpdated', existingPrediction);
    this.config.onSessionUpdate?.(this.session);

    return existingPrediction;
  }

  /**
   * Cancel a prediction - INSTANT & GASLESS
   */
  async cancelPrediction(predictionId: string): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error('Prediction not found');
    }

    const currentNonce = ++this.nonce;

    const cancelData = {
      method: 'prediction_cancel',
      params: {
        sessionId: this.session.sessionId,
        channelId: this.session.channelId,
        predictionId,
        nonce: currentNonce,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    const signature = await this.signMessage(JSON.stringify(cancelData.params));

    await this.sendMessage({
      ...cancelData,
      params: { ...cancelData.params, signature },
    });

    // Update local state
    prediction.status = 'cancelled';
    this.session.availableBalance += prediction.amount;
    this.session.lockedInPredictions -= prediction.amount;

    this.emit('predictionCancelled', prediction);
    this.config.onSessionUpdate?.(this.session);
  }

  /**
   * Cast a vote for a reel - INSTANT & GASLESS
   */
  async vote(challengeId: string, reelId: string): Promise<Vote> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const voteId = this.generateVoteId();

    const voteData = {
      method: 'vote_submit',
      params: {
        sessionId: this.session.sessionId,
        channelId: this.session.channelId,
        challengeId,
        reelId,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    const signature = await this.signMessage(JSON.stringify(voteData.params));

    await this.sendMessage({
      ...voteData,
      params: { ...voteData.params, signature },
    });

    const vote: Vote = {
      id: voteId,
      sessionId: this.session.sessionId,
      challengeId,
      reelId,
      timestamp: Date.now(),
      signature,
    };

    this.votes.set(voteId, vote);
    this.emit('voteCast', vote);

    return vote;
  }

  /**
   * Request settlement when challenge ends
   * This aggregates all off-chain state and prepares for on-chain settlement
   */
  async requestSettlement(challengeId: string): Promise<SettlementProof> {
    if (!this.session) {
      throw new Error('No active session');
    }

    this.session.status = 'settling';
    this.emit('settlementStarted', { challengeId });

    const settlementRequest = {
      method: 'settlement_request',
      params: {
        sessionId: this.session.sessionId,
        channelId: this.session.channelId,
        challengeId,
        timestamp: Date.now(),
      },
      id: this.generateMessageId(),
    };

    const signature = await this.signMessage(JSON.stringify(settlementRequest.params));

    const response = await this.sendMessage({
      ...settlementRequest,
      params: { ...settlementRequest.params, signature },
    });

    const proof: SettlementProof = {
      channelId: this.session.channelId,
      finalStateHash: response.stateHash,
      signatures: response.signatures,
      predictions: Array.from(this.predictions.values()),
      winnerReelId: response.winnerReelId,
      payouts: new Map(Object.entries(response.payouts).map(([k, v]) => [k, BigInt(v as string)])),
    };

    this.emit('settlementProofGenerated', proof);
    this.config.onSettlement?.(proof);

    return proof;
  }

  /**
   * Get current session state
   */
  getSession(): YellowSession | null {
    return this.session;
  }

  /**
   * Get all predictions for current session
   */
  getPredictions(): Prediction[] {
    return Array.from(this.predictions.values());
  }

  /**
   * Get predictions for a specific challenge
   */
  getPredictionsForChallenge(challengeId: string): Prediction[] {
    return Array.from(this.predictions.values())
      .filter(p => p.challengeId === challengeId && p.status !== 'cancelled');
  }

  /**
   * Get total amount predicted on a specific reel
   */
  getTotalPredictionForReel(challengeId: string, reelId: string): bigint {
    return this.getPredictionsForChallenge(challengeId)
      .filter(p => p.reelId === reelId)
      .reduce((sum, p) => sum + p.amount, 0n);
  }

  // Private helper methods

  private async getUserAddress(): Promise<string> {
    if (this.config.signer.getAddress) {
      // ethers signer
      return await this.config.signer.getAddress();
    } else if (this.config.signer.account) {
      // viem wallet client
      return this.config.signer.account.address;
    }
    throw new Error('Unable to get user address from signer');
  }

  private async signMessage(message: string): Promise<string> {
    if (this.config.signer.signMessage) {
      // Both ethers and viem support signMessage
      return await this.config.signer.signMessage({ message });
    }
    throw new Error('Signer does not support message signing');
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = message.id;
      this.messageQueue.set(messageId, { resolve, reject });

      this.ws.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageQueue.has(messageId)) {
          this.messageQueue.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private handleMessage(message: any): void {
    if (message.id && this.messageQueue.has(message.id)) {
      const { resolve, reject } = this.messageQueue.get(message.id)!;
      this.messageQueue.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Handle push notifications from Clearnode
    switch (message.method) {
      case 'session_update':
        if (this.session) {
          Object.assign(this.session, message.params);
          this.emit('sessionUpdate', this.session);
          this.config.onSessionUpdate?.(this.session);
        }
        break;

      case 'prediction_confirmed':
        const predId = message.params.predictionId;
        if (this.predictions.has(predId)) {
          const pred = this.predictions.get(predId)!;
          pred.status = 'confirmed';
          this.emit('predictionConfirmed', pred);
        }
        break;

      case 'settlement_complete':
        if (this.session) {
          this.session.status = 'settled';
          this.emit('settlementComplete', message.params);
        }
        break;

      case 'challenge_ended':
        this.emit('challengeEnded', message.params);
        break;

      default:
        console.log('Unknown message:', message);
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(() => {
        // Reconnect attempt failed, will try again
      });
    }, delay);
  }
}

// Singleton instance for app-wide use
let yellowClientInstance: YellowClient | null = null;

export function initializeYellowClient(config: YellowClientConfig): YellowClient {
  yellowClientInstance = new YellowClient(config);
  return yellowClientInstance;
}

export function getYellowClient(): YellowClient {
  if (!yellowClientInstance) {
    throw new Error('Yellow client not initialized. Call initializeYellowClient first.');
  }
  return yellowClientInstance;
}
