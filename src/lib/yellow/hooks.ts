/**
 * React hooks for Yellow Network Nitrolite integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient } from 'wagmi';
import { 
  NitroliteClient,
  AppSession,
  SessionState,
  PredictionState,
  VoteState,
  initializeNitroliteClient,
  getNitroliteClient,
  YellowEnvironment,
  YellowClientConfig,
} from './nitrolite-client';

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Hook for managing Yellow Network Nitrolite connection
 * Based on Yellow Network App Sessions architecture
 */
export function useYellowConnection(environment: YellowEnvironment = 'sandbox') {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<NitroliteClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletClient) {
      setStatus('disconnected');
      return;
    }

    const config: YellowClientConfig = {
      environment,
      appId: 'rizzz-fun', // Application identifier per Yellow Network App Sessions
      signer: walletClient,
    };

    const nitroliteClient = initializeNitroliteClient(config);

    nitroliteClient.on('connected', () => setStatus('connected'));
    nitroliteClient.on('disconnected', () => setStatus('disconnected'));
    nitroliteClient.on('error', (err) => {
      setError(err);
      setStatus('error');
    });

    setStatus('connecting');
    nitroliteClient.connect()
      .then(() => {
        setClient(nitroliteClient);
        setStatus('connected');
      })
      .catch((err) => {
        setError(err);
        setStatus('error');
      });

    return () => {
      nitroliteClient.disconnect();
    };
  }, [walletClient, environment]);

  return { client, status, error };
}

/**
 * Hook for managing Yellow Network App Session
 * Based on Yellow Network App Sessions - multi-party application channels
 */
export function useYellowSession() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getNitroliteClient();
      
      const handleSessionUpdate = (updatedSession: AppSession) => {
        setSession(updatedSession);
        setState(updatedSession.state);
      };

      const handleStateChange = (updatedState: SessionState) => {
        setState(updatedState);
        const currentSession = client.getSession();
        if (currentSession) {
          setSession({ ...currentSession, state: updatedState });
        }
      };

      client.on('sessionCreated', handleSessionUpdate);
      client.on('stateUpdate', handleStateChange);

      // Get initial session if exists
      const existingSession = client.getSession();
      if (existingSession) {
        setSession(existingSession);
        setState(existingSession.state);
      }

      return () => {
        client.off('sessionCreated', handleSessionUpdate);
        client.off('stateUpdate', handleStateChange);
      };
    } catch (err) {
      // Client not initialized yet
    }
  }, []);

  const openSession = useCallback(async (depositAmount: bigint, challengeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getNitroliteClient();
      const newSession = await client.createAppSession(depositAmount, challengeId);
      setSession(newSession);
      setState(newSession.state);
      return newSession;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

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

/**
 * Hook for managing predictions via Yellow Network App Sessions
 * Uses Session Keys for gasless operations
 */
export function usePredictions(challengeId?: string) {
  const [predictions, setPredictions] = useState<PredictionState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getNitroliteClient();

      const updatePredictions = () => {
        const allPredictions = challengeId 
          ? client.getPredictionsForChallenge(challengeId)
          : Array.from(client.getState()?.predictions.values() || []);
        setPredictions(allPredictions);
      };

      client.on('predictionMade', updatePredictions);
      client.on('predictionUpdated', updatePredictions);
      client.on('predictionCancelled', updatePredictions);
      client.on('stateUpdate', updatePredictions);

      // Initial load
      updatePredictions();

      return () => {
        client.off('predictionMade', updatePredictions);
        client.off('predictionUpdated', updatePredictions);
        client.off('predictionCancelled', updatePredictions);
        client.off('stateUpdate', updatePredictions);
      };
    } catch (err) {
      // Client not initialized yet
    }
  }, [challengeId]);

  const makePrediction = useCallback(async (
    targetChallengeId: string,
    reelId: string,
    amount: bigint
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getNitroliteClient();
      const prediction = await client.makePrediction(targetChallengeId, reelId, amount);
      return prediction;
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
      const client = getNitroliteClient();
      const updated = await client.updatePrediction(predictionId, newAmount);
      return updated;
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
      const client = getNitroliteClient();
      await client.cancelPrediction(predictionId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTotalForReel = useCallback((targetChallengeId: string, reelId: string): bigint => {
    try {
      const client = getNitroliteClient();
      return client.getTotalPredictionForReel(targetChallengeId, reelId);
    } catch {
      return 0n;
    }
  }, []);

  return {
    predictions,
    makePrediction,
    updatePrediction,
    cancelPrediction,
    getTotalForReel,
    isLoading,
    error,
  };
}

/**
 * Hook for voting via Yellow Network App Sessions
 * Uses Session Keys for gasless voting
 */
export function useVoting() {
  const [votes, setVotes] = useState<VoteState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getNitroliteClient();

      const handleVote = (vote: VoteState) => {
        setVotes(prev => [...prev, vote]);
      };

      client.on('voteCast', handleVote);

      // Load existing votes from state
      const state = client.getState();
      if (state) {
        setVotes(Array.from(state.votes.values()));
      }

      return () => {
        client.off('voteCast', handleVote);
      };
    } catch {
      // Client not initialized
    }
  }, []);

  const castVote = useCallback(async (challengeId: string, reelId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getNitroliteClient();
      const vote = await client.vote(challengeId, reelId);
      return vote;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    votes,
    castVote,
    isLoading,
    error,
  };
}

/**
 * Hook for settlement via Yellow Network
 * Aggregates off-chain state and prepares for on-chain settlement
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
    try {
      const client = getNitroliteClient();

      client.on('settlementReady', (data: {
        stateHash: string;
        signatures: string[];
        finalState: SessionState;
      }) => {
        setSettlementData(data);
        setIsSettling(false);
      });

      client.on('sessionSettled', () => {
        setIsSettled(true);
        setIsSettling(false);
      });

      return () => {
        client.off('settlementReady', () => {});
        client.off('sessionSettled', () => {});
      };
    } catch {
      // Client not initialized
    }
  }, []);

  const requestSettlement = useCallback(async (challengeId: string) => {
    setIsSettling(true);
    setError(null);
    try {
      const client = getNitroliteClient();
      const data = await client.requestSettlement(challengeId);
      setSettlementData(data);
      return data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    settlementData,
    requestSettlement,
    isSettling,
    isSettled,
    error,
  };
}
