'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia, arbitrum, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { fallback } from 'viem';
import { useState, useMemo, type ReactNode } from 'react';
import { ToastProvider, Toaster } from '@/components/ui/toast';

// WalletConnect project ID (optional - only needed for mobile wallet support)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID;

// RPC URLs for read calls (balance checks, gas estimation, etc.)
const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const arbitrumRpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL;
const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;

// Create wagmi config as a singleton to prevent multiple initializations
let wagmiConfigInstance: ReturnType<typeof createConfig> | null = null;

function getWagmiConfig() {
  // Persist across Fast Refresh/HMR
  const globalAny = globalThis as unknown as { __wagmiConfig?: ReturnType<typeof createConfig> };
  if (globalAny.__wagmiConfig) {
    wagmiConfigInstance = globalAny.__wagmiConfig;
    return wagmiConfigInstance;
  }

  // Build connectors array
  const connectors = [injected()];
  
  if (projectId && projectId !== 'demo' && projectId !== 'your_walletconnect_project_id') {
    connectors.push(walletConnect({ projectId }));
  } else if (!projectId) {
    console.warn(
      '⚠️ WalletConnect Project ID not set. Mobile wallet connections will not work.\n' +
      'Browser extension wallets (MetaMask, etc.) will still work.\n' +
      'Get a free Project ID from: https://cloud.walletconnect.com/'
    );
  }

  // Use HTTP-only transports with multiple fallback endpoints.
  // Write transactions go through MetaMask's connector automatically.
  // We skip gas simulation by passing explicit `gas` in deposit-modal.tsx,
  // so these RPCs are only used for read calls (balances, chain info, etc.)
  const sepoliaTransport = fallback([
    // Primary: user-configured RPC (from .env.local)
    http(sepoliaRpcUrl || 'https://1rpc.io/sepolia', { retryCount: 1, timeout: 8000 }),
    // Fallback 1
    http('https://rpc.sepolia.org', { retryCount: 1, timeout: 8000 }),
    // Fallback 2
    http('https://ethereum-sepolia-rpc.publicnode.com', { retryCount: 1, timeout: 8000 }),
  ]);

  wagmiConfigInstance = createConfig({
    chains: [sepolia, arbitrum, base],
    connectors,
    // Disable automatic block polling — dramatically reduces RPC calls
    pollingInterval: 30_000, // 30s instead of default 4s
    transports: {
      [sepolia.id]: sepoliaTransport,
      [arbitrum.id]: arbitrumRpcUrl ? http(arbitrumRpcUrl) : http(),
      [base.id]: baseRpcUrl ? http(baseRpcUrl) : http(),
    },
  });

  globalAny.__wagmiConfig = wagmiConfigInstance;
  return wagmiConfigInstance;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,       // 5 min — data stays fresh longer
        gcTime: 10 * 60 * 1000,          // 10 min — keep cache longer
        refetchOnWindowFocus: false,      // Don't refetch when tab regains focus
        refetchOnMount: false,            // Don't refetch when component mounts
        refetchOnReconnect: false,        // Don't refetch on network reconnect
        refetchInterval: false,           // No automatic polling
        retry: 1,                         // Only 1 retry on failure
      },
    },
  }));

  const wagmiConfig = useMemo(() => getWagmiConfig(), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
