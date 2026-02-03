'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, ArrowRight, Shield, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useYellowSession } from '@/lib/yellow';
import { useAppStore } from '@/store/app-store';
import { cn, formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

// Contract addresses (would come from env in production)
const REEL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_REEL_TOKEN_ADDRESS as `0x${string}`;
const REEL_PREDICT_ADDRESS = process.env.NEXT_PUBLIC_REEL_PREDICT_ADDRESS as `0x${string}`;

// Simple ERC20 ABI for approval
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ReelPredict deposit ABI
const DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
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

type Step = 'input' | 'approve' | 'deposit' | 'session' | 'success';

const presetAmounts = [100, 250, 500, 1000];

export function DepositModal({ isOpen, onClose, challengeId }: DepositModalProps) {
  const [amount, setAmount] = useState('100');
  const [step, setStep] = useState<Step>('input');
  
  const { address } = useAccount();
  const { openSession } = useYellowSession();
  const { setSessionBalance, setDepositModalOpen } = useAppStore();
  const { addToast } = useToast();

  const parsedAmount = amount ? parseTokenAmount(amount) : 0n;

  // Approval transaction
  const { 
    writeContract: writeApprove, 
    data: approveHash,
    isPending: isApproving 
  } = useWriteContract();

  const { isLoading: isWaitingApproval, isSuccess: approvalSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Deposit transaction
  const { 
    writeContract: writeDeposit, 
    data: depositHash,
    isPending: isDepositing 
  } = useWriteContract();

  const { isLoading: isWaitingDeposit, isSuccess: depositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const handleApprove = useCallback(async () => {
    if (!address || !REEL_TOKEN_ADDRESS || !REEL_PREDICT_ADDRESS) return;
    
    setStep('approve');
    try {
      writeApprove({
        address: REEL_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [REEL_PREDICT_ADDRESS, parsedAmount],
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Approval failed',
        message: error instanceof Error ? error.message : 'Please try again',
      });
      setStep('input');
    }
  }, [address, parsedAmount, writeApprove, addToast]);

  const handleDeposit = useCallback(async () => {
    if (!address || !REEL_PREDICT_ADDRESS) return;
    
    setStep('deposit');
    const channelId = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
    
    try {
      writeDeposit({
        address: REEL_PREDICT_ADDRESS,
        abi: DEPOSIT_ABI,
        functionName: 'deposit',
        args: [parsedAmount, challengeId, channelId],
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Deposit failed',
        message: error instanceof Error ? error.message : 'Please try again',
      });
      setStep('input');
    }
  }, [address, parsedAmount, challengeId, writeDeposit, addToast]);

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

  // Auto-progress through steps
  if (approvalSuccess && step === 'approve') {
    handleDeposit();
  }
  
  if (depositSuccess && step === 'deposit') {
    handleOpenSession();
  }

  if (!isOpen) return null;

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
                  {step === 'success' ? 'All Set!' : 'Deposit & Join'}
                </h3>
                <p className="text-xs text-reel-muted">
                  {step === 'success' 
                    ? 'Start predicting now'
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
                    {formatTokenAmount(parsedAmount)} REEL available
                  </span>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Amount input */}
                <div className="mb-4">
                  <label className="block text-sm text-reel-muted mb-2">
                    Deposit Amount
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
                      {value} REEL
                    </button>
                  ))}
                </div>

                {/* Progress steps */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <StepIndicator
                      number={1}
                      label="Approve"
                      status={
                        step === 'input' ? 'pending' :
                        step === 'approve' ? 'active' :
                        'completed'
                      }
                      isLoading={isApproving || isWaitingApproval}
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
                      isLoading={isDepositing || isWaitingDeposit}
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
                </div>

                {/* Info box */}
                <div className="p-4 rounded-xl bg-reel-card/50 border border-reel-border mb-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-reel-secondary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        How it works
                      </p>
                      <p className="text-xs text-reel-muted mt-1">
                        Deposit once to open a Yellow Network session. 
                        Then make unlimited instant predictions without gas fees. 
                        Withdraw anytime after the challenge ends.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <Button
                  onClick={step === 'input' ? handleApprove : undefined}
                  disabled={step !== 'input' || parsedAmount === 0n}
                  isLoading={step !== 'input'}
                  className="w-full h-14 text-lg"
                >
                  {step === 'input' && (
                    <>
                      <span>Deposit & Start</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
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
