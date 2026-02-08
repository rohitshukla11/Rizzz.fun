'use client';

/**
 * Prediction Passport — Creative DeFi ENS Integration
 *
 * Stores prediction preferences as ENS text records, making them
 * portable across ANY prediction market that reads ENS data.
 *
 * Text record keys:
 *   com.rizzz.strategy    — investment strategy
 *   com.rizzz.riskLevel   — 1–10 risk tolerance
 *   com.rizzz.maxBet      — max bet per prediction (USDC)
 *   com.rizzz.categories  — preferred categories
 *   com.rizzz.autoTip     — auto-tip % for creators
 *   com.rizzz.bio         — prediction profile bio
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Flame, Target, TrendingUp, Coins,
  Edit3, Save, X, ExternalLink, Loader2, Check,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import {
  useENSIdentity,
  useENSPredictionPassport,
  useENSSocialProfile,
  ENS_KEYS,
  writeENSTextRecord,
  getStrategyDisplay,
  getRiskDisplay,
  getENSTransactionLink,
  getENSExplorerLink,
  getENSTextRecordLink,
} from '@/lib/ens';
import { ENSAvatar } from '@/components/ens/ens-identity';
import { cn } from '@/lib/utils';

// ── Strategies ──
const STRATEGIES = [
  { value: 'conservative', label: 'Conservative', emoji: '🛡️', desc: 'Small, safe bets' },
  { value: 'moderate', label: 'Moderate', emoji: '⚖️', desc: 'Balanced risk/reward' },
  { value: 'aggressive', label: 'Aggressive', emoji: '🔥', desc: 'Higher stakes' },
  { value: 'degen', label: 'Full Degen', emoji: '💎', desc: 'Moon or bust' },
];

const CATEGORIES = [
  'Dance', 'Comedy', 'Music', 'Cooking', 'Sports',
  'Art', 'Fashion', 'Tech', 'Gaming', 'Pets',
];

// ── PredictionPassportCard (read-only, for viewing any user's passport) ──

interface PassportCardProps {
  address?: string;
  className?: string;
}

export function PredictionPassportCard({ address, className }: PassportCardProps) {
  const { name, isLoading: identityLoading } = useENSIdentity(address);
  const passport = useENSPredictionPassport(name);
  const social = useENSSocialProfile(name);

  if (identityLoading || passport.isLoading) {
    return (
      <div className={cn('border-3 border-black bg-white p-6 shadow-brutal', className)}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!name) {
    return (
      <div className={cn('border-3 border-black bg-white p-6 shadow-brutal', className)}>
        <div className="text-center py-4">
          <p className="text-2xl mb-2">🏷️</p>
          <p className="font-bold text-black text-sm uppercase">No ENS Name</p>
          <p className="text-xs text-gray-500 mt-1">
            Get an ENS name to create your Prediction Passport
          </p>
          <a
            href="https://app.ens.domains"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 border-2 border-black bg-reel-secondary text-black text-xs font-bold shadow-brutal-sm hover:shadow-brutal transition-shadow"
          >
            Get ENS Name <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  const strategy = getStrategyDisplay(passport.strategy);
  const risk = getRiskDisplay(passport.riskLevel);
  const categories = passport.categories?.split(',').filter(Boolean) || [];

  return (
    <div className={cn('border-3 border-black bg-white shadow-brutal overflow-hidden', className)}>
      {/* Header — passport style */}
      <div className="bg-reel-primary px-4 py-3 border-b-3 border-black">
        <div className="flex items-center gap-3">
          <ENSAvatar address={address} size="md" />
          <div>
            <p className="font-bold text-white text-sm">{name}</p>
            {passport.bio && (
              <p className="text-white/80 text-xs">{passport.bio}</p>
            )}
          </div>
          <div className="ml-auto">
            <div className="border-2 border-white/30 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Prediction Passport
            </div>
          </div>
        </div>
      </div>

      {/* On-chain verification badge */}
      {passport.hasPassport && (
        <div className="px-4 py-2 bg-green-50 border-b-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-800">ON-CHAIN DATA</span>
          </div>
          <a
            href={getENSExplorerLink(name)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Verify <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Fields */}
      <div className="p-4 space-y-3">
        {/* Strategy */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase">Strategy</span>
          <span className="text-sm font-bold flex items-center gap-1">
            {strategy.emoji} {strategy.label}
          </span>
        </div>

        {/* Risk Level */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-500 uppercase">Risk Level</span>
            <span className={cn('text-sm font-bold', risk.color)}>{risk.label}</span>
          </div>
          <div className="h-2 bg-gray-200 border border-black">
            <div
              className="h-full bg-reel-secondary transition-all"
              style={{ width: `${risk.width}%` }}
            />
          </div>
        </div>

        {/* Max Bet */}
        {passport.maxBet && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Max Bet</span>
            <span className="text-sm font-bold font-mono">{passport.maxBet} USDC</span>
          </div>
        )}

        {/* Auto-Tip */}
        {passport.autoTip && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Creator Tip</span>
            <span className="text-sm font-bold">{passport.autoTip}%</span>
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
              Preferred Categories
            </span>
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 border-2 border-black bg-reel-secondary/30 text-xs font-bold"
                >
                  {cat.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Social links */}
        {(social.twitter || social.github) && (
          <div className="flex gap-2 pt-2 border-t-2 border-gray-200">
            {social.twitter && (
              <a
                href={`https://twitter.com/${social.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 border-2 border-black text-xs font-bold hover:bg-reel-secondary/30 transition-colors"
              >
                𝕏 @{social.twitter}
              </a>
            )}
            {social.github && (
              <a
                href={`https://github.com/${social.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 border-2 border-black text-xs font-bold hover:bg-reel-secondary/30 transition-colors"
              >
                🐙 {social.github}
              </a>
            )}
          </div>
        )}

        {/* On-chain verification link */}
        {passport.hasPassport && name && (
          <div className="pt-3 border-t-2 border-gray-200">
            <a
              href={getENSExplorerLink(name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-3 h-3" />
              Verify on-chain data on ENS Explorer
            </a>
          </div>
        )}

        {!passport.hasPassport && (
          <p className="text-xs text-gray-400 text-center pt-2">
            No prediction preferences set yet
          </p>
        )}
      </div>
    </div>
  );
}


// ── PredictionPassportEditor (for the connected user to write their passport) ──

interface PassportEditorProps {
  className?: string;
}

export function PredictionPassportEditor({ className }: PassportEditorProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { name } = useENSIdentity(address);
  const passport = useENSPredictionPassport(name);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactionHashes, setTransactionHashes] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Edit form state
  const [strategy, setStrategy] = useState(passport.strategy || '');
  const [riskLevel, setRiskLevel] = useState(passport.riskLevel || '5');
  const [maxBet, setMaxBet] = useState(passport.maxBet || '');
  const [autoTip, setAutoTip] = useState(passport.autoTip || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    passport.categories?.split(',').filter(Boolean) || []
  );
  const [bio, setBio] = useState(passport.bio || '');

  // Reset form when passport data loads
  const startEditing = useCallback(() => {
    setStrategy(passport.strategy || '');
    setRiskLevel(passport.riskLevel || '5');
    setMaxBet(passport.maxBet || '');
    setAutoTip(passport.autoTip || '');
    setSelectedCategories(passport.categories?.split(',').filter(Boolean) || []);
    setBio(passport.bio || '');
    setIsEditing(true);
    setError(null);
  }, [passport]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    );
  };

  // Save a single field to ENS
  const saveField = async (key: string, value: string) => {
    if (!name || !address) return;
    setIsSaving(true);
    setSavedKey(key);
    setError(null);

    try {
      await writeENSTextRecord(name, key, value, address);
      setSavedKey(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSavedKey(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Save all fields
  const saveAll = async () => {
    if (!name || !address) return;
    setIsSaving(true);
    setError(null);
    const newTxHashes: Record<string, string> = {};

    try {
      const writes = [
        { key: ENS_KEYS.STRATEGY, value: strategy },
        { key: ENS_KEYS.RISK_LEVEL, value: riskLevel },
        { key: ENS_KEYS.MAX_BET, value: maxBet },
        { key: ENS_KEYS.AUTO_TIP, value: autoTip },
        { key: ENS_KEYS.CATEGORIES, value: selectedCategories.join(',') },
        { key: ENS_KEYS.BIO, value: bio },
      ].filter((w) => w.value);

      for (const w of writes) {
        setSavedKey(w.key);
        // Use current chain ID (Sepolia if on Sepolia, mainnet otherwise)
        const txHash = await writeENSTextRecord(name, w.key, w.value, address, chainId);
        newTxHashes[w.key] = txHash;
        setTransactionHashes((prev) => ({ ...prev, [w.key]: txHash }));
      }

      setTransactionHashes(newTxHashes);
      setSavedKey(null);
      setShowSuccess(true);
      setIsEditing(false);
      
      // Refresh passport data after a short delay (wait for block confirmation)
      setTimeout(() => {
        window.location.reload(); // Simple refresh to reload ENS data
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      console.error('Error saving to ENS:', err);
    } finally {
      setIsSaving(false);
      setSavedKey(null);
    }
  };

  if (!name) {
    return (
      <div className={cn('border-3 border-black bg-white p-6 shadow-brutal', className)}>
        <div className="text-center py-4">
          <p className="text-3xl mb-2">🛂</p>
          <h3 className="font-bold text-black text-lg uppercase">Prediction Passport</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            Store your prediction preferences on ENS — portable across all prediction markets.
          </p>
          <a
            href="https://app.ens.domains"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-4 px-4 py-2 border-2 border-black bg-reel-secondary text-black text-sm font-bold shadow-brutal-sm hover:shadow-brutal transition-shadow"
          >
            Get ENS Name First <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-black text-sm uppercase flex items-center gap-2">
            🛂 Prediction Passport
          </h3>
          <button
            onClick={startEditing}
            className="flex items-center gap-1 px-3 py-1 border-2 border-black text-xs font-bold hover:bg-reel-secondary/30 transition-colors shadow-brutal-sm"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
        </div>
        <PredictionPassportCard address={address} />
      </div>
    );
  }

  // ── Edit Mode ──
  return (
    <div className={cn('border-3 border-black bg-white shadow-brutal', className)}>
      <div className="bg-reel-primary px-4 py-3 border-b-3 border-black flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ENSAvatar address={address} size="sm" />
          <div>
            <p className="font-bold text-white text-sm">{name}</p>
            <p className="text-white/70 text-[10px] uppercase">Editing Passport</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="p-1.5 border-2 border-white/30 text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Strategy selector */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Prediction Strategy
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStrategy(s.value)}
                className={cn(
                  'p-3 border-2 border-black text-left transition-all',
                  strategy === s.value
                    ? 'bg-reel-secondary shadow-brutal-sm'
                    : 'bg-white hover:bg-gray-50',
                )}
              >
                <span className="text-lg">{s.emoji}</span>
                <p className="font-bold text-xs mt-1">{s.label}</p>
                <p className="text-[10px] text-gray-500">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Risk Level */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Risk Level: {riskLevel}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className="w-full accent-reel-secondary"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-bold">
            <span>SAFE</span>
            <span>DEGEN</span>
          </div>
        </div>

        {/* Max Bet */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Max Bet (USDC)
          </label>
          <input
            type="text"
            value={maxBet}
            onChange={(e) => setMaxBet(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="e.g. 100"
            className="w-full h-10 px-3 border-2 border-black font-mono text-sm focus:outline-none focus:shadow-brutal-sm"
          />
        </div>

        {/* Auto Tip */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Auto-Tip to Creators: {autoTip || 0}%
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={autoTip || '0'}
            onChange={(e) => setAutoTip(e.target.value)}
            className="w-full accent-reel-secondary"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Preferred Categories
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  'px-2.5 py-1 border-2 border-black text-xs font-bold transition-all',
                  selectedCategories.includes(cat)
                    ? 'bg-reel-secondary shadow-brutal-sm'
                    : 'bg-white hover:bg-gray-50',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Prediction market veteran, dance challenge specialist..."
            maxLength={140}
            rows={2}
            className="w-full px-3 py-2 border-2 border-black font-mono text-sm resize-none focus:outline-none focus:shadow-brutal-sm"
          />
          <p className="text-[10px] text-gray-400 text-right">{bio.length}/140</p>
        </div>

        {/* Success message with transaction links */}
        {showSuccess && Object.keys(transactionHashes).length > 0 && (
          <div className="p-4 border-3 border-green-500 bg-green-50">
            <p className="text-sm font-bold text-green-800 mb-2">
              ✅ Successfully saved to ENS on-chain!
            </p>
            <div className="space-y-1.5">
              {Object.entries(transactionHashes).map(([key, txHash]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-green-700">{key}:</span>
                  <a
                    href={getENSTransactionLink(txHash, chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-mono"
                  >
                    View TX {txHash.slice(0, 10)}... ({chainId === 11155111 ? 'Sepolia' : 'Mainnet'})
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t-2 border-green-300">
              <a
                href={getENSExplorerLink(name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-green-800 hover:text-green-900"
              >
                <ExternalLink className="w-3 h-3" />
                View all records on ENS Explorer
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-2 border-2 border-red-500 bg-red-50 text-red-600 text-xs font-bold">
            {error}
          </div>
        )}

        {/* Save All */}
        <button
          onClick={saveAll}
          disabled={isSaving}
          className={cn(
            'w-full py-3 border-3 border-black font-bold text-sm uppercase flex items-center justify-center gap-2 transition-all',
            isSaving
              ? 'bg-gray-200 text-gray-500'
              : 'bg-reel-secondary text-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg',
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving {savedKey ? `(${savedKey})` : ''}...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save to ENS
            </>
          )}
        </button>

        <div className="p-3 border-2 border-black bg-yellow-50">
          <p className="text-[10px] font-bold text-black mb-1">
            ⚠️ REAL ON-CHAIN STORAGE
          </p>
          <p className="text-[10px] text-gray-700">
            This writes <strong>real data</strong> to ENS Public Resolver on{' '}
            <strong>{chainId === 11155111 ? 'Sepolia Testnet' : 'Ethereum Mainnet'}</strong>.
            <br />
            Each field requires a gas fee ({chainId === 11155111 ? 'Sepolia ETH (free from faucet)' : '~$2-5 per transaction'}).
            <br />
            Data is permanently stored and can be verified on{' '}
            <a
              href={chainId === 11155111 
                ? `https://sepolia.etherscan.io/address/0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63`
                : 'https://etherscan.io/address/0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63'}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold"
            >
              {chainId === 11155111 ? 'Sepolia Etherscan' : 'Etherscan'}
            </a>
            {' '}or{' '}
            <a
              href={name ? getENSExplorerLink(name) : 'https://app.ens.domains'}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold"
            >
              ENS Explorer
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
