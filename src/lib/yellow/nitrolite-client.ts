/**
 * Yellow Network Nitrolite SDK Integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 * 
 * Implements:
 * - App Sessions (multi-party application channels)
 * - Session Keys (delegated keys for gasless interactions)
 * - Message Envelope (RPC Protocol)
 * - Challenge-Response & Disputes
 */

import { EventEmitter } from 'events';

// Yellow Network endpoints per official docs
const YELLOW_ENDPOINTS = {
  production: 'wss://clearnet.yellow.com/ws',
  sandbox: 'wss://clearnet-sandbox.yellow.com/ws',
} as const;

export type YellowEnvironment = keyof typeof YELLOW_ENDPOINTS;

/**
 * App Session - Multi-party application channel
 * Based on Yellow Network App Sessions concept
 */
export interface AppSession {
  sessionId: string;
  appId: string; // Application identifier (e.g., "rizzz-fun")
  channelId: string;
  participants: string[]; // User addresses
  state: SessionState;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'challenging' | 'settled' | 'expired';
}

/**
 * Session State - Custom application state
 */
export interface SessionState {
  balance: bigint; // USDC balance in session
  lockedAmount: bigint; // Amount locked in predictions
  predictions: Map<string, PredictionState>;
  votes: Map<string, VoteState>;
  nonce: number;
  stateHash: string;
}

/**
 * Prediction State within session
 */
export interface PredictionState {
  id: string;
  challengeId: string;
  reelId: string;
  amount: bigint;
  timestamp: number;
  nonce: number;
}

/**
 * Vote State within session
 */
export interface VoteState {
  id: string;
  challengeId: string;
  reelId: string;
  timestamp: number;
}

/**
 * Session Key - Delegated key for gasless operations
 * Based on Yellow Network Session Keys concept
 */
export interface SessionKey {
  publicKey: string;
  privateKey?: string; // Only stored temporarily for signing
  permissions: string[];
  expiresAt: number;
}

/**
 * Message Envelope - RPC Protocol format
 * Based on Yellow Network Message Envelope specification
 */
export interface MessageEnvelope {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: Record<string, any>;
  signature?: string;
}

/**
 * Challenge Response - For dispute resolution
 * Based on Yellow Network Challenge-Response mechanism
 */
export interface ChallengeResponse {
  challengeId: string;
  stateHash: string;
  signature: string;
  timestamp: number;
}

export interface YellowClientConfig {
  environment: YellowEnvironment;
  appId: string; // Application identifier
  signer: any; // Wallet signer
  onSessionUpdate?: (session: AppSession) => void;
  onStateChange?: (state: SessionState) => void;
  onChallenge?: (challenge: ChallengeResponse) => void;
}

/**
 * Yellow Network Nitrolite Client
 * Implements Yellow Network patterns per official documentation
 */
export class NitroliteClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: YellowClientConfig;
  private session: AppSession | null = null;
  private sessionKey: SessionKey | null = null;
  private state: SessionState | null = null;
  private messageQueue: Map<string, { resolve: Function; reject: Function }> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: YellowClientConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to Yellow Network Clearnode
   * Per Yellow Network architecture: connects to off-chain layer
   */
  async connect(): Promise<void> {
    const endpoint = YELLOW_ENDPOINTS[this.config.environment];
    
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
        try {
          const envelope: MessageEnvelope = JSON.parse(event.data);
          this.handleMessage(envelope);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
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
   * Create App Session
   * Based on Yellow Network App Sessions - multi-party application channel
   * This opens a state channel for the application
   */
  async createAppSession(
    depositAmount: bigint,
    challengeId: string
  ): Promise<AppSession> {
    const userAddress = await this.getUserAddress();
    
    // Create app session message per Yellow Network RPC protocol
    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_session_create',
      params: {
        appId: this.config.appId,
        participant: userAddress,
        initialDeposit: depositAmount.toString(),
        metadata: {
          challengeId,
          timestamp: Date.now(),
        },
      },
    };

    // Sign message with wallet
    const signature = await this.signMessage(this.serializeParams(message.params));
    message.signature = signature;

    const response = await this.sendMessage(message);

    // Create session with state
    this.state = {
      balance: depositAmount,
      lockedAmount: 0n,
      predictions: new Map(),
      votes: new Map(),
      nonce: 0,
      stateHash: response.stateHash,
    };

    this.session = {
      sessionId: response.sessionId,
      appId: this.config.appId,
      channelId: response.channelId,
      participants: [userAddress],
      state: this.state,
      createdAt: Date.now(),
      expiresAt: response.expiresAt,
      status: 'active',
    };

    // Generate session key for gasless operations
    await this.generateSessionKey();

    this.emit('sessionCreated', this.session);
    this.config.onSessionUpdate?.(this.session);

    return this.session;
  }

  /**
   * Generate Session Key
   * Based on Yellow Network Session Keys - delegated keys for gasless interactions
   * Allows signing off-chain messages without wallet prompts
   */
  private async generateSessionKey(): Promise<void> {
    if (!this.session) return;

    // Request session key from Yellow Network
    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'session_key_generate',
      params: {
        sessionId: this.session.sessionId,
        permissions: ['predict', 'vote', 'update'],
        expiresAt: this.session.expiresAt,
      },
    };

    const signature = await this.signMessage(this.serializeParams(message.params));
    message.signature = signature;

    const response = await this.sendMessage(message);

    this.sessionKey = {
      publicKey: response.publicKey,
      permissions: response.permissions,
      expiresAt: response.expiresAt,
    };

    this.emit('sessionKeyGenerated', this.sessionKey);
  }

  /**
   * Make Prediction - Off-chain via Session Key
   * Uses session key for gasless signing (no wallet prompt)
   */
  async makePrediction(
    challengeId: string,
    reelId: string,
    amount: bigint
  ): Promise<PredictionState> {
    if (!this.session || !this.state) {
      throw new Error('No active session. Create a session first.');
    }

    if (this.state.balance - this.state.lockedAmount < amount) {
      throw new Error('Insufficient balance for prediction');
    }

    const predictionId = this.generateId('pred');
    const nonce = ++this.state.nonce;

    const prediction: PredictionState = {
      id: predictionId,
      challengeId,
      reelId,
      amount,
      timestamp: Date.now(),
      nonce,
    };

    // Update state optimistically
    this.state.predictions.set(predictionId, prediction);
    this.state.lockedAmount += amount;

    // Create state update message
    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_state_update',
      params: {
        sessionId: this.session.sessionId,
        action: 'prediction',
        data: {
          predictionId,
          challengeId,
          reelId,
          amount: amount.toString(),
          nonce,
        },
        previousStateHash: this.state.stateHash,
        newStateHash: this.computeStateHash(),
      },
    };

    // Sign with session key (gasless) or fallback to wallet
    const signature = await this.signWithSessionKey(message.params);
    message.signature = signature;

    const response = await this.sendMessage(message);

    // Update state hash from response
    this.state.stateHash = response.stateHash;

    this.emit('predictionMade', prediction);
    this.config.onStateChange?.(this.state);

    return prediction;
  }

  /**
   * Update Prediction - Off-chain state update
   */
  async updatePrediction(
    predictionId: string,
    newAmount: bigint
  ): Promise<PredictionState> {
    if (!this.session || !this.state) {
      throw new Error('No active session');
    }

    const prediction = this.state.predictions.get(predictionId);
    if (!prediction) {
      throw new Error('Prediction not found');
    }

    const amountDiff = newAmount - prediction.amount;
    if (amountDiff > 0 && this.state.balance - this.state.lockedAmount < amountDiff) {
      throw new Error('Insufficient balance');
    }

    // Update state
    prediction.amount = newAmount;
    prediction.nonce = ++this.state.nonce;
    this.state.lockedAmount += amountDiff;

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_state_update',
      params: {
        sessionId: this.session.sessionId,
        action: 'prediction_update',
        data: {
          predictionId,
          newAmount: newAmount.toString(),
          nonce: prediction.nonce,
        },
        previousStateHash: this.state.stateHash,
        newStateHash: this.computeStateHash(),
      },
    };

    const signature = await this.signWithSessionKey(message.params);
    message.signature = signature;

    const response = await this.sendMessage(message);
    this.state.stateHash = response.stateHash;

    this.emit('predictionUpdated', prediction);
    this.config.onStateChange?.(this.state);

    return prediction;
  }

  /**
   * Cancel Prediction - Off-chain state update
   */
  async cancelPrediction(predictionId: string): Promise<void> {
    if (!this.session || !this.state) {
      throw new Error('No active session');
    }

    const prediction = this.state.predictions.get(predictionId);
    if (!prediction) {
      throw new Error('Prediction not found');
    }

    // Update state
    this.state.lockedAmount -= prediction.amount;
    this.state.predictions.delete(predictionId);

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_state_update',
      params: {
        sessionId: this.session.sessionId,
        action: 'prediction_cancel',
        data: { predictionId },
        previousStateHash: this.state.stateHash,
        newStateHash: this.computeStateHash(),
      },
    };

    const signature = await this.signWithSessionKey(message.params);
    message.signature = signature;

    const response = await this.sendMessage(message);
    this.state.stateHash = response.stateHash;

    this.emit('predictionCancelled', prediction);
    this.config.onStateChange?.(this.state);
  }

  /**
   * Vote - Off-chain via Session Key
   */
  async vote(challengeId: string, reelId: string): Promise<VoteState> {
    if (!this.session || !this.state) {
      throw new Error('No active session');
    }

    const voteId = this.generateId('vote');
    const vote: VoteState = {
      id: voteId,
      challengeId,
      reelId,
      timestamp: Date.now(),
    };

    this.state.votes.set(voteId, vote);

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_state_update',
      params: {
        sessionId: this.session.sessionId,
        action: 'vote',
        data: { voteId, challengeId, reelId },
        previousStateHash: this.state.stateHash,
        newStateHash: this.computeStateHash(),
      },
    };

    const signature = await this.signWithSessionKey(message.params);
    message.signature = signature;

    const response = await this.sendMessage(message);
    this.state.stateHash = response.stateHash;

    this.emit('voteCast', vote);
    this.config.onStateChange?.(this.state);

    return vote;
  }

  /**
   * Challenge State - For dispute resolution
   * Based on Yellow Network Challenge-Response mechanism
   */
  async challengeState(): Promise<ChallengeResponse> {
    if (!this.session || !this.state) {
      throw new Error('No active session');
    }

    const challengeId = this.generateId('challenge');
    const stateHash = this.state.stateHash;

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'challenge_state',
      params: {
        sessionId: this.session.sessionId,
        stateHash,
        challengeId,
      },
    };

    const signature = await this.signMessage(this.serializeParams(message.params));
    message.signature = signature;

    const response = await this.sendMessage(message);

    const challenge: ChallengeResponse = {
      challengeId,
      stateHash,
      signature: response.signature,
      timestamp: Date.now(),
    };

    this.session.status = 'challenging';
    this.emit('challengeIssued', challenge);
    this.config.onChallenge?.(challenge);

    return challenge;
  }

  /**
   * Respond to Challenge
   */
  async respondToChallenge(
    challengeId: string,
    stateHash: string
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'challenge_response',
      params: {
        sessionId: this.session.sessionId,
        challengeId,
        stateHash,
      },
    };

    const signature = await this.signMessage(this.serializeParams(message.params));
    message.signature = signature;

    await this.sendMessage(message);

    this.session.status = 'active';
    this.emit('challengeResponded', { challengeId });
  }

  /**
   * Request Settlement
   * Aggregates off-chain state and prepares for on-chain settlement
   */
  async requestSettlement(challengeId: string): Promise<{
    stateHash: string;
    signatures: string[];
    finalState: SessionState;
  }> {
    if (!this.session || !this.state) {
      throw new Error('No active session');
    }

    this.session.status = 'settling';

    const message: MessageEnvelope = {
      jsonrpc: '2.0',
      id: this.generateMessageId(),
      method: 'app_session_settle',
      params: {
        sessionId: this.session.sessionId,
        challengeId,
        finalStateHash: this.state.stateHash,
      },
    };

    const signature = await this.signMessage(this.serializeParams(message.params));
    message.signature = signature;

    const response = await this.sendMessage(message);

    this.session.status = 'settled';
    this.emit('settlementReady', {
      stateHash: response.stateHash,
      signatures: response.signatures,
      finalState: this.state,
    });

    return {
      stateHash: response.stateHash,
      signatures: response.signatures,
      finalState: this.state,
    };
  }

  /**
   * Get current session
   */
  getSession(): AppSession | null {
    return this.session;
  }

  /**
   * Get current state
   */
  getState(): SessionState | null {
    return this.state;
  }

  /**
   * Get available balance
   */
  getAvailableBalance(): bigint {
    if (!this.state) return 0n;
    return this.state.balance - this.state.lockedAmount;
  }

  /**
   * Get predictions for challenge
   */
  getPredictionsForChallenge(challengeId: string): PredictionState[] {
    if (!this.state) return [];
    return Array.from(this.state.predictions.values())
      .filter(p => p.challengeId === challengeId);
  }

  /**
   * Get total prediction amount for reel
   */
  getTotalPredictionForReel(challengeId: string, reelId: string): bigint {
    return this.getPredictionsForChallenge(challengeId)
      .filter(p => p.reelId === reelId)
      .reduce((sum, p) => sum + p.amount, 0n);
  }

  // Private helper methods

  private async getUserAddress(): Promise<string> {
    if (this.config.signer.getAddress) {
      return await this.config.signer.getAddress();
    } else if (this.config.signer.account) {
      return this.config.signer.account.address;
    }
    throw new Error('Unable to get user address from signer');
  }

  private async signMessage(message: string): Promise<string> {
    if (this.config.signer.signMessage) {
      return await this.config.signer.signMessage({ message });
    }
    throw new Error('Signer does not support message signing');
  }

  /**
   * Sign with Session Key (gasless) or fallback to wallet
   */
  private async signWithSessionKey(params: Record<string, any>): Promise<string> {
    // In production, session keys would sign locally
    // For now, fallback to wallet signing
    // TODO: Implement session key signing when Yellow SDK provides it
    return await this.signMessage(this.serializeParams(params));
  }

  private serializeParams(params: Record<string, any>): string {
    return JSON.stringify(params, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  private computeStateHash(): string {
    if (!this.state) return '';
    // Compute hash of current state
    const stateString = JSON.stringify({
      balance: this.state.balance.toString(),
      lockedAmount: this.state.lockedAmount.toString(),
      predictions: Array.from(this.state.predictions.entries()),
      votes: Array.from(this.state.votes.entries()),
      nonce: this.state.nonce,
    });
    // In production, use proper cryptographic hash
    return `0x${Buffer.from(stateString).toString('hex').slice(0, 64)}`;
  }

  private sendMessage(message: MessageEnvelope): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = message.id.toString();
      this.messageQueue.set(messageId, { resolve, reject });

      this.ws.send(JSON.stringify(message));

      setTimeout(() => {
        if (this.messageQueue.has(messageId)) {
          this.messageQueue.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private handleMessage(envelope: MessageEnvelope): void {
    // Handle response messages
    if (envelope.id && this.messageQueue.has(envelope.id.toString())) {
      const { resolve, reject } = this.messageQueue.get(envelope.id.toString())!;
      this.messageQueue.delete(envelope.id.toString());

      if ('error' in envelope) {
        reject(new Error(envelope.error?.message || 'Unknown error'));
      } else {
        resolve(envelope.result || envelope);
      }
      return;
    }

    // Handle push notifications
    switch (envelope.method) {
      case 'session_state_update':
        if (this.state && envelope.params) {
          this.state.stateHash = envelope.params.stateHash || this.state.stateHash;
          this.emit('stateUpdate', this.state);
          this.config.onStateChange?.(this.state);
        }
        break;

      case 'challenge_issued':
        this.session && (this.session.status = 'challenging');
        this.emit('challengeReceived', envelope.params);
        break;

      case 'session_settled':
        this.session && (this.session.status = 'settled');
        this.emit('sessionSettled', envelope.params);
        break;

      default:
        console.log('Unhandled message:', envelope.method);
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: this.generateMessageId(),
          method: 'ping',
          params: {},
        }));
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
      this.connect().catch(() => {});
    }, delay);
  }
}

// Singleton instance
let nitroliteClientInstance: NitroliteClient | null = null;

export function initializeNitroliteClient(config: YellowClientConfig): NitroliteClient {
  nitroliteClientInstance = new NitroliteClient(config);
  return nitroliteClientInstance;
}

export function getNitroliteClient(): NitroliteClient {
  if (!nitroliteClientInstance) {
    throw new Error('Nitrolite client not initialized. Call initializeNitroliteClient first.');
  }
  return nitroliteClientInstance;
}
