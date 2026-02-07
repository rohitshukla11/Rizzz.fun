'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, ArrowRight, Shield, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { useAccount, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { encodeFunctionData } from 'viem';
import { Button } from '@/components/ui/button';
import { useYellowSession } from '@/lib/yellow';
import { useAppStore } from '@/store/app-store';
import { cn, formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { getYellowClientSafe } from '@/lib/yellow/nitrolite-client';

// Contract addresses (only needed for on-chain deposit fallback)
const USDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as `0x${string}`;
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`;

// Whether we have a Yellow clearnode URL (sandbox or production)
const HAS_CLEARNODE = !!process.env.NEXT_PUBLIC_YELLOW_CLEARNODE_URL;
const IS_SANDBOX = process.env.NEXT_PUBLIC_YELLOW_CLEARNODE_URL?.includes('sandbox') ?? false;

// ERC20 ABI for approval
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Deposit ABI
const DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'challengeId', type: 'string' },
      { name: 'channelId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeId: string;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type Step = 'input' | 'faucet' | 'approve' | 'deposit' | 'session' | 'success' | (string & {});

const presetAmounts = [1, 5, 10, 50];

// Sepolia chain ID in hex for MetaMask wallet_switchEthereumChain
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'; // 11155111

/**
 * Ensure MetaMask is on the correct chain before sending a transaction.
 */
async function ensureSepoliaChain(ethereum: any): Promise<void> {
  try {
    const currentChainId = await ethereum.request({ method: 'eth_chainId' });
    if (currentChainId.toLowerCase() !== SEPOLIA_CHAIN_ID_HEX) {
      console.log(`⚠️ MetaMask is on chain ${currentChainId}, switching to Sepolia (${SEPOLIA_CHAIN_ID_HEX})...`);
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: SEPOLIA_CHAIN_ID_HEX,
          chainName: 'Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.infura.io/v3/cce1a039dc234d5d848ffdba280dff17'],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Send a transaction directly via window.ethereum (MetaMask provider).
 */
async function sendViaMetaMask(params: {
  from: string;
  to: string;
  data: string;
  gas?: bigint;
}): Promise<`0x${string}`> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  await ensureSepoliaChain(ethereum);

  const txParams: Record<string, string> = {
    from: params.from,
    to: params.to,
    data: params.data,
  };

  if (params.gas) {
    txParams.gas = `0x${params.gas.toString(16)}`;
  }

  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  });

  return txHash as `0x${string}`;
}

export function DepositModal({ isOpen, onClose, challengeId }: DepositModalProps) {
  const [amount, setAmount] = useState('1');
  const [step, setStep] = useState<Step>('input');
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { openSession } = useYellowSession();
  const { setSessionBalance, setDepositModalOpen } = useAppStore();
  const { addToast } = useToast();
  const expectedChainId = sepolia.id;

  // USDC uses 6 decimals
  const parsedAmount = amount ? parseTokenAmount(amount, 6) : 0n;

  // Watch for approval tx confirmation (only used in on-chain flow)
  const { isLoading: isWaitingApproval, isSuccess: approvalSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Watch for deposit tx confirmation (only used in on-chain flow)
  const { isLoading: isWaitingDeposit, isSuccess: depositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  // ── Sandbox flow: faucet → open session (no on-chain tx!) ──

  const handleSandboxDeposit = useCallback(async () => {
    if (!address) {
      addToast({ type: 'error', title: 'Wallet not connected', message: 'Please connect your wallet first' });
      return;
    }
    if (parsedAmount === 0n) {
      addToast({ type: 'error', title: 'Invalid amount', message: 'Enter a valid deposit amount' });
      return;
    }

    setStep('faucet');
    setIsPending(true);

    try {
      // Open Yellow session — the hook handles faucet + auth + session creation
      // (faucet tokens are requested for the session key address, not the wallet)
      console.log('🚰 Starting sandbox session (faucet + auth handled by hooks)...');
      setStep('session');
      const session = await openSession(parsedAmount, challengeId);
      setSessionBalance(session.availableBalance);
      setStep('success');

      addToast({
        type: 'success',
        title: 'Session opened!',
        message: 'You can now make instant, gasless predictions',
      });

      setTimeout(() => {
        onClose();
        setStep('input');
        setDepositModalOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Sandbox deposit failed:', error);
      addToast({
        type: 'error',
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Please try again',
      });
      setStep('input');
    } finally {
      setIsPending(false);
    }
  }, [address, parsedAmount, challengeId, openSession, setSessionBalance, addToast, onClose, setDepositModalOpen]);

  // ── On-chain flow: approve → deposit → open session ──

  const handleApprove = useCallback(async () => {
    if (!address) {
      addToast({ type: 'error', title: 'Wallet not connected', message: 'Please connect your wallet first' });
      return;
    }
    if (!USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESS.length < 10) {
      addToast({ type: 'error', title: 'Config error', message: 'USDC token address not set' });
      return;
    }
    if (!PREDICTION_MARKET_ADDRESS || PREDICTION_MARKET_ADDRESS.length < 10) {
      addToast({ type: 'error', title: 'Config error', message: 'Prediction market address not set' });
      return;
    }
    if (parsedAmount === 0n) {
      addToast({ type: 'error', title: 'Invalid amount', message: 'Enter a valid deposit amount' });
      return;
    }

    if (chainId !== expectedChainId) {
      try {
        await switchChainAsync({ chainId: expectedChainId });
        addToast({ type: 'info', title: 'Switched to Sepolia', message: 'Please tap Deposit again.' });
      } catch {
        addToast({ type: 'error', title: 'Network switch failed', message: 'Please switch to Sepolia in MetaMask.' });
      }
      return;
    }

    console.log('🚀 Sending approve tx directly via MetaMask:', {
      token: USDC_TOKEN_ADDRESS,
      spender: PREDICTION_MARKET_ADDRESS,
      amount: parsedAmount.toString(),
    });

    setStep('approve');
    setIsPending(true);

    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PREDICTION_MARKET_ADDRESS, parsedAmount],
      });

      const txHash = await sendViaMetaMask({
        from: address,
        to: USDC_TOKEN_ADDRESS,
        data,
        gas: 100000n,
      });

      console.log('✅ Approve tx sent:', txHash);
      setApproveHash(txHash);
      setIsPending(false);
    } catch (error: any) {
      console.error('❌ Approve failed:', error);
      setIsPending(false);
      setStep('input');

      if (error?.code === 4001) {
        addToast({ type: 'error', title: 'Rejected', message: 'You rejected the transaction in MetaMask.' });
      } else {
        addToast({
          type: 'error',
          title: 'Approval failed',
          message: error?.message?.substring(0, 100) || 'Please try again',
        });
      }
    }
  }, [address, chainId, expectedChainId, parsedAmount, switchChainAsync, addToast]);

  const handleDeposit = useCallback(async () => {
    if (!address || !PREDICTION_MARKET_ADDRESS) return;

    if (chainId !== expectedChainId) {
      try {
        await switchChainAsync({ chainId: expectedChainId });
        addToast({ type: 'info', title: 'Switched to Sepolia', message: 'Please tap Deposit again.' });
      } catch {
        addToast({ type: 'error', title: 'Network switch failed', message: 'Switch to Sepolia in MetaMask.' });
      }
      return;
    }

    setStep('deposit');
    setIsPending(true);

    try {
      const channelId = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;

      console.log('🚀 Sending deposit tx directly via MetaMask:', {
        contract: PREDICTION_MARKET_ADDRESS,
        amount: parsedAmount.toString(),
        challengeId,
        channelId,
      });

      const data = encodeFunctionData({
        abi: DEPOSIT_ABI,
        functionName: 'deposit',
        args: [parsedAmount, challengeId, channelId],
      });

      const txHash = await sendViaMetaMask({
        from: address,
        to: PREDICTION_MARKET_ADDRESS,
        data,
        gas: 500000n,
      });

      console.log('✅ Deposit tx sent:', txHash);
      setDepositHash(txHash);
      setIsPending(false);
    } catch (error: any) {
      console.error('❌ Deposit failed:', error);
      setIsPending(false);
      setStep('input');

      if (error?.code === 4001) {
        addToast({ type: 'error', title: 'Rejected', message: 'You rejected the transaction in MetaMask.' });
      } else {
        addToast({
          type: 'error',
          title: 'Deposit failed',
          message: error?.message?.substring(0, 100) || 'Please try again',
        });
      }
    }
  }, [address, chainId, expectedChainId, parsedAmount, challengeId, switchChainAsync, addToast]);

  const handleOpenSession = useCallback(async () => {
    setStep('session');
    try {
      const session = await openSession(parsedAmount, challengeId);
      setSessionBalance(session.availableBalance);
      setStep('success');
      
      addToast({
        type: 'success',
        title: 'Session opened!',
        message: 'You can now make instant predictions',
      });

      setTimeout(() => {
        onClose();
        setStep('input');
        setDepositModalOpen(false);
      }, 2000);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Session failed',
        message: error instanceof Error ? error.message : 'Please try again',
      });
      setStep('input');
    }
  }, [parsedAmount, challengeId, openSession, setSessionBalance, addToast, onClose, setDepositModalOpen]);

  // Auto-progress: approval confirmed → deposit (on-chain flow only)
  useEffect(() => {
    if (approvalSuccess && step === 'approve') {
      console.log('✅ Approval confirmed, starting deposit...');
      const timer = setTimeout(() => handleDeposit(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [approvalSuccess, step, handleDeposit]);
  
  // Auto-progress: deposit confirmed → open session (on-chain flow only)
  useEffect(() => {
    if (depositSuccess && step === 'deposit') {
      console.log('✅ Deposit confirmed, opening session...');
      const timer = setTimeout(() => handleOpenSession(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [depositSuccess, step, handleOpenSession]);

  if (!isOpen) return null;

  const isLoading = isPending || isWaitingApproval || isWaitingDeposit;

  // Choose the right action button handler
  const handleMainAction = HAS_CLEARNODE
    ? handleSandboxDeposit  // Sandbox/live: faucet → session (no on-chain tx)
    : handleApprove;         // No clearnode: on-chain approve → deposit → session

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-md bg-reel-surface sm:rounded-2xl rounded-t-3xl overflow-hidden safe-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-reel-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {step === 'success' ? 'All Set!' : 'Start Session'}
                </h3>
                <p className="text-xs text-reel-muted">
                  {step === 'success' 
                    ? 'Start predicting now'
                    : HAS_CLEARNODE 
                      ? 'Instant setup via Yellow Network' 
                      : 'One-time on-chain deposit'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-reel-card transition-colors"
            >
              <X className="w-5 h-5 text-reel-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {step === 'success' ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-8 flex flex-col items-center"
              >
                <div className="w-20 h-20 rounded-full bg-reel-success/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-reel-success" />
                </div>
                <h4 className="font-display text-2xl font-semibold text-white">
                  Ready to Predict!
                </h4>
                <p className="text-reel-muted mt-2 text-center">
                  Your session is active. All predictions are now instant and gasless.
                </p>
                <div className="mt-6 flex items-center gap-2 text-reel-success">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {formatTokenAmount(parsedAmount, 6)} USDC available
                  </span>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Amount input */}
                <div className="mb-4">
                  <label className="block text-sm text-reel-muted mb-2">
                    Session Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    disabled={step !== 'input'}
                    className="w-full h-14 px-4 rounded-xl bg-reel-card border border-reel-border focus:border-reel-primary focus:ring-1 focus:ring-reel-primary/50 outline-none text-2xl font-mono text-white placeholder:text-reel-muted/50 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Preset amounts */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {presetAmounts.map((value) => (
                    <button
                      key={value}
                      onClick={() => setAmount(value.toString())}
                      disabled={step !== 'input'}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50',
                        parseFloat(amount) === value
                          ? 'bg-reel-primary text-white'
                          : 'bg-reel-card text-reel-muted hover:bg-reel-card/80 hover:text-white'
                      )}
                    >
                      {value} USDC
                    </button>
                  ))}
                </div>

                {/* Progress steps */}
                <div className="mb-6">
                  {HAS_CLEARNODE ? (
                    /* Sandbox/live flow: simpler steps */
                    <div className="flex items-center justify-between mb-4">
                      <StepIndicator
                        number={1}
                        label="Fund"
                        status={
                          step === 'input' ? 'pending' :
                          step === 'faucet' ? 'active' :
                          'completed'
                        }
                        isLoading={step === 'faucet' && isLoading}
                      />
                      <div className="flex-1 h-0.5 bg-reel-border mx-2">
                        <div 
                          className={cn(
                            'h-full bg-reel-primary transition-all',
                            step === 'input' || step === 'faucet' ? 'w-0' : 'w-full'
                          )}
                        />
                      </div>
                      <StepIndicator
                        number={2}
                        label="Session"
                        status={
                          step === 'session' ? 'active' :
                          step === 'success' ? 'completed' :
                          'pending'
                        }
                        isLoading={step === 'session'}
                      />
                    </div>
                  ) : (
                    /* On-chain fallback flow: 3 steps */
                    <div className="flex items-center justify-between mb-4">
                      <StepIndicator
                        number={1}
                        label="Approve"
                        status={
                          step === 'input' ? 'pending' :
                          step === 'approve' ? 'active' :
                          'completed'
                        }
                        isLoading={step === 'approve' && isLoading}
                      />
                      <div className="flex-1 h-0.5 bg-reel-border mx-2">
                        <div 
                          className={cn(
                            'h-full bg-reel-primary transition-all',
                            step === 'input' || step === 'approve' ? 'w-0' : 'w-full'
                          )}
                        />
                      </div>
                      <StepIndicator
                        number={2}
                        label="Deposit"
                        status={
                          step === 'input' || step === 'approve' ? 'pending' :
                          step === 'deposit' ? 'active' :
                          'completed'
                        }
                        isLoading={step === 'deposit' && isLoading}
                      />
                      <div className="flex-1 h-0.5 bg-reel-border mx-2">
                        <div 
                          className={cn(
                            'h-full bg-reel-primary transition-all',
                            step === 'session' || step === 'success' ? 'w-full' : 'w-0'
                          )}
                        />
                      </div>
                      <StepIndicator
                        number={3}
                        label="Connect"
                        status={
                          step === 'session' ? 'active' :
                          step === 'success' ? 'completed' :
                          'pending'
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="p-4 rounded-xl bg-reel-card/50 border border-reel-border mb-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-reel-secondary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        Powered by Yellow Network (ERC-7824)
                      </p>
                      <p className="text-xs text-reel-muted mt-1">
                        {HAS_CLEARNODE ? (
                          <>
                            Your session is powered by Yellow Network state channels. 
                            Predictions are instant and gasless — no blockchain confirmations needed. 
                            Funds are settled on-chain when your session ends.
                          </>
                        ) : (
                          <>
                            Deposit once → open a state channel session → make unlimited 
                            instant, gasless predictions off-chain → settle on-chain when done. 
                            Your funds are always protected by smart contracts.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <Button
                  onClick={step === 'input' ? handleMainAction : undefined}
                  disabled={step !== 'input' || parsedAmount === 0n}
                  isLoading={step !== 'input'}
                  className="w-full h-14 text-lg"
                >
                  {step === 'input' && (
                    <>
                      <span>{HAS_CLEARNODE ? 'Start Session' : 'Deposit & Start'}</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                  {step === 'faucet' && 'Getting tokens...'}
                  {step === 'approve' && 'Approving...'}
                  {step === 'deposit' && 'Depositing...'}
                  {step === 'session' && 'Opening Session...'}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StepIndicator({ 
  number, 
  label, 
  status,
  isLoading = false,
}: { 
  number: number; 
  label: string;
  status: 'pending' | 'active' | 'completed';
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
        status === 'pending' && 'bg-reel-card text-reel-muted',
        status === 'active' && 'bg-reel-primary text-white',
        status === 'completed' && 'bg-reel-success text-white',
      )}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'completed' ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          number
        )}
      </div>
      <span className={cn(
        'text-xs mt-1.5',
        status === 'active' ? 'text-white' : 'text-reel-muted'
      )}>
        {label}
      </span>
    </div>
  );
}
