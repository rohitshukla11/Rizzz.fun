'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, truncateAddress, formatTokenAmount } from '@/lib/utils';
import { useENSIdentity, formatENSOrAddress } from '@/lib/ens';
import { ENSAvatar } from '@/components/ens/ens-identity';

export function ConnectButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // ENS identity resolution
  const { name: ensName, avatar: ensAvatar, isLoading: ensLoading } = useENSIdentity(address);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show loading state during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="relative">
        <Button
          variant="glass"
          size="sm"
          disabled
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect</span>
        </Button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="relative">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="glass"
          size="sm"
          isLoading={isPending}
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect</span>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-64 p-3 glass-strong rounded-xl z-50"
            >
              <p className="text-sm font-medium text-white mb-3">
                Choose Wallet
              </p>
              <div className="space-y-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => {
                      connect({ connector });
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-reel-card hover:bg-reel-card/80 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-reel-surface flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-reel-primary" />
                    </div>
                    <span className="text-sm font-medium text-white">
                      {connector.name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const displayName = formatENSOrAddress(ensName, address || '', 4);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg glass hover:bg-white/10 transition-colors"
      >
        {/* ENS avatar or colored fallback */}
        <ENSAvatar address={address} size="xs" className="border-[1px]" />
        <span className="text-sm font-medium text-white hidden sm:block">
          {ensLoading ? '...' : displayName}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-reel-muted transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-72 glass-strong rounded-xl overflow-hidden z-50"
            >
              {/* Header with ENS */}
              <div className="p-4 border-b border-reel-border">
                <div className="flex items-center gap-3">
                  <ENSAvatar address={address} size="lg" />
                  <div className="flex-1 min-w-0">
                    {ensName ? (
                      <>
                        <p className="font-bold text-white truncate text-base">
                          {ensName}
                        </p>
                        <p className="text-sm text-reel-muted font-mono">
                          {truncateAddress(address || '', 6)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-white truncate font-mono">
                          {truncateAddress(address || '', 6)}
                        </p>
                        <p className="text-sm text-reel-muted">
                          Sepolia
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* ENS badge */}
                {ensName && (
                  <div className="mt-2 px-2 py-1 bg-reel-primary/20 rounded-lg inline-flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-reel-primary" />
                    <span className="text-xs text-reel-primary font-medium">
                      ENS Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-reel-card transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-reel-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-reel-muted" />
                  )}
                  <span className="text-sm text-white">
                    {copied ? 'Copied!' : 'Copy Address'}
                  </span>
                </button>

                {ensName && (
                  <a
                    href={`https://app.ens.domains/${ensName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-reel-card transition-colors"
                  >
                    <User className="w-4 h-4 text-reel-muted" />
                    <span className="text-sm text-white">View ENS Profile</span>
                  </a>
                )}

                <a
                  href={`https://etherscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-reel-card transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-reel-muted" />
                  <span className="text-sm text-white">View on Explorer</span>
                </a>

                <button
                  onClick={() => {
                    disconnect();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Disconnect</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
