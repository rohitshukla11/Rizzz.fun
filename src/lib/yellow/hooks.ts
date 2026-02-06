/**
 * React hooks for Yellow Network @erc7824/nitrolite SDK integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 *
 * Flow:
 *   1. useYellowConnection  → connect to Clearnode (or enter demo mode)
 *   2. useYellowSession     → create app session after on-chain deposit
 *   3. usePredictions       → instant, gasless predictions off-chain
 *   4. useVoting            → instant, gasless votes off-chain
 *   5. useSettlement        → finalise on-chain when session ends
 *
 * ARCHITECTURE NOTE:
 * Session state is held in MODULE-LEVEL singletons so that every component
 * calling the same hook sees the *same* session / state / predictions.
 * React components subscribe via a tiny pub-sub (_sessionListeners) and
 * re-render when the shared state changes.
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

let _sharedSession: AppSession | null = null;
let _sharedState: SessionState | null = null;
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
}

// ════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════

/**
 * Build a YellowConfig from env vars + wagmi clients.
 */
function buildConfig(walletClient: any, publicClient: any, chainId: number): YellowConfig {
  return {
    clearnodeUrl: process.env.NEXT_PUBLIC_YELLOW_CLEARNODE_URL || undefined,
    custody: (process.env.NEXT_PUBLIC_YELLOW_CUSTODY_ADDRESS || undefined) as any,
    adjudicator: (process.env.NEXT_PUBLIC_YELLOW_ADJUDICATOR_ADDRESS || undefined) as any,
    guestAddress: (process.env.NEXT_PUBLIC_YELLOW_GUEST_ADDRESS || undefined) as any,
    tokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || undefined) as any,
    chainId,
    challengeDuration: 100n,
    publicClient: publicClient ?? undefined,
    walletClient: walletClient ?? undefined,
  };
}

/**
 * Ensure the singleton YellowNitroliteClient exists.
 * Creates it with demo-mode defaults if needed and wires global events.
 */
function ensureClient(walletClient?: any, publicClient?: any, chainId?: number): YellowNitroliteClient {
  const existing = getYellowClientSafe();
  if (existing) {
    _wireClientEvents(existing);
    return existing;
  }

  const config = buildConfig(walletClient, publicClient, chainId ?? 11155111);
  const client = initializeYellowClient(config);

  // Wire global event handlers so shared state stays in sync
  _wireClientEvents(client);

  client.connect().catch(() => {});
  return client;
}

// ════════════════════════════════════════════════════
// useYellowConnection
// ════════════════════════════════════════════════════

/**
 * Initialise and connect to the Yellow Network.
 * Auto-connects when a wallet is available.
 */
export function useYellowConnection() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [client, setClient] = useState<YellowNitroliteClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletClient) {
      setStatus('disconnected');
      return;
    }

    const config = buildConfig(walletClient, publicClient, chainId);
    const yellowClient = initializeYellowClient(config);
    _wireClientEvents(yellowClient);

    yellowClient.on('connected', () => setStatus('connected'));
    yellowClient.on('disconnected', () => setStatus('disconnected'));
    yellowClient.on('error', (err: Error) => {
      setError(err);
      setStatus('error');
    });

    setStatus('connecting');
    yellowClient.connect()
      .then(() => {
        setClient(yellowClient);
        setStatus('connected');
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      });

    return () => {
      yellowClient.disconnect();
    };
  }, [walletClient, publicClient, chainId]);

  return { client, status, error };
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
 */
export function useYellowSession() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Force re-render when shared state changes
  const [, rerender] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to shared state changes
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _sessionListeners.add(listener);

    // On mount, check if the singleton client already has a session
    const client = getYellowClientSafe();
    if (client) {
      _wireClientEvents(client);
      const existing = client.getSession();
      if (existing && !_sharedSession) {
        _setSharedSession(existing, existing.state);
      }
    }

    return () => {
      _sessionListeners.delete(listener);
    };
  }, []);

  const openSession = useCallback(async (depositAmount: bigint, challengeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = ensureClient(walletClient, publicClient, chainId);
      const newSession = await client.createAppSession(depositAmount, challengeId);
      // setSharedSession is also called by the 'sessionCreated' event handler,
      // but we call it here too for immediate reactivity.
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
    const client = getYellowClientSafe();
    if (!client) return [];
    if (challengeId) return client.getPredictionsForChallenge(challengeId);
    const s = client.getState();
    return s ? Array.from(s.predictions.values()) : [];
  })();

  const makePrediction = useCallback(async (targetChallengeId: string, reelId: string, amount: bigint) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = ensureClient();
      return await client.makePrediction(targetChallengeId, reelId, amount);
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
      const client = ensureClient();
      return await client.updatePrediction(predictionId, newAmount);
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
      const client = ensureClient();
      await client.cancelPrediction(predictionId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTotalForReel = useCallback((targetChallengeId: string, reelId: string): bigint => {
    const client = getYellowClientSafe();
    if (!client) return 0n;
    return client.getTotalPredictionForReel(targetChallengeId, reelId);
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
    const client = getYellowClientSafe();
    if (!client) return [];
    const s = client.getState();
    return s ? Array.from(s.votes.values()) : [];
  })();

  const castVote = useCallback(async (challengeId: string, reelId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = ensureClient();
      return await client.vote(challengeId, reelId);
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
    const client = getYellowClientSafe();
    if (!client) return;

    const handleSettlement = (data: { stateHash: string; signatures: string[]; finalState: SessionState }) => {
      setSettlementData(data);
      setIsSettling(false);
    };
    const handleSettled = () => { setIsSettled(true); setIsSettling(false); };

    client.on('settlementReady', handleSettlement);
    client.on('sessionSettled', handleSettled);

    return () => {
      client.off('settlementReady', handleSettlement);
      client.off('sessionSettled', handleSettled);
    };
  }, []);

  const requestSettlement = useCallback(async (challengeId: string) => {
    setIsSettling(true);
    setError(null);
    try {
      const client = ensureClient();
      const data = await client.requestSettlement(challengeId);
      setSettlementData(data);
      return data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return { settlementData, requestSettlement, isSettling, isSettled, error };
}
