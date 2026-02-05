'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia, arbitrum, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { useState, useMemo, type ReactNode } from 'react';
import { ToastProvider, Toaster } from '@/components/ui/toast';

// WalletConnect project ID (optional - only needed for mobile wallet support)
// If not provided, only browser extension wallets will work
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID;

// Create wagmi config as a singleton to prevent multiple initializations
let wagmiConfigInstance: ReturnType<typeof createConfig> | null = null;

function getWagmiConfig() {
  if (!wagmiConfigInstance) {
    // Build connectors array
    const connectors = [injected()];
    
    // Only add WalletConnect if Project ID is provided
    // Without it, WalletConnect won't work, but browser extensions will
    if (projectId && projectId !== 'demo' && projectId !== 'your_walletconnect_project_id') {
      connectors.push(walletConnect({ projectId }));
    } else if (!projectId) {
      console.warn(
        '⚠️ WalletConnect Project ID not set. Mobile wallet connections will not work.\n' +
        'Browser extension wallets (MetaMask, etc.) will still work.\n' +
        'Get a free Project ID from: https://cloud.walletconnect.com/'
      );
    }
    
    wagmiConfigInstance = createConfig({
      chains: [sepolia, arbitrum, base],
      connectors,
      transports: {
        [sepolia.id]: http(),
        [arbitrum.id]: http(),
        [base.id]: http(),
      },
    });
  }
  return wagmiConfigInstance;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  // Use useMemo to ensure config is only created once per component instance
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
