'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, truncateAddress, formatTokenAmount } from '@/lib/utils';

export function ConnectButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg glass hover:bg-white/10 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent" />
        <span className="text-sm font-medium text-white hidden sm:block">
          {truncateAddress(address || '')}
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
              {/* Header */}
              <div className="p-4 border-b border-reel-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {address?.slice(2, 4).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {truncateAddress(address || '', 6)}
                    </p>
                    <p className="text-sm text-reel-muted">
                      {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : 'Loading...'}
                    </p>
                  </div>
                </div>
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
