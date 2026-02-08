'use client';

/**
 * ENS Integration for Rizzz.fun
 *
 * Provides hooks for:
 * 1. Name + avatar resolution (useENSIdentity)
 * 2. Text record reads (useENSTextRecord)
 * 3. "Prediction Passport" — DeFi preferences stored in ENS text records
 * 4. Writing text records to ENS (setENSTextRecord)
 *
 * All reads happen on Ethereum mainnet (free, no gas).
 * Writes require mainnet ETH for gas.
 */

import { useEnsName, useEnsAvatar, useEnsAddress, usePublicClient, useChainId } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { useQuery } from '@tanstack/react-query';
import { normalize } from 'viem/ens';
import { namehash, encodeFunctionData } from 'viem';

// ── Constants ──

/** ENS Public Resolver on mainnet */
export const ENS_PUBLIC_RESOLVER_MAINNET = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;

/** ENS Public Resolver on Sepolia testnet */
// Note: Sepolia uses the same resolver contract address as mainnet, but on Sepolia network
export const ENS_PUBLIC_RESOLVER_SEPOLIA = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;

/** Legacy constant for backward compatibility */
export const ENS_PUBLIC_RESOLVER = ENS_PUBLIC_RESOLVER_MAINNET;

/** Our custom text record keys stored in ENS */
export const ENS_KEYS = {
  /** Prediction strategy: conservative | moderate | aggressive | degen */
  STRATEGY: 'com.rizzz.strategy',
  /** Risk tolerance: 1–10 */
  RISK_LEVEL: 'com.rizzz.riskLevel',
  /** Max bet per prediction in USDC */
  MAX_BET: 'com.rizzz.maxBet',
  /** Preferred challenge categories (comma-separated) */
  CATEGORIES: 'com.rizzz.categories',
  /** Auto-tip percentage to creators: 0–20 */
  AUTO_TIP: 'com.rizzz.autoTip',
  /** Bio / tagline for prediction profile */
  BIO: 'com.rizzz.bio',
} as const;

/** Standard ENS text record keys we also read */
export const STANDARD_ENS_KEYS = {
  AVATAR: 'avatar',
  DESCRIPTION: 'description',
  URL: 'url',
  TWITTER: 'com.twitter',
  GITHUB: 'com.github',
  DISCORD: 'com.discord',
  EMAIL: 'email',
} as const;

// ── Types ──

export interface ENSIdentity {
  name: string | null;
  avatar: string | null;
  address: string;
  isLoading: boolean;
}

export interface PredictionPassport {
  strategy: string | null;
  riskLevel: string | null;
  maxBet: string | null;
  categories: string | null;
  autoTip: string | null;
  bio: string | null;
  isLoading: boolean;
  /** Whether ANY field has a non-null value */
  hasPassport: boolean;
}

export interface ENSSocialProfile {
  description: string | null;
  url: string | null;
  twitter: string | null;
  github: string | null;
  discord: string | null;
  email: string | null;
  isLoading: boolean;
}

// ── Core Hooks ──

/**
 * Resolve an Ethereum address to its ENS name + avatar.
 * Tries Sepolia first if user is on Sepolia, then falls back to mainnet.
 * This supports test ENS names on Sepolia testnet.
 */
export function useENSIdentity(address?: string): ENSIdentity {
  const addr = address as `0x${string}` | undefined;
  const chainId = useChainId();
  
  // Try Sepolia first if user is on Sepolia, otherwise use mainnet
  const primaryChainId = chainId === sepolia.id ? sepolia.id : mainnet.id;
  const fallbackChainId = chainId === sepolia.id ? mainnet.id : sepolia.id;

  // Primary resolution (Sepolia if on Sepolia, mainnet otherwise)
  const { data: name, isLoading: nameLoading, error: nameError } = useEnsName({
    address: addr,
    chainId: primaryChainId,
    query: {
      enabled: !!addr,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  });

  // Fallback resolution (try the other chain if primary fails)
  const shouldTryFallback = !!addr && !name && !nameLoading;
  const { data: fallbackName, isLoading: fallbackLoading } = useEnsName({
    address: addr,
    chainId: fallbackChainId,
    query: {
      enabled: shouldTryFallback,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  });

  // Use fallback name if primary didn't resolve
  const resolvedName = name || fallbackName || null;
  const isLoadingName = nameLoading || (fallbackLoading && !name);

  const { data: avatar, isLoading: avatarLoading } = useEnsAvatar({
    name: resolvedName ? normalize(resolvedName) : undefined,
    chainId: primaryChainId, // Avatar uses same chain as name
    query: {
      enabled: !!resolvedName,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  });

  // Debug logging (remove in production)
  if (typeof window !== 'undefined' && addr) {
    if (resolvedName) {
      const source = name ? `[${primaryChainId === sepolia.id ? 'Sepolia' : 'Mainnet'}]` : `[${fallbackChainId === sepolia.id ? 'Sepolia' : 'Mainnet'} fallback]`;
      console.log(`✅ ENS resolved ${source}: ${addr} → ${resolvedName}`);
    } else if (!isLoadingName && !nameError) {
      console.log(`ℹ️ No ENS name found for ${addr} on ${primaryChainId === sepolia.id ? 'Sepolia' : 'Mainnet'}`);
    }
    if (nameError && !fallbackName) {
      console.warn(`⚠️ ENS resolution error for ${addr} on ${primaryChainId === sepolia.id ? 'Sepolia' : 'Mainnet'}:`, nameError);
    }
  }

  return {
    name: resolvedName,
    avatar: avatar ?? null,
    address: address || '',
    isLoading: isLoadingName || (!!resolvedName && avatarLoading),
  };
}

/**
 * Resolve an ENS name to an Ethereum address.
 * Tries Sepolia first if user is on Sepolia, then falls back to mainnet.
 */
export function useENSAddress(name?: string) {
  const chainId = useChainId();
  const primaryChainId = chainId === sepolia.id ? sepolia.id : mainnet.id;
  const fallbackChainId = chainId === sepolia.id ? mainnet.id : sepolia.id;

  const { data, isLoading, error } = useEnsAddress({
    name: name ? normalize(name) : undefined,
    chainId: primaryChainId,
    query: {
      enabled: !!name && name.includes('.'),
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  });

  // Try fallback if primary fails
  const { data: fallbackData } = useEnsAddress({
    name: name ? normalize(name) : undefined,
    chainId: fallbackChainId,
    query: {
      enabled: !!name && name.includes('.') && !data && !isLoading && !!error,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  });

  return { address: (data || fallbackData) ?? null, isLoading, error };
}

/**
 * Read a single ENS text record for a given name.
 * Uses viem's getEnsText via the wagmi public client.
 * Tries Sepolia first if user is on Sepolia, then falls back to mainnet.
 */
export function useENSTextRecord(name: string | null | undefined, key: string) {
  const chainId = useChainId();
  const primaryChainId = chainId === sepolia.id ? sepolia.id : mainnet.id;
  const fallbackChainId = chainId === sepolia.id ? mainnet.id : sepolia.id;
  
  const primaryClient = usePublicClient({ chainId: primaryChainId });
  const fallbackClient = usePublicClient({ chainId: fallbackChainId });

  return useQuery({
    queryKey: ['ensText', name, key, primaryChainId],
    queryFn: async () => {
      if (!name) return null;
      
      // Try primary chain first
      if (primaryClient) {
        try {
          const text = await primaryClient.getEnsText({
            name: normalize(name),
            key,
          });
          if (text) return text;
        } catch (err) {
          console.warn(`Failed to read ENS text record on ${primaryChainId === sepolia.id ? 'Sepolia' : 'Mainnet'}:`, err);
        }
      }
      
      // Try fallback chain
      if (fallbackClient) {
        try {
          const text = await fallbackClient.getEnsText({
            name: normalize(name),
            key,
          });
          if (text) return text;
        } catch (err) {
          // Silently fail
        }
      }
      
      return null;
    },
    enabled: !!name && name.includes('.'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Read all Prediction Passport fields from ENS text records.
 * This is the creative DeFi integration — prediction preferences
 * stored portably in ENS, readable by any prediction market.
 * Tries Sepolia first if user is on Sepolia, then falls back to mainnet.
 */
export function useENSPredictionPassport(name: string | null | undefined): PredictionPassport {
  const chainId = useChainId();
  const primaryChainId = chainId === sepolia.id ? sepolia.id : mainnet.id;
  const fallbackChainId = chainId === sepolia.id ? mainnet.id : sepolia.id;
  
  const primaryClient = usePublicClient({ chainId: primaryChainId });
  const fallbackClient = usePublicClient({ chainId: fallbackChainId });

  const { data, isLoading } = useQuery({
    queryKey: ['ensPredictionPassport', name, primaryChainId],
    queryFn: async () => {
      if (!name) return null;
      const normalizedName = normalize(name);

      // Batch-read all our custom text records
      const keys = Object.values(ENS_KEYS);
      
      // Try primary chain first
      let results: PromiseSettledResult<string | null>[] = [];
      if (primaryClient) {
        try {
          results = await Promise.allSettled(
            keys.map((key) =>
              primaryClient.getEnsText({ name: normalizedName, key }).catch(() => null)
            )
          );
          
          // Check if we got any results
          const hasResults = results.some((r) => r.status === 'fulfilled' && r.value);
          if (hasResults) {
            const values = results.map((r) =>
              r.status === 'fulfilled' ? (r.value || null) : null
            );
            return {
              strategy: values[0],
              riskLevel: values[1],
              maxBet: values[2],
              categories: values[3],
              autoTip: values[4],
              bio: values[5],
            };
          }
        } catch (err) {
          console.warn(`Failed to read passport on ${primaryChainId === sepolia.id ? 'Sepolia' : 'Mainnet'}:`, err);
        }
      }
      
      // Try fallback chain
      if (fallbackClient) {
        try {
          results = await Promise.allSettled(
            keys.map((key) =>
              fallbackClient.getEnsText({ name: normalizedName, key }).catch(() => null)
            )
          );
        } catch (err) {
          // Silently fail
        }
      }

      const values = results.map((r) =>
        r.status === 'fulfilled' ? (r.value || null) : null
      );

      return {
        strategy: values[0],
        riskLevel: values[1],
        maxBet: values[2],
        categories: values[3],
        autoTip: values[4],
        bio: values[5],
      };
    },
    enabled: !!name && name.includes('.'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const passport = data || {
    strategy: null,
    riskLevel: null,
    maxBet: null,
    categories: null,
    autoTip: null,
    bio: null,
  };

  return {
    ...passport,
    isLoading,
    hasPassport: Object.values(passport).some((v) => v !== null),
  };
}

/**
 * Read social profile from standard ENS text records.
 */
export function useENSSocialProfile(name: string | null | undefined): ENSSocialProfile {
  const client = usePublicClient({ chainId: mainnet.id });

  const { data, isLoading } = useQuery({
    queryKey: ['ensSocialProfile', name],
    queryFn: async () => {
      if (!client || !name) return null;
      const normalizedName = normalize(name);

      const keys = Object.values(STANDARD_ENS_KEYS).filter((k) => k !== 'avatar');
      const results = await Promise.allSettled(
        keys.map((key) =>
          client.getEnsText({ name: normalizedName, key }).catch(() => null)
        )
      );

      const values = results.map((r) =>
        r.status === 'fulfilled' ? (r.value || null) : null
      );

      return {
        description: values[0],
        url: values[1],
        twitter: values[2],
        github: values[3],
        discord: values[4],
        email: values[5],
      };
    },
    enabled: !!client && !!name && name.includes('.'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    description: data?.description ?? null,
    url: data?.url ?? null,
    twitter: data?.twitter ?? null,
    github: data?.github ?? null,
    discord: data?.discord ?? null,
    email: data?.email ?? null,
    isLoading,
  };
}

// ── Write Helpers ──

/** ABI for ENS PublicResolver setText */
const RESOLVER_ABI = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

/**
 * Build transaction data for writing an ENS text record.
 * Supports both mainnet and Sepolia testnet.
 */
export function buildSetTextTransaction(
  ensName: string, 
  key: string, 
  value: string,
  chainId: number = mainnet.id
) {
  const node = namehash(normalize(ensName));
  const data = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [node, key, value],
  });

  const resolverAddress = chainId === sepolia.id 
    ? ENS_PUBLIC_RESOLVER_SEPOLIA 
    : ENS_PUBLIC_RESOLVER_MAINNET;

  return {
    to: resolverAddress,
    data,
    chainId,
  };
}

/**
 * Send an ENS text record write via MetaMask / injected wallet.
 * Returns the transaction hash.
 * 
 * This writes REAL data to ENS Public Resolver on the current network.
 * Supports both mainnet and Sepolia testnet.
 * Data is permanently stored on-chain and can be verified on Etherscan.
 */
export async function writeENSTextRecord(
  ensName: string,
  key: string,
  value: string,
  fromAddress: string,
  targetChainId?: number, // Optional: specify chain, otherwise uses current chain
): Promise<`0x${string}`> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No wallet found');

  // Get current chain
  let currentChainId = await ethereum.request({ method: 'eth_chainId' });
  const currentChainIdNum = parseInt(currentChainId, 16);
  
  // Determine target chain (Sepolia or mainnet)
  const finalChainId = targetChainId || currentChainIdNum;
  const isSepolia = finalChainId === sepolia.id;
  const targetChainIdHex = isSepolia ? `0x${sepolia.id.toString(16)}` : '0x1';

  // Switch to target chain if needed
  if (currentChainId !== targetChainIdHex) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }],
      });
      await new Promise((r) => setTimeout(r, 1000)); // Wait for switch
      currentChainId = targetChainIdHex;
    } catch (switchError: any) {
      // If chain doesn't exist, try to add Sepolia
      if (switchError.code === 4902 && isSepolia) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainIdHex,
            chainName: 'Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw switchError;
      }
    }
  }

  const tx = buildSetTextTransaction(ensName, key, value, finalChainId);
  const explorerBase = isSepolia ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';
  const networkName = isSepolia ? 'Sepolia' : 'Mainnet';

  console.log(`📝 Writing ENS text record on ${networkName}: ${ensName} → ${key} = ${value}`);
  console.log(`📍 Contract: ${tx.to} (ENS Public Resolver)`);
  console.log(`🔗 View on Etherscan: ${explorerBase}/address/${tx.to}`);

  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: fromAddress,
      to: tx.to,
      data: tx.data,
      // Gas estimation handled by MetaMask
    }],
  });

  console.log(`✅ Transaction sent on ${networkName}: ${txHash}`);
  console.log(`🔗 View transaction: ${explorerBase}/tx/${txHash}`);

  return txHash as `0x${string}`;
}

/**
 * Get Etherscan link for viewing an ENS text record transaction
 * Supports both mainnet and Sepolia
 */
export function getENSTransactionLink(txHash: string, chainId?: number): string {
  const isSepolia = chainId === sepolia.id;
  const explorerBase = isSepolia ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';
  return `${explorerBase}/tx/${txHash}`;
}

/**
 * Get ENS Explorer link for viewing text records
 * Note: ENS Explorer primarily shows mainnet data, but we can link to it
 */
export function getENSExplorerLink(ensName: string): string {
  return `https://app.ens.domains/${ensName}`;
}

/**
 * Get direct link to view a specific text record on ENS Explorer
 */
export function getENSTextRecordLink(ensName: string, key: string): string {
  return `https://app.ens.domains/${ensName}?tab=records&record=${encodeURIComponent(key)}`;
}

/**
 * Get Sepolia Etherscan link for viewing contract/address
 */
export function getSepoliaEtherscanLink(address: string, type: 'address' | 'tx' = 'address'): string {
  return `https://sepolia.etherscan.io/${type}/${address}`;
}

/**
 * Get mainnet Etherscan link for viewing contract/address
 */
export function getMainnetEtherscanLink(address: string, type: 'address' | 'tx' = 'address'): string {
  return `https://etherscan.io/${type}/${address}`;
}

// ── Display Helpers ──

/**
 * Format an address for display, preferring ENS name.
 */
export function formatENSOrAddress(
  ensName: string | null,
  address: string,
  chars: number = 4,
): string {
  if (ensName) return ensName;
  if (!address) return '';
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Strategy label + emoji for display.
 */
export function getStrategyDisplay(strategy: string | null) {
  switch (strategy) {
    case 'conservative':
      return { label: 'Conservative', emoji: '🛡️', color: 'text-blue-400' };
    case 'moderate':
      return { label: 'Moderate', emoji: '⚖️', color: 'text-green-400' };
    case 'aggressive':
      return { label: 'Aggressive', emoji: '🔥', color: 'text-orange-400' };
    case 'degen':
      return { label: 'Full Degen', emoji: '💎', color: 'text-purple-400' };
    default:
      return { label: 'Not set', emoji: '❓', color: 'text-reel-muted' };
  }
}

/**
 * Risk level display helpers.
 */
export function getRiskDisplay(riskLevel: string | null) {
  const level = parseInt(riskLevel || '0', 10);
  if (level === 0) return { label: 'Not set', color: 'text-reel-muted', width: 0 };
  if (level <= 3) return { label: 'Low', color: 'text-green-400', width: level * 10 };
  if (level <= 6) return { label: 'Medium', color: 'text-yellow-400', width: level * 10 };
  if (level <= 8) return { label: 'High', color: 'text-orange-400', width: level * 10 };
  return { label: 'Max', color: 'text-red-400', width: level * 10 };
}
