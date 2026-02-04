'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia, arbitrum, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { useState, type ReactNode } from 'react';
import { ToastProvider, Toaster } from '@/components/ui/toast';

// WalletConnect project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'demo';

const wagmiConfig = createConfig({
  chains: [sepolia, arbitrum, base],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

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
