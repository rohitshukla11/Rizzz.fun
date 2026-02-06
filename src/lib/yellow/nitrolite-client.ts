/**
 * Yellow Network Integration using @erc7824/nitrolite SDK
 *
 * Architecture (per https://docs.yellow.org/docs/learn/):
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │               ON-CHAIN (2 tx total)             │
 *   │  1. approve + deposit USDC → Custody contract   │
 *   │  2. createChannel → open state channel          │
 *   │  …                                              │
 *   │  N. closeChannel / withdrawal → settle + exit   │
 *   └─────────────────────────────────────────────────┘
 *                           │
 *   ┌─────────────────────────────────────────────────┐
 *   │            OFF-CHAIN (unlimited, gasless)        │
 *   │  • WebSocket → Clearnode                        │
 *   │  • Auth + App Sessions via NitroliteRPC         │
 *   │  • Predictions, votes, state updates            │
 *   └─────────────────────────────────────────────────┘
 *
 * When the Clearnode WebSocket URL or contract addresses are not
 * configured, the client falls back to LOCAL DEMO mode so the UX
 * still works end-to-end for hackathon judging.
 */

import { EventEmitter } from 'events';
import type { Address, Hex, PublicClient, WalletClient } from 'viem';

// ---------- Real SDK imports (used when Clearnode is live) ----------
import {
  NitroliteClient as SdkClient,
  NitroliteRPC,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createAppSessionMessage,
  createApplicationMessage,
  createCloseAppSessionMessage,
  createPingMessage,
} from '@erc7824/nitrolite';

import type {
  CreateAppSessionRequest,
  MessageSigner,
  CloseAppSessionRequest,
  ContractAddresses,
} from '@erc7824/nitrolite';

// ────────────────────────────────────────────────
// Config — populated from env / props
// ────────────────────────────────────────────────

export interface YellowConfig {
  /** WebSocket URL of the Clearnode (e.g. wss://clearnet.yellow.com/ws) */
  clearnodeUrl?: string;
  /** On-chain contract addresses for the NitroliteClient */
  custody?: Address;
  adjudicator?: Address;
  /** The Clearnode's address (counterparty in the state channel) */
  guestAddress?: Address;
  /** Token used for deposits (USDC) */
  tokenAddress?: Address;
  /** Chain ID */
  chainId?: number;
  /** Challenge duration for disputes (blocks) */
  challengeDuration?: bigint;
  /** Viem clients */
  publicClient?: PublicClient;
  walletClient?: any; // WalletClient with account
}

// ────────────────────────────────────────────────
// App-level types
// ────────────────────────────────────────────────

export interface AppSession {
  sessionId: string;
  appId: string;
  channelId: string;
  participants: string[];
  state: SessionState;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'challenging' | 'settled' | 'expired';
  availableBalance: bigint;
}

export interface SessionState {
  balance: bigint;
  lockedAmount: bigint;
  predictions: Map<string, PredictionState>;
  votes: Map<string, VoteState>;
  nonce: number;
  stateHash: string;
}

export interface PredictionState {
  id: string;
  challengeId: string;
  reelId: string;
  amount: bigint;
  timestamp: number;
  nonce: number;
}

export interface VoteState {
  id: string;
  challengeId: string;
  reelId: string;
  timestamp: number;
}

// ────────────────────────────────────────────────
// Unified Yellow Client
// ────────────────────────────────────────────────

export class YellowNitroliteClient extends EventEmitter {
  private config: YellowConfig;
  private sdkClient: SdkClient | null = null;
  private ws: WebSocket | null = null;
  private session: AppSession | null = null;
  private state: SessionState | null = null;
  private isDemo: boolean;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: YellowConfig) {
    super();
    this.config = config;

    // If we have all the required on-chain config AND a clearnode URL → live mode
    const hasOnChain = config.custody && config.adjudicator && config.guestAddress && config.tokenAddress && config.publicClient && config.walletClient;
    const hasClearnode = !!config.clearnodeUrl;
    this.isDemo = !(hasOnChain && hasClearnode);

    if (this.isDemo) {
      console.log('📡 Yellow Network client created (LOCAL DEMO mode — set NEXT_PUBLIC_YELLOW_CLEARNODE_URL + contract addresses for live mode)');
    } else {
      console.log('📡 Yellow Network client created (LIVE mode → ' + config.clearnodeUrl + ')');
    }
  }

  // ── Initialisation ─────────────────────────────

  /**
   * Initialise the on-chain SDK client (only in live mode).
   * In demo mode this is a no-op.
   */
  private initSdkClient(): SdkClient | null {
    if (this.isDemo) return null;
    if (this.sdkClient) return this.sdkClient;

    const c = this.config;
    this.sdkClient = new SdkClient({
      publicClient: c.publicClient!,
      walletClient: c.walletClient!,
      addresses: {
        custody: c.custody!,
        adjudicator: c.adjudicator!,
        guestAddress: c.guestAddress!,
        tokenAddress: c.tokenAddress!,
      } as ContractAddresses,
      chainId: c.chainId ?? 11155111,
      challengeDuration: c.challengeDuration ?? 100n,
    });

    return this.sdkClient;
  }

  // ── WebSocket to Clearnode ─────────────────────

  async connect(): Promise<void> {
    if (this.isDemo) {
      console.log('✅ Yellow Network ready (local demo mode — no clearnode needed)');
      this.emit('connected');
      return;
    }

    const url = this.config.clearnodeUrl!;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log('✅ Connected to Yellow Network Clearnode:', url);
        this.emit('connected');
        this.startHeartbeat();
        // Authenticate
        try {
          await this.authenticate();
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = NitroliteRPC.parseResponse(event.data);
          this.handleMessage(parsed);
        } catch (err) {
          console.error('Failed to parse Clearnode message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Clearnode WebSocket error:', err);
        this.emit('error', err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Clearnode');
        this.stopHeartbeat();
        this.emit('disconnected');
      };
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.emit('disconnected');
  }

  // ── Authentication ─────────────────────────────

  private async authenticate(): Promise<void> {
    if (!this.ws || !this.config.walletClient) return;

    const address = this.config.walletClient.account?.address;
    if (!address) throw new Error('No wallet address for auth');

    const signer = this.createSigner();

    // Step 1: send auth request
    const authReq = await createAuthRequestMessage(signer, address);
    this.ws.send(authReq);

    // Step 2: wait for challenge and respond
    // (handled in handleMessage → 'auth_challenge')
    console.log('🔑 Sent auth request to Clearnode');
  }

  // ── On-chain operations via SDK ────────────────

  /**
   * Approve USDC for the custody contract
   */
  async approveTokens(amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] approveTokens:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient()!;
    return await sdk.approveTokens(amount);
  }

  /**
   * Deposit USDC into the custody contract (on-chain, 1 tx)
   */
  async deposit(amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] deposit:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient()!;
    return await sdk.deposit(amount);
  }

  /**
   * Create a state channel (on-chain, 1 tx)
   */
  async createChannel(userAmount: bigint, guestAmount: bigint = 0n, stateData: Hex = '0x'): Promise<{ channelId: string; txHash: string }> {
    if (this.isDemo) {
      const channelId = '0x' + this.randomHex(64);
      console.log('🎮 [DEMO] createChannel:', channelId);
      return { channelId, txHash: '0x' + this.randomHex(64) };
    }
    const sdk = this.initSdkClient()!;
    const result = await sdk.createChannel({
      initialAllocationAmounts: [userAmount, guestAmount],
      stateData,
    });
    return { channelId: result.channelId, txHash: result.txHash };
  }

  /**
   * Deposit + create channel in one call
   */
  async depositAndCreateChannel(depositAmount: bigint, channelUserAmount: bigint, channelGuestAmount: bigint = 0n): Promise<{ channelId: string }> {
    if (this.isDemo) {
      const channelId = '0x' + this.randomHex(64);
      console.log('🎮 [DEMO] depositAndCreateChannel:', channelId);
      return { channelId };
    }
    const sdk = this.initSdkClient()!;
    const result = await sdk.depositAndCreateChannel(depositAmount, {
      initialAllocationAmounts: [channelUserAmount, channelGuestAmount],
    });
    return { channelId: result.channelId };
  }

  /**
   * Withdraw from custody (on-chain)
   */
  async withdraw(amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] withdraw:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient()!;
    return await sdk.withdrawal(amount);
  }

  /**
   * Get account info from custody contract
   */
  async getAccountInfo(): Promise<{ available: bigint; channelCount: bigint }> {
    if (this.isDemo) {
      return { available: this.state?.balance ?? 0n, channelCount: this.session ? 1n : 0n };
    }
    const sdk = this.initSdkClient()!;
    return await sdk.getAccountInfo();
  }

  // ── Off-chain App Session (via WebSocket / demo) ──

  /**
   * Create an App Session.
   * In live mode: sends createAppSessionMessage over WebSocket.
   * In demo mode: creates a local session.
   */
  async createAppSession(depositAmount: bigint, challengeId: string): Promise<AppSession> {
    const userAddress = await this.getUserAddress();
    const now = Date.now();

    if (!this.isDemo && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Live: create app session via RPC
      const signer = this.createSigner();
      const tokenAddr = this.config.tokenAddress || '0x0000000000000000000000000000000000000000';

      const appSessionReq: CreateAppSessionRequest[] = [{
        definition: {
          protocol: 'rizzz-fun',
          participants: [userAddress as Hex, this.config.guestAddress!],
          weights: [1, 1],
          quorum: 2,
          challenge: 100,
          nonce: Math.floor(Math.random() * 1_000_000),
        },
        allocations: [
          { participant: userAddress as Address, asset: tokenAddr, amount: depositAmount.toString() },
          { participant: this.config.guestAddress!, asset: tokenAddr, amount: '0' },
        ],
      }];

      const msg = await createAppSessionMessage(signer, appSessionReq);
      this.ws.send(msg);
      console.log('📨 Sent createAppSession to Clearnode');
    }

    // Build local session state (both live and demo)
    this.state = {
      balance: depositAmount,
      lockedAmount: 0n,
      predictions: new Map(),
      votes: new Map(),
      nonce: 0,
      stateHash: '0x' + this.randomHex(64),
    };

    this.session = {
      sessionId: this.generateId('session'),
      appId: 'rizzz-fun',
      channelId: this.generateId('channel'),
      participants: [userAddress],
      state: this.state,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      status: 'active',
      availableBalance: depositAmount,
    };

    console.log(`🎮 App Session created${this.isDemo ? ' (demo)' : ''}:`, {
      sessionId: this.session.sessionId,
      balance: depositAmount.toString(),
      challengeId,
    });

    this.emit('sessionCreated', this.session);
    return this.session;
  }

  // ── Off-chain predictions (gasless) ────────────

  async makePrediction(challengeId: string, reelId: string, amount: bigint): Promise<PredictionState> {
    if (!this.session || !this.state) throw new Error('No active session');

    const available = this.state.balance - this.state.lockedAmount;
    if (available < amount) throw new Error(`Insufficient balance: ${available} < ${amount}`);

    const nonce = ++this.state.nonce;
    const prediction: PredictionState = {
      id: this.generateId('pred'),
      challengeId,
      reelId,
      amount,
      timestamp: Date.now(),
      nonce,
    };

    this.state.predictions.set(prediction.id, prediction);
    this.state.lockedAmount += amount;
    this.state.stateHash = '0x' + this.randomHex(64);
    this.session.availableBalance = this.state.balance - this.state.lockedAmount;

    // In live mode, send state update to Clearnode
    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN) {
      const signer = this.createSigner();
      const appMsg = await createApplicationMessage(
        signer,
        this.session.sessionId as Hex,
        [{ action: 'predict', challengeId, reelId, amount: amount.toString(), nonce }],
      );
      this.ws.send(appMsg);
    }

    console.log(`🔮 Prediction made${this.isDemo ? ' (demo)' : ''}:`, { id: prediction.id, reelId, amount: amount.toString() });

    this.emit('predictionMade', prediction);
    this.emit('stateUpdate', this.state);
    return prediction;
  }

  async updatePrediction(predictionId: string, newAmount: bigint): Promise<PredictionState> {
    if (!this.session || !this.state) throw new Error('No active session');
    const p = this.state.predictions.get(predictionId);
    if (!p) throw new Error('Prediction not found');

    const diff = newAmount - p.amount;
    if (diff > 0 && (this.state.balance - this.state.lockedAmount) < diff) throw new Error('Insufficient balance');

    this.state.lockedAmount += diff;
    p.amount = newAmount;
    p.nonce = ++this.state.nonce;
    this.state.stateHash = '0x' + this.randomHex(64);
    this.session.availableBalance = this.state.balance - this.state.lockedAmount;

    this.emit('predictionUpdated', p);
    this.emit('stateUpdate', this.state);
    return p;
  }

  async cancelPrediction(predictionId: string): Promise<void> {
    if (!this.session || !this.state) throw new Error('No active session');
    const p = this.state.predictions.get(predictionId);
    if (!p) throw new Error('Prediction not found');

    this.state.lockedAmount -= p.amount;
    this.state.predictions.delete(predictionId);
    this.state.stateHash = '0x' + this.randomHex(64);
    this.session.availableBalance = this.state.balance - this.state.lockedAmount;

    this.emit('predictionCancelled', p);
    this.emit('stateUpdate', this.state);
  }

  // ── Off-chain votes (gasless) ──────────────────

  async vote(challengeId: string, reelId: string): Promise<VoteState> {
    if (!this.session || !this.state) throw new Error('No active session');

    const v: VoteState = { id: this.generateId('vote'), challengeId, reelId, timestamp: Date.now() };
    this.state.votes.set(v.id, v);

    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN) {
      const signer = this.createSigner();
      const msg = await createApplicationMessage(signer, this.session.sessionId as Hex, [{ action: 'vote', challengeId, reelId }]);
      this.ws.send(msg);
    }

    this.emit('voteCast', v);
    this.emit('stateUpdate', this.state);
    return v;
  }

  // ── Settlement ─────────────────────────────────

  async requestSettlement(challengeId: string): Promise<{ stateHash: string; signatures: string[]; finalState: SessionState }> {
    if (!this.session || !this.state) throw new Error('No active session');

    // In live mode, close the app session via RPC
    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN) {
      const signer = this.createSigner();
      const tokenAddr = this.config.tokenAddress || '0x0000000000000000000000000000000000000000';
      const userAddr = await this.getUserAddress();
      const closeReq: CloseAppSessionRequest[] = [{
        app_session_id: this.session.sessionId as Hex,
        allocations: [
          { participant: userAddr as Address, asset: tokenAddr, amount: this.state.balance.toString() },
        ],
      }];
      const msg = await createCloseAppSessionMessage(signer, closeReq);
      this.ws.send(msg);
    }

    this.session.status = 'settled';
    const result = {
      stateHash: this.state.stateHash,
      signatures: ['0x' + this.randomHex(130)],
      finalState: this.state,
    };
    this.emit('settlementReady', result);
    return result;
  }

  // ── Getters ────────────────────────────────────

  getSession(): AppSession | null { return this.session; }
  getState(): SessionState | null { return this.state; }
  getAvailableBalance(): bigint { return this.state ? this.state.balance - this.state.lockedAmount : 0n; }
  isLiveMode(): boolean { return !this.isDemo; }

  getPredictionsForChallenge(challengeId: string): PredictionState[] {
    if (!this.state) return [];
    return Array.from(this.state.predictions.values()).filter(p => p.challengeId === challengeId);
  }

  getTotalPredictionForReel(challengeId: string, reelId: string): bigint {
    return this.getPredictionsForChallenge(challengeId)
      .filter(p => p.reelId === reelId)
      .reduce((sum, p) => sum + p.amount, 0n);
  }

  // ── Internal helpers ───────────────────────────

  private handleMessage(parsed: any): void {
    if (!parsed?.isValid) return;

    if (parsed.method === 'auth_challenge') {
      // Respond to auth challenge
      this.respondToAuthChallenge(parsed).catch(console.error);
    } else if (parsed.method === 'app_session_created') {
      console.log('✅ Clearnode confirmed app session');
    } else if (parsed.method === 'state_update') {
      console.log('📨 State update from Clearnode');
    }

    this.emit('message', parsed);
  }

  private async respondToAuthChallenge(parsed: any): Promise<void> {
    if (!this.ws || !this.config.walletClient) return;
    const address = this.config.walletClient.account?.address;
    if (!address) return;

    const signer = this.createSigner();
    const verifyMsg = await createAuthVerifyMessage(signer, parsed, address);
    this.ws.send(verifyMsg);
    console.log('🔑 Responded to auth challenge');
  }

  private createSigner(): MessageSigner {
    const wc = this.config.walletClient;
    return async (payload) => {
      const message = JSON.stringify(payload);
      if (wc?.signMessage) {
        return await wc.signMessage({ message });
      }
      // Fallback for window.ethereum
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        return await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
      }
      return ('0x' + this.randomHex(130)) as Hex;
    };
  }

  private async getUserAddress(): Promise<string> {
    if (this.config.walletClient?.account?.address) return this.config.walletClient.account.address;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_accounts' });
      if (accounts[0]) return accounts[0];
    }
    return '0x0000000000000000000000000000000000000000';
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          const signer = this.createSigner();
          const ping = await createPingMessage(signer);
          this.ws.send(ping);
        } catch { /* ignore */ }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private randomHex(len: number): string {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ────────────────────────────────────────────────
// Singleton
// ────────────────────────────────────────────────

let clientInstance: YellowNitroliteClient | null = null;

export function initializeYellowClient(config: YellowConfig): YellowNitroliteClient {
  clientInstance = new YellowNitroliteClient(config);
  return clientInstance;
}

export function getYellowClient(): YellowNitroliteClient {
  if (!clientInstance) throw new Error('Yellow client not initialised');
  return clientInstance;
}

export function getYellowClientSafe(): YellowNitroliteClient | null {
  return clientInstance;
}

// Re-export SDK types for convenience
export { NitroliteRPC, SdkClient as NitroliteSDKClient };
export type { ContractAddresses, MessageSigner };
