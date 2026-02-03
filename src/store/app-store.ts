import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface Reel {
  id: string;
  challengeId: string;
  creatorAddress: string;
  creatorName: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  votes: number;
  predictionPool: bigint;
  createdAt: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  theme: string;
  coverImage: string;
  startTime: number;
  endTime: number;
  totalPool: bigint;
  reelCount: number;
  participantCount: number;
  status: 'upcoming' | 'active' | 'voting' | 'settled';
  winnerReelId?: string;
}

export interface UserPrediction {
  challengeId: string;
  reelId: string;
  amount: bigint;
  timestamp: number;
}

interface AppState {
  // Active challenge
  activeChallenge: Challenge | null;
  setActiveChallenge: (challenge: Challenge | null) => void;

  // Reels in view
  reels: Reel[];
  setReels: (reels: Reel[]) => void;
  currentReelIndex: number;
  setCurrentReelIndex: (index: number) => void;

  // User state
  userPredictions: UserPrediction[];
  addPrediction: (prediction: UserPrediction) => void;
  updatePrediction: (challengeId: string, reelId: string, amount: bigint) => void;
  removePrediction: (challengeId: string, reelId: string) => void;

  // UI state
  isDepositModalOpen: boolean;
  setDepositModalOpen: (open: boolean) => void;
  isPredictionPanelOpen: boolean;
  setPredictionPanelOpen: (open: boolean) => void;
  selectedReelForPrediction: Reel | null;
  setSelectedReelForPrediction: (reel: Reel | null) => void;

  // Session state
  sessionBalance: bigint;
  setSessionBalance: (balance: bigint) => void;
  lockedInPredictions: bigint;
  setLockedInPredictions: (amount: bigint) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Active challenge
      activeChallenge: null,
      setActiveChallenge: (challenge) => set({ activeChallenge: challenge }),

      // Reels
      reels: [],
      setReels: (reels) => set({ reels }),
      currentReelIndex: 0,
      setCurrentReelIndex: (index) => set({ currentReelIndex: index }),

      // User predictions
      userPredictions: [],
      addPrediction: (prediction) => set((state) => ({
        userPredictions: [...state.userPredictions, prediction]
      })),
      updatePrediction: (challengeId, reelId, amount) => set((state) => ({
        userPredictions: state.userPredictions.map(p =>
          p.challengeId === challengeId && p.reelId === reelId
            ? { ...p, amount }
            : p
        )
      })),
      removePrediction: (challengeId, reelId) => set((state) => ({
        userPredictions: state.userPredictions.filter(
          p => !(p.challengeId === challengeId && p.reelId === reelId)
        )
      })),

      // UI state
      isDepositModalOpen: false,
      setDepositModalOpen: (open) => set({ isDepositModalOpen: open }),
      isPredictionPanelOpen: false,
      setPredictionPanelOpen: (open) => set({ isPredictionPanelOpen: open }),
      selectedReelForPrediction: null,
      setSelectedReelForPrediction: (reel) => set({ 
        selectedReelForPrediction: reel,
        isPredictionPanelOpen: reel !== null
      }),

      // Session
      sessionBalance: 0n,
      setSessionBalance: (balance) => set({ sessionBalance: balance }),
      lockedInPredictions: 0n,
      setLockedInPredictions: (amount) => set({ lockedInPredictions: amount }),
    }),
    {
      name: 'rizzz-fun-storage',
      partialize: (state) => ({
        userPredictions: state.userPredictions,
      }),
      // Custom serializer for BigInt
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str, (key, value) => {
            if (typeof value === 'string' && value.endsWith('n')) {
              return BigInt(value.slice(0, -1));
            }
            return value;
          });
          return parsed;
        },
        setItem: (name, value) => {
          localStorage.setItem(
            name,
            JSON.stringify(value, (key, val) =>
              typeof val === 'bigint' ? val.toString() + 'n' : val
            )
          );
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// Selectors
export const selectUserPredictionForReel = (state: AppState, challengeId: string, reelId: string) =>
  state.userPredictions.find(p => p.challengeId === challengeId && p.reelId === reelId);

export const selectTotalUserPredictions = (state: AppState, challengeId: string) =>
  state.userPredictions
    .filter(p => p.challengeId === challengeId)
    .reduce((sum, p) => sum + p.amount, 0n);
