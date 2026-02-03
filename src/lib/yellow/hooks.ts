/**
 * React hooks for Yellow Network integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient } from 'wagmi';
import { 
  YellowClient, 
  YellowSession, 
  Prediction, 
  Vote,
  SettlementProof,
  initializeYellowClient,
  getYellowClient,
  YellowEnvironment,
} from './client';

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Hook for managing Yellow Network connection
 */
export function useYellowConnection(environment: YellowEnvironment = 'sandbox') {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<YellowClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletClient) {
      setStatus('disconnected');
      return;
    }

    const yellowClient = initializeYellowClient({
      environment,
      signer: walletClient,
    });

    yellowClient.on('connected', () => setStatus('connected'));
    yellowClient.on('disconnected', () => setStatus('disconnected'));
    yellowClient.on('error', (err) => {
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
        setError(err);
        setStatus('error');
      });

    return () => {
      yellowClient.disconnect();
    };
  }, [walletClient, environment]);

  return { client, status, error };
}

/**
 * Hook for managing Yellow Network session
 */
export function useYellowSession() {
  const [session, setSession] = useState<YellowSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getYellowClient();
      
      const handleSessionUpdate = (updatedSession: YellowSession) => {
        setSession(updatedSession);
      };

      client.on('sessionOpened', handleSessionUpdate);
      client.on('sessionUpdate', handleSessionUpdate);

      // Get initial session if exists
      const existingSession = client.getSession();
      if (existingSession) {
        setSession(existingSession);
      }

      return () => {
        client.off('sessionOpened', handleSessionUpdate);
        client.off('sessionUpdate', handleSessionUpdate);
      };
    } catch (err) {
      // Client not initialized yet
    }
  }, []);

  const openSession = useCallback(async (depositAmount: bigint, challengeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getYellowClient();
      const newSession = await client.openSession(depositAmount, challengeId);
      setSession(newSession);
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
    openSession,
    isLoading,
    error,
    availableBalance: session?.availableBalance ?? 0n,
    lockedInPredictions: session?.lockedInPredictions ?? 0n,
  };
}

/**
 * Hook for managing predictions
 */
export function usePredictions(challengeId?: string) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getYellowClient();

      const updatePredictions = () => {
        const allPredictions = challengeId 
          ? client.getPredictionsForChallenge(challengeId)
          : client.getPredictions();
        setPredictions(allPredictions);
      };

      client.on('predictionMade', updatePredictions);
      client.on('predictionUpdated', updatePredictions);
      client.on('predictionCancelled', updatePredictions);
      client.on('predictionConfirmed', updatePredictions);

      // Initial load
      updatePredictions();

      return () => {
        client.off('predictionMade', updatePredictions);
        client.off('predictionUpdated', updatePredictions);
        client.off('predictionCancelled', updatePredictions);
        client.off('predictionConfirmed', updatePredictions);
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
      const client = getYellowClient();
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
      const client = getYellowClient();
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
      const client = getYellowClient();
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
      const client = getYellowClient();
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
 * Hook for voting
 */
export function useVoting() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getYellowClient();

      const handleVote = (vote: Vote) => {
        setVotes(prev => [...prev, vote]);
      };

      client.on('voteCast', handleVote);

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
      const client = getYellowClient();
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
 * Hook for settlement
 */
export function useSettlement() {
  const [settlementProof, setSettlementProof] = useState<SettlementProof | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const client = getYellowClient();

      client.on('settlementProofGenerated', (proof: SettlementProof) => {
        setSettlementProof(proof);
      });

      client.on('settlementComplete', () => {
        setIsSettled(true);
        setIsSettling(false);
      });

      return () => {
        client.off('settlementProofGenerated', () => {});
        client.off('settlementComplete', () => {});
      };
    } catch {
      // Client not initialized
    }
  }, []);

  const requestSettlement = useCallback(async (challengeId: string) => {
    setIsSettling(true);
    setError(null);
    try {
      const client = getYellowClient();
      const proof = await client.requestSettlement(challengeId);
      setSettlementProof(proof);
      return proof;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    settlementProof,
    requestSettlement,
    isSettling,
    isSettled,
    error,
  };
}
