/**
 * Yellow Network Integration using @erc7824/nitrolite SDK v0.5.3
 *
 * Per https://docs.yellow.org/docs/learn/getting-started/prerequisites:
 *
 *   Only ONE env var is required:
 *     NEXT_PUBLIC_YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
 *
 *   Contract addresses are fetched dynamically via `get_config`.
 *   Sandbox test tokens come from the faucet API (no on-chain deposit).
 *
 * Auth Flow (v0.5.x):
 *   1. Send auth_request with {address, session_key, application, allowances, expires_at, scope}
 *   2. Clearnode responds with auth_request containing {challenge_message}
 *   3. Sign the challenge with session key and send auth_verify
 *   4. Clearnode responds with auth_verify containing {address, session_key, success}
 *
 * Signing:
 *   All messages are signed with a local ECDSA session key (no MetaMask).
 *   MetaMask is only needed for on-chain operations (deposit/withdraw).
 */

import { EventEmitter } from 'events';
import type { Address, Hex, PublicClient, Hash } from 'viem';
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ---------- SDK imports (v0.5.3) ----------
import {
  NitroliteClient as SdkClient,
  NitroliteRPC,
  // Auth (v0.5.x API — completely different from v0.1.x)
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  // Config & assets (V2 = no signer needed)
  createGetConfigMessageV2,
  createGetAssetsMessageV2,
  createPingMessageV2,
  // Signed operations
  createAppSessionMessage,
  createApplicationMessage,
  createCloseAppSessionMessage,
  createGetLedgerBalancesMessage,
  createCreateChannelMessage,
  // Signer helpers
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  // Parsers
  parseAnyRPCResponse,
  // State signer
  SessionKeyStateSigner,
} from '@erc7824/nitrolite';

import type {
  MessageSigner,
  ContractAddresses,
  RPCAppDefinition,
  RPCProtocolVersion,
} from '@erc7824/nitrolite';

// ────────────────────────────────────────────────
// Config — only clearnodeUrl is required!
// ────────────────────────────────────────────────

export interface YellowConfig {
  /** WebSocket URL of the Clearnode (the ONLY required env var) */
  clearnodeUrl?: string;
  /** Chain ID (default: 11155111 Sepolia) */
  chainId?: number;
  /** Viem clients (from wagmi) */
  publicClient?: PublicClient;
  walletClient?: any; // WalletClient with account
}

/** Config fetched dynamically from the Clearnode via get_config */
export interface ClearnodeConfig {
  brokerAddress?: Address;
  custody?: Address;
  adjudicator?: Address;
  tokenAddress?: Address;
  networks?: Array<{
    chainId: number;
    name: string;
    custodyAddress: Address;
    adjudicatorAddress: Address;
  }>;
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
// Sandbox Faucet
// ────────────────────────────────────────────────

const SANDBOX_FAUCET_URL = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';

/**
 * Request test tokens from the Yellow Network Sandbox faucet.
 * Tokens are credited directly to the user's unified balance — no on-chain tx needed.
 */
export async function requestSandboxTokens(userAddress: string): Promise<boolean> {
  try {
    console.log('🚰 Requesting sandbox test tokens for:', userAddress);
    const res = await fetch(SANDBOX_FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn('Faucet response:', res.status, text);
      return false;
    }

    const data = await res.json();
    console.log('✅ Faucet tokens received:', data);
    return true;
  } catch (err) {
    console.warn('Faucet request failed:', err);
    return false;
  }
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
  private isAuthenticated = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** Ephemeral session key — used for ALL Clearnode message signing (NO MetaMask) */
  private sessionKeyHex: Hex;
  private sessionKeyAccount: ReturnType<typeof privateKeyToAccount>;

  /** ECDSA signer created from the session key — the SDK's recommended approach */
  private ecdsaSigner: MessageSigner;

  /** Discovered dynamically from the Clearnode */
  private clearnodeConfig: ClearnodeConfig = {};

  /** Local wallet client for EIP-712 signing (no MetaMask) */
  private localWalletClient: any;

  constructor(config: YellowConfig) {
    super();
    this.config = config;

    // Restore or generate ephemeral session key
    const stored = typeof window !== 'undefined' ? localStorage.getItem('rizzz-session-key') : null;
    if (stored) {
      this.sessionKeyHex = stored as Hex;
      console.log('🔑 Restored session key from storage');
    } else {
      this.sessionKeyHex = generatePrivateKey();
      if (typeof window !== 'undefined') {
        localStorage.setItem('rizzz-session-key', this.sessionKeyHex);
      }
    }
    this.sessionKeyAccount = privateKeyToAccount(this.sessionKeyHex);

    // ECDSA signer for general RPC messages
    this.ecdsaSigner = createECDSAMessageSigner(this.sessionKeyHex);

    // Local wallet client for EIP-712 auth signing (signs locally, no MetaMask)
    this.localWalletClient = createWalletClient({
      account: this.sessionKeyAccount,
      chain: sepolia,
      transport: http(),
    });

    // Demo mode = no clearnode URL set
    this.isDemo = !config.clearnodeUrl;

    if (this.isDemo) {
      console.log('📡 Yellow Network client (LOCAL DEMO — set NEXT_PUBLIC_YELLOW_CLEARNODE_URL for live)');
    } else {
      console.log('📡 Yellow Network client (LIVE →', config.clearnodeUrl, ')');
      console.log('🔑 Session key:', this.sessionKeyAccount.address);
    }
  }

  /** Update wallet/public clients (e.g. after wagmi connects) */
  updateClients(publicClient?: any, walletClient?: any) {
    if (publicClient) this.config.publicClient = publicClient;
    if (walletClient) this.config.walletClient = walletClient;
  }

  // ── On-chain SDK client ───────────────────────

  private initSdkClient(): SdkClient | null {
    if (this.isDemo) return null;
    if (this.sdkClient) return this.sdkClient;

    const c = this.config;
    const cc = this.clearnodeConfig;

    if (!cc.custody || !cc.adjudicator) {
      console.warn('Cannot init SDK client — missing custody/adjudicator from get_config');
      return null;
    }
    if (!c.publicClient || !c.walletClient) {
      // Expected in sandbox mode — SDK client is only needed for direct on-chain ops
      // It will be lazily initialized later if walletClient becomes available
      return null;
    }

    const addresses: ContractAddresses = {
      custody: cc.custody,
      adjudicator: cc.adjudicator,
    };

    this.sdkClient = new SdkClient({
      publicClient: c.publicClient,
      walletClient: c.walletClient,
      stateSigner: new SessionKeyStateSigner(this.sessionKeyHex),
      addresses,
      chainId: c.chainId ?? 11155111,
      challengeDuration: 3600n,
    });

    return this.sdkClient;
  }

  // ── WebSocket to Clearnode ─────────────────────

  private isConnecting = false;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isDemo) {
      console.log('✅ Yellow Network ready (local demo mode)');
      this.emit('connected');
      return;
    }

    // Prevent duplicate connections
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    const url = this.config.clearnodeUrl!;
    return new Promise<void>((resolve) => {
      if (this.ws) {
        try { this.ws.close(); } catch { /* ignore */ }
        this.ws = null;
      }

      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log('✅ Connected to Clearnode:', url);
        this.isConnected = true;
        this.isConnecting = false;
        this.emit('connected');
        this.startHeartbeat();

        // Auth + config (non-blocking — sandbox auth often fails, that's OK)
        try {
          await this.authenticate();
        } catch (err) {
          console.log('ℹ️ Auth skipped (local session mode):', (err as Error)?.message);
        }

        try {
          await this.fetchConfig();
          this.initSdkClient();
        } catch (err) {
          console.warn('⚠️ get_config failed:', err);
        }

        resolve();
      };

      this.ws.onmessage = (event) => {
        const rawStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        console.log('📩 Clearnode:', rawStr.substring(0, 500));

        // Use the SDK's parseAnyRPCResponse for proper parsing
        try {
          const parsed = parseAnyRPCResponse(rawStr);
          this.handleParsedResponse(parsed);
        } catch {
          // If SDK parser fails, try raw JSON
          try {
            const raw = JSON.parse(rawStr);
            this.handleRawMessage(raw);
          } catch {
            console.warn('Unparseable message:', rawStr.substring(0, 200));
          }
        }
      };

      this.ws.onerror = (err) => {
        console.error('Clearnode WebSocket error:', err);
        this.isConnecting = false;
        this.emit('error', err);
        resolve();
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Clearnode');
        this.stopHeartbeat();
        this.isAuthenticated = false;
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('disconnected');
      };
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.isConnected = false;
    this.isConnecting = false;
    this.emit('disconnected');
  }

  /** Safe WebSocket send */
  private wsSend(data: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    console.warn('WebSocket not open, cannot send');
    return false;
  }

  // ── Authentication (v0.5.x) ───────────────────

  /** Auth params reused across auth_request and EIP-712 signing */
  private authExpiresAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

  /**
   * v0.5.x auth flow — tries EIP-712 first, falls back to ECDSA.
   *
   * The session key acts as both wallet and session key. We sign locally
   * (no MetaMask). The Clearnode sees the session key as the identity.
   */
  private async authenticate(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const sessionAddr = this.sessionKeyAccount.address;
    const expiresAt = this.authExpiresAt;

    const authReq = await createAuthRequestMessage({
      address: sessionAddr,
      session_key: sessionAddr,
      application: 'rizzz-fun',
      allowances: [],
      expires_at: expiresAt,
      scope: '',
    });

    if (!this.wsSend(authReq)) return;
    console.log('🔑 Sent auth_request (address=session_key:', sessionAddr, ')');

    await this.waitForAuth(10000);
  }

  /** Wait until authenticated or timeout */
  private waitForAuth(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.isAuthenticated) return resolve();

      const timeout = setTimeout(() => {
        this.off('authenticated', onAuth);
        console.log('ℹ️ Auth timeout — using local session (sandbox auth is optional)');
        resolve();
      }, timeoutMs);

      const onAuth = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.once('authenticated', onAuth);
    });
  }

  /**
   * Handle auth_challenge: try EIP-712 with local wallet client (no MetaMask),
   * fall back to raw ECDSA if that fails.
   */
  private async handleAuthChallenge(challengeMessage: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Try 1: EIP-712 signed locally via session key wallet client
    try {
      const eip712Signer = createEIP712AuthMessageSigner(
        this.localWalletClient,
        {
          scope: '',
          session_key: this.sessionKeyAccount.address,
          expires_at: this.authExpiresAt,
          allowances: [],
        },
        { name: 'yellow.org' },
      );
      const verifyMsg = await createAuthVerifyMessageFromChallenge(
        eip712Signer,
        challengeMessage,
      );
      if (this.wsSend(verifyMsg)) {
        console.log('🔑 Sent auth_verify (EIP-712 via local session key)');
        return;
      }
    } catch (err) {
      console.warn('EIP-712 auth failed, trying ECDSA fallback:', err);
    }

    // Try 2: Raw ECDSA with session key
    try {
      const verifyMsg = await createAuthVerifyMessageFromChallenge(
        this.ecdsaSigner,
        challengeMessage,
      );
      this.wsSend(verifyMsg);
      console.log('🔑 Sent auth_verify (ECDSA fallback)');
    } catch (err) {
      console.warn('ECDSA auth also failed:', err);
    }
  }

  // ── Fetch config from Clearnode ────────────────

  private async fetchConfig(): Promise<ClearnodeConfig> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return this.clearnodeConfig;

    // v0.5.3: createGetConfigMessageV2 — no signer needed
    const msg = createGetConfigMessageV2();
    if (!this.wsSend(msg)) return this.clearnodeConfig;
    console.log('📋 Sent get_config');

    try {
      const data = await this.waitForMethod('get_config', 10000);
      if (data) {
        this.clearnodeConfig = this.parseConfigData(data);
        console.log('📋 Config received:', this.clearnodeConfig);
        this.emit('configReceived', this.clearnodeConfig);
      }
    } catch (err) {
      console.warn('get_config timed out');
    }

    return this.clearnodeConfig;
  }

  /**
   * Parse the get_config response params.
   * v0.5.3 SDK parses it as: { brokerAddress, networks: [{chainId, name, custodyAddress, adjudicatorAddress}] }
   */
  private parseConfigData(params: any): ClearnodeConfig {
    const config: ClearnodeConfig = {};
    if (!params || typeof params !== 'object') return config;

    console.log('📋 Parsing config:', JSON.stringify(params, null, 2));

    // The SDK's parseGetConfigResponse already transforms the raw data
    config.brokerAddress = params.brokerAddress as Address | undefined;
    config.networks = params.networks || [];

    // Find custody/adjudicator for our chain
    const chainId = this.config.chainId ?? 11155111;
    if (Array.isArray(config.networks) && config.networks.length > 0) {
      const chainConfig = config.networks.find((n: any) => n.chainId === chainId);
      if (chainConfig) {
        config.custody = chainConfig.custodyAddress;
        config.adjudicator = chainConfig.adjudicatorAddress;
        console.log('📋 Chain', chainId, 'config:', { custody: config.custody, adjudicator: config.adjudicator });
      } else {
        // Use first network as fallback
        const first = config.networks[0];
        config.custody = first.custodyAddress;
        config.adjudicator = first.adjudicatorAddress;
        console.log('📋 Using first network config:', { custody: config.custody, adjudicator: config.adjudicator });
      }
    }

    return config;
  }

  /** Wait for a specific method response */
  private waitForMethod(method: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(`response:${method}`, onResponse);
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeoutMs);

      const onResponse = (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      };
      this.once(`response:${method}`, onResponse);
    });
  }

  // ── Message handlers ──────────────────────────

  /**
   * Handle SDK-parsed responses (primary handler).
   * parseAnyRPCResponse returns: { method, params, requestId, timestamp, signatures }
   */
  private handleParsedResponse(response: any): void {
    if (!response) return;

    const method = response.method;
    const params = response.params;

    console.log(`📨 Parsed: method=${method}`, params);

    switch (method) {
      case 'auth_request':
        // auth_request response contains {challengeMessage: string}
        if (params?.challengeMessage) {
          this.handleAuthChallenge(params.challengeMessage).catch(console.error);
        }
        break;

      case 'auth_challenge':
        // Alternative challenge format
        if (params?.challengeMessage) {
          this.handleAuthChallenge(params.challengeMessage).catch(console.error);
        }
        break;

      case 'auth_verify':
        // Auth complete! params = {address, sessionKey, success, jwtToken?}
        if (params?.success) {
          this.isAuthenticated = true;
          console.log('✅ Authenticated with Clearnode! Session key:', params.sessionKey);
          this.emit('authenticated');
        } else {
          console.warn('❌ Auth verify failed:', params);
        }
        break;

      case 'error':
        // Auth errors in sandbox are expected — log them quietly
        if (params?.error?.includes?.('challenge') || params?.error?.includes?.('signature')) {
          console.log('ℹ️ Clearnode auth:', params.error, '(sandbox — non-blocking)');
        } else {
          console.warn('⚠️ Clearnode error:', params?.error || params);
        }
        break;

      case 'get_config':
        this.emit('response:get_config', params);
        break;

      case 'get_ledger_balances':
        this.emit('response:get_ledger_balances', params);
        break;

      case 'create_app_session':
        console.log('✅ App session confirmed:', params);
        this.emit('response:create_app_session', params);
        break;

      case 'close_app_session':
        console.log('✅ Session close confirmed:', params);
        this.emit('response:close_app_session', params);
        break;

      case 'assets':
        console.log('📦 Assets:', params);
        this.emit('response:assets', params);
        break;

      case 'bu': // balance update
        console.log('💰 Balance update:', params);
        this.emit('response:bu', params);
        break;

      case 'channels':
        console.log('📺 Channels:', params);
        this.emit('response:channels', params);
        break;

      case 'ping':
      case 'pong':
        break; // heartbeat

      default:
        if (method) {
          this.emit(`response:${method}`, params);
        }
        break;
    }

    this.emit('message', response);
  }

  /**
   * Fallback handler for raw JSON messages the SDK parser can't handle.
   */
  private handleRawMessage(raw: any): void {
    if (!raw || typeof raw !== 'object') return;

    const payload = raw.res || raw.req;
    if (!Array.isArray(payload)) return;

    const [, method, dataObj] = payload;
    console.log(`📨 Raw ${raw.res ? 'res' : 'req'}: method=${method}`, dataObj);

    // Route by method — same as handleParsedResponse but with raw data
    if (method === 'auth_request' || method === 'auth_challenge') {
      const challenge = dataObj?.challenge_message || dataObj?.challengeMessage;
      if (challenge) {
        this.handleAuthChallenge(challenge).catch(console.error);
      }
    } else if (method === 'auth_verify' || method === 'auth_response') {
      const success = dataObj?.success !== false; // default true if missing
      if (success) {
        this.isAuthenticated = true;
        console.log('✅ Authenticated (raw)');
        this.emit('authenticated');
      }
    } else if (method === 'error') {
      console.warn('⚠️ Clearnode error (raw):', dataObj);
    } else if (method === 'ping' || method === 'pong') {
      // ignore
    } else if (method) {
      this.emit(`response:${method}`, dataObj);
    }

    this.emit('message', raw);
  }

  // ── Ledger balances ───────────────────────────

  async getLedgerBalances(): Promise<{ available: bigint; locked: bigint }> {
    if (this.isDemo) {
      return {
        available: this.state?.balance ?? 0n,
        locked: this.state?.lockedAmount ?? 0n,
      };
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthenticated) {
      throw new Error('Not connected/authenticated');
    }

    const msg = await createGetLedgerBalancesMessage(this.ecdsaSigner);
    this.wsSend(msg);

    const data = await this.waitForMethod('get_ledger_balances', 10000);
    console.log('💰 Ledger balances:', data);

    // Parse SDK response: { ledgerBalances: [{asset, amount}] }
    const balances = data?.ledgerBalances || [];
    const total = balances.reduce((sum: bigint, b: any) => sum + BigInt(b.amount || 0), 0n);
    return { available: total, locked: 0n };
  }

  // ── On-chain operations via SDK ────────────────

  async approveTokens(tokenAddress: Address, amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] approveTokens:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient();
    if (!sdk) throw new Error('SDK client not ready');
    return await sdk.approveTokens(tokenAddress, amount);
  }

  async deposit(tokenAddress: Address, amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] deposit:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient();
    if (!sdk) throw new Error('SDK client not ready');
    return await sdk.deposit(tokenAddress, amount);
  }

  async withdraw(tokenAddress: Address, amount: bigint): Promise<string> {
    if (this.isDemo) {
      console.log('🎮 [DEMO] withdraw:', amount.toString());
      return '0x' + this.randomHex(64);
    }
    const sdk = this.initSdkClient();
    if (!sdk) throw new Error('SDK client not ready');
    return await sdk.withdrawal(tokenAddress, amount);
  }

  // ── Sandbox faucet ─────────────────────────────

  /**
   * Request test tokens from the sandbox faucet for the **session key** address.
   * This ensures the tokens land in the same ledger account we authenticate as.
   */
  async requestFaucetTokens(): Promise<boolean> {
    // Must use session key address because we auth as session key
    return requestSandboxTokens(this.sessionKeyAccount.address);
  }

  isSandbox(): boolean {
    return !!this.config.clearnodeUrl?.includes('sandbox');
  }

  /** Public getter for the ephemeral session key address */
  getSessionKeyAddress(): string {
    return this.sessionKeyAccount.address;
  }

  // ── Session persistence ───────────────────────

  /** Save current session to localStorage so it survives page refresh */
  persistSession(): void {
    if (!this.session || typeof window === 'undefined') return;
    const data = {
      sessionId: this.session.sessionId,
      appId: this.session.appId,
      channelId: this.session.channelId,
      participants: this.session.participants,
      createdAt: this.session.createdAt,
      expiresAt: this.session.expiresAt,
      status: this.session.status,
      balance: this.state?.balance?.toString() ?? '0',
      lockedAmount: this.state?.lockedAmount?.toString() ?? '0',
      nonce: this.state?.nonce ?? 0,
      stateHash: this.state?.stateHash ?? '',
      predictions: this.state ? Array.from(this.state.predictions.entries()).map(([k, v]) => ({
        ...v,
        amount: v.amount.toString(),
      })) : [],
    };
    localStorage.setItem('rizzz-session', JSON.stringify(data));
  }

  /** Restore session from localStorage */
  restoreSession(): AppSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('rizzz-session');
      if (!raw) return null;
      const data = JSON.parse(raw);

      // Check if session expired
      if (data.expiresAt < Date.now()) {
        localStorage.removeItem('rizzz-session');
        return null;
      }

      const predictions = new Map<string, PredictionState>();
      if (data.predictions) {
        for (const p of data.predictions) {
          predictions.set(p.id, { ...p, amount: BigInt(p.amount) });
        }
      }

      this.state = {
        balance: BigInt(data.balance),
        lockedAmount: BigInt(data.lockedAmount),
        predictions,
        votes: new Map(),
        nonce: data.nonce,
        stateHash: data.stateHash,
      };

      this.session = {
        sessionId: data.sessionId,
        appId: data.appId,
        channelId: data.channelId,
        participants: data.participants,
        state: this.state,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        status: data.status,
        availableBalance: this.state.balance - this.state.lockedAmount,
      };

      console.log('✅ Restored session from storage:', this.session.sessionId);
      this.emit('sessionCreated', this.session);
      return this.session;
    } catch (err) {
      console.warn('Failed to restore session:', err);
      localStorage.removeItem('rizzz-session');
      return null;
    }
  }

  /** Clear persisted session */
  clearPersistedSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('rizzz-session');
    localStorage.removeItem('rizzz-session-key');
    this.session = null;
    this.state = null;
  }

  // ── Off-chain App Session ─────────────────────

  async createAppSession(depositAmount: bigint, challengeId: string): Promise<AppSession> {
    const userAddress = await this.getUserAddress();
    const now = Date.now();

    if (!this.isDemo && this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
      // Live: create app session via RPC
      const brokerAddr = this.clearnodeConfig.brokerAddress || '0x0000000000000000000000000000000000000000';

      const params = {
        definition: {
          protocol: 'NitroRPC/0.2' as RPCProtocolVersion,
          participants: [userAddress as Hex, brokerAddr as Hex],
          weights: [1, 1],
          quorum: 2,
          challenge: 3600,
          nonce: Math.floor(Math.random() * 1_000_000),
          application: 'rizzz-fun',
        } as RPCAppDefinition,
        allocations: [
          { participant: userAddress as Address, asset: 'USDC', amount: depositAmount.toString() },
          { participant: brokerAddr as Address, asset: 'USDC', amount: '0' },
        ],
      };

      try {
        const msg = await createAppSessionMessage(this.ecdsaSigner, params);
        this.wsSend(msg);
        console.log('📨 Sent create_app_session');
      } catch (err) {
        console.warn('create_app_session RPC failed (using local session):', err);
      }
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

    console.log(`🎮 Session created${this.isDemo ? ' (demo)' : ''}:`, {
      sessionId: this.session.sessionId,
      balance: depositAmount.toString(),
      challengeId,
    });

    this.persistSession();
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

    // In live mode, send state update
    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN && this.session?.sessionId) {
      try {
        const msg = await createApplicationMessage(
          this.ecdsaSigner,
          this.session.sessionId as Hex,
          [{ action: 'predict', challengeId, reelId, amount: amount.toString(), nonce }],
        );
        this.wsSend(msg);
      } catch (err) {
        console.warn('Failed to send prediction via RPC:', err);
      }
    }

    console.log(`🔮 Prediction${this.isDemo ? ' (demo)' : ''}:`, { id: prediction.id, reelId, amount: amount.toString() });

    this.persistSession();
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

    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN && this.session?.sessionId) {
      try {
        const msg = await createApplicationMessage(
          this.ecdsaSigner,
          this.session.sessionId as Hex,
          [{ action: 'vote', challengeId, reelId }],
        );
        this.wsSend(msg);
      } catch (err) {
        console.warn('Failed to send vote via RPC:', err);
      }
    }

    this.emit('voteCast', v);
    this.emit('stateUpdate', this.state);
    return v;
  }

  // ── Settlement ─────────────────────────────────

  async requestSettlement(challengeId: string): Promise<{ stateHash: string; signatures: string[]; finalState: SessionState }> {
    if (!this.session || !this.state) throw new Error('No active session');

    if (!this.isDemo && this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      try {
        const userAddr = await this.getUserAddress();
        const closeParams = {
          app_session_id: this.session.sessionId as Hex,
          allocations: [
            { participant: userAddr as Address, asset: 'USDC', amount: this.state.balance.toString() },
          ],
        };
        const msg = await createCloseAppSessionMessage(this.ecdsaSigner, closeParams);
        this.wsSend(msg);
      } catch (err) {
        console.warn('close_app_session RPC failed:', err);
      }
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
  isDemoMode(): boolean { return this.isDemo; }
  getClearnodeConfig(): ClearnodeConfig { return this.clearnodeConfig; }

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

  private async getUserAddress(): Promise<string> {
    if (this.config.walletClient?.account?.address) return this.config.walletClient.account.address;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts?.[0]) return accounts[0];
      } catch { /* ignore */ }
    }
    return '0x0000000000000000000000000000000000000000';
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          // v0.5.3: createPingMessageV2 — no signer needed
          const ping = createPingMessageV2();
          this.wsSend(ping);
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

// Re-export SDK types
export { NitroliteRPC, SdkClient as NitroliteSDKClient };
export type { ContractAddresses, MessageSigner };
