/**
 * React hooks for Yellow Network @erc7824/nitrolite SDK integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 *
 * Flow:
 *   1. useYellowSession     → create app session (connects lazily on first use)
 *   2. usePredictions       → instant, gasless predictions off-chain
 *   3. useVoting            → instant, gasless votes off-chain
 *   4. useSettlement        → finalise on-chain when session ends
 *
 * ARCHITECTURE NOTE:
 * Session state is held in MODULE-LEVEL singletons so that every component
 * calling the same hook sees the *same* session / state / predictions.
 * React components subscribe via a tiny pub-sub (_sessionListeners) and
 * re-render when the shared state changes.
 *
 * IMPORTANT: The Yellow client is created LAZILY — only when the user
 * explicitly starts a session (clicks "Start Session"). This prevents
 * unwanted MetaMask popups on page load.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient, usePublicClient, useChainId } from 'wagmi';
import {
  YellowNitroliteClient,
  initializeYellowClient,
  getYellowClientSafe,
  type AppSession,
  type SessionState,
  type PredictionState,
  type VoteState,
  type YellowConfig,
} from './nitrolite-client';

// ── Connection status ────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ════════════════════════════════════════════════════
// MODULE-LEVEL SHARED STATE
// One copy per JS runtime, shared by every hook instance.
// ════════════════════════════════════════════════════

let _sharedClient: YellowNitroliteClient | null = null;
let _sharedSession: AppSession | null = null;
let _sharedState: SessionState | null = null;
let _connectionStatus: ConnectionStatus = 'disconnected';
const _sessionListeners = new Set<() => void>();

/** Notify every mounted hook to re-render. */
function _notifySessionListeners() {
  _sessionListeners.forEach((fn) => fn());
}

/** Set session + state and broadcast to all listeners. */
function _setSharedSession(session: AppSession | null, state: SessionState | null) {
  _sharedSession = session;
  _sharedState = state;
  _notifySessionListeners();
}

/** Whether we've already wired global event handlers to the client singleton. */
let _clientEventsWired = false;

/** Wire up event listeners on the client singleton so that any state change
 *  (from any component) automatically updates the shared session state.  */
function _wireClientEvents(client: YellowNitroliteClient) {
  if (_clientEventsWired) return;
  _clientEventsWired = true;

  client.on('sessionCreated', (s: AppSession) => {
    _setSharedSession(s, s.state);
  });

  client.on('stateUpdate', (updatedState: SessionState) => {
    if (_sharedSession) {
      const updated: AppSession = {
        ..._sharedSession,
        state: updatedState,
        availableBalance: updatedState.balance - updatedState.lockedAmount,
      };
      _setSharedSession(updated, updatedState);
    }
  });

  client.on('predictionMade', () => _notifySessionListeners());
  client.on('predictionUpdated', () => _notifySessionListeners());
  client.on('predictionCancelled', () => _notifySessionListeners());
  client.on('voteCast', () => _notifySessionListeners());
  client.on('settlementReady', () => _notifySessionListeners());

  client.on('connected', () => {
    _connectionStatus = 'connected';
    _notifySessionListeners();
  });
  client.on('disconnected', () => {
    _connectionStatus = 'disconnected';
    _notifySessionListeners();
  });
  client.on('error', () => {
    _connectionStatus = 'error';
    _notifySessionListeners();
  });
}

// ════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════

/**
 * Build a YellowConfig from env vars + wagmi clients.
 * Per Yellow docs, only CLEARNODE_URL is required — contract addresses
 * are fetched dynamically from the Clearnode via get_config.
 */
function buildConfig(walletClient: any, publicClient: any, chainId: number): YellowConfig {
  return {
    clearnodeUrl: process.env.NEXT_PUBLIC_YELLOW_CLEARNODE_URL || undefined,
    chainId,
    publicClient: publicClient ?? undefined,
    walletClient: walletClient ?? undefined,
  };
}

/**
 * Get or create the singleton client. Does NOT connect automatically.
 * Connection only happens when explicitly requested (e.g., in openSession).
 */
function getOrCreateClient(walletClient?: any, publicClient?: any, chainId?: number): YellowNitroliteClient {
  if (_sharedClient) {
    // Update wallet clients if they became available after initial creation
    if (walletClient || publicClient) {
      _sharedClient.updateClients(publicClient, walletClient);
    }
    return _sharedClient;
  }

  const existing = getYellowClientSafe();
  if (existing) {
    _sharedClient = existing;
    _wireClientEvents(existing);
    if (walletClient || publicClient) {
      existing.updateClients(publicClient, walletClient);
    }
    return existing;
  }

  const config = buildConfig(walletClient, publicClient, chainId ?? 11155111);
  const client = initializeYellowClient(config);
  _sharedClient = client;
  _wireClientEvents(client);
  return client;
}

/**
 * Connect the singleton client to the Clearnode.
 * Safe to call multiple times — will no-op if already connected.
 */
async function connectClient(client: YellowNitroliteClient): Promise<void> {
  if (_connectionStatus === 'connected') return;
  if (_connectionStatus === 'connecting') return;

  _connectionStatus = 'connecting';
  _notifySessionListeners();

  try {
    await client.connect();
    _connectionStatus = 'connected';
  } catch (err) {
    console.warn('Yellow Network connect failed (will use local session):', err);
    _connectionStatus = 'error';
  }
  _notifySessionListeners();
}

// ════════════════════════════════════════════════════
// useYellowSession
// ════════════════════════════════════════════════════

/**
 * Manage a Yellow Network App Session.
 *
 * Session state is MODULE-LEVEL so every component that calls this hook
 * sees the same session. When `openSession()` is called from the deposit
 * modal, the challenge page (and every other consumer) re-renders with
 * the updated session.
 *
 * LAZY: The client is only created and connected when openSession() is called.
 * No MetaMask popups on page load.
 */
export function useYellowSession() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Force re-render when shared state changes
  const [, rerender] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to shared state changes + restore session from localStorage
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _sessionListeners.add(listener);

    // On mount, try to restore session from localStorage
    if (!_sharedSession) {
      // If client exists, check its in-memory session first
      if (_sharedClient) {
        const existing = _sharedClient.getSession();
        if (existing) {
          _setSharedSession(existing, existing.state);
        }
      }

      // If still no session, try restoring from localStorage
      if (!_sharedSession) {
        try {
          const client = getOrCreateClient(walletClient, publicClient, chainId);
          const restored = client.restoreSession();
          if (restored) {
            _setSharedSession(restored, restored.state);
          }
        } catch {
          // Client creation might fail without wallet — that's OK
        }
      }
    }

    return () => {
      _sessionListeners.delete(listener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSession = useCallback(async (depositAmount: bigint, challengeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Get or create client (generates ephemeral session key)
      const client = getOrCreateClient(walletClient, publicClient, chainId);

      // Step 2: For sandbox, request faucet tokens for the SESSION KEY address
      // (must happen BEFORE auth, because we authenticate as the session key)
      if (client.isSandbox()) {
        console.log('🚰 Requesting faucet tokens for session key...');
        await client.requestFaucetTokens();
      }

      // Step 3: Connect to clearnode and authenticate (zero MetaMask popups)
      await connectClient(client);

      // Step 4: Create app session (works in both live and local mode)
      const newSession = await client.createAppSession(depositAmount, challengeId);
      _setSharedSession(newSession, newSession.state);
      return newSession;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, publicClient, chainId]);

  const session = _sharedSession;
  const state = _sharedState;

  return {
    session,
    state,
    openSession,
    isLoading,
    error,
    connectionStatus: _connectionStatus,
    availableBalance: state ? state.balance - state.lockedAmount : 0n,
    lockedInPredictions: state?.lockedAmount ?? 0n,
  };
}

// ════════════════════════════════════════════════════
// usePredictions
// ════════════════════════════════════════════════════

/**
 * Make instant, gasless predictions via the off-chain App Session.
 */
export function usePredictions(challengeId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to shared state so predictions list re-renders on changes
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _sessionListeners.add(listener);
    return () => { _sessionListeners.delete(listener); };
  }, []);

  // Derive predictions from the shared client state
  const predictions: PredictionState[] = (() => {
    if (!_sharedClient) return [];
    if (challengeId) return _sharedClient.getPredictionsForChallenge(challengeId);
    const s = _sharedClient.getState();
    return s ? Array.from(s.predictions.values()) : [];
  })();

  const makePrediction = useCallback(async (targetChallengeId: string, reelId: string, amount: bigint) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!_sharedClient) throw new Error('No Yellow client — open a session first');
      return await _sharedClient.makePrediction(targetChallengeId, reelId, amount);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePrediction = useCallback(async (predictionId: string, newAmount: bigint) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!_sharedClient) throw new Error('No Yellow client — open a session first');
      return await _sharedClient.updatePrediction(predictionId, newAmount);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelPrediction = useCallback(async (predictionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!_sharedClient) throw new Error('No Yellow client — open a session first');
      await _sharedClient.cancelPrediction(predictionId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTotalForReel = useCallback((targetChallengeId: string, reelId: string): bigint => {
    if (!_sharedClient) return 0n;
    return _sharedClient.getTotalPredictionForReel(targetChallengeId, reelId);
  }, []);

  return { predictions, makePrediction, updatePrediction, cancelPrediction, getTotalForReel, isLoading, error };
}

// ════════════════════════════════════════════════════
// useVoting
// ════════════════════════════════════════════════════

/**
 * Cast instant, gasless votes via the off-chain App Session.
 */
export function useVoting() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _sessionListeners.add(listener);
    return () => { _sessionListeners.delete(listener); };
  }, []);

  const votes: VoteState[] = (() => {
    if (!_sharedClient) return [];
    const s = _sharedClient.getState();
    return s ? Array.from(s.votes.values()) : [];
  })();

  const castVote = useCallback(async (challengeId: string, reelId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!_sharedClient) throw new Error('No Yellow client — open a session first');
      return await _sharedClient.vote(challengeId, reelId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { votes, castVote, isLoading, error };
}

// ════════════════════════════════════════════════════
// useSettlement
// ════════════════════════════════════════════════════

/**
 * Finalise session on-chain: request settlement from the App Session,
 * then close the state channel and withdraw from custody.
 */
export function useSettlement() {
  const [settlementData, setSettlementData] = useState<{
    stateHash: string;
    signatures: string[];
    finalState: SessionState;
  } | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!_sharedClient) return;

    const handleSettlement = (data: { stateHash: string; signatures: string[]; finalState: SessionState }) => {
      setSettlementData(data);
      setIsSettling(false);
    };
    const handleSettled = () => { setIsSettled(true); setIsSettling(false); };

    _sharedClient.on('settlementReady', handleSettlement);
    _sharedClient.on('sessionSettled', handleSettled);

    return () => {
      _sharedClient?.off('settlementReady', handleSettlement);
      _sharedClient?.off('sessionSettled', handleSettled);
    };
  }, []);

  const requestSettlement = useCallback(async (challengeId: string) => {
    setIsSettling(true);
    setError(null);
    try {
      if (!_sharedClient) throw new Error('No Yellow client — open a session first');
      const data = await _sharedClient.requestSettlement(challengeId);
      setSettlementData(data);
      return data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return { settlementData, requestSettlement, isSettling, isSettled, error };
}
