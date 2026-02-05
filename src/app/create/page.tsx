'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Video, Sparkles, Check, AlertCircle, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Mock active challenges
const activeChallenges = [
  { id: 'challenge_001', title: 'Best Dance Move Challenge', deadline: 'Ends in 5 days' },
  { id: 'challenge_002', title: 'Cooking Hacks That Work', deadline: 'Ends in 3 days' },
  { id: 'challenge_005', title: 'Workout Motivation', deadline: 'Ends in 4 days' },
];

export default function CreatePage() {
  const [step, setStep] = useState<'select' | 'upload' | 'details' | 'success'>('select');
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { isConnected } = useAccount();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
      setStep('details');
    }
  };

  const handleSubmit = async () => {
    setIsUploading(true);
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsUploading(false);
    setStep('success');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-reel-bg pb-20 flex flex-col">
        <header className="sticky top-0 z-30 glass-strong safe-top">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="font-display text-xl font-bold text-white">Create</h1>
            <ConnectButton />
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-reel-card mx-auto mb-4 flex items-center justify-center">
              <Video className="w-10 h-10 text-reel-muted" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Join the Competition
            </h2>
            <p className="text-reel-muted mb-6 max-w-xs">
              Connect your wallet to upload reels and compete in challenges.
            </p>
            <ConnectButton />
          </motion.div>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-reel-bg pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {step !== 'select' && step !== 'success' && (
              <button
                onClick={() => setStep(step === 'details' ? 'upload' : 'select')}
                className="p-2 -ml-2 rounded-lg hover:bg-reel-surface transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <h1 className="font-display text-xl font-bold text-white">
              {step === 'select' ? 'Select Challenge' :
               step === 'upload' ? 'Upload Reel' :
               step === 'details' ? 'Add Details' :
               'Success!'}
            </h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Step 1: Select Challenge */}
        {step === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-reel-muted mb-4">
              Choose a challenge to submit your reel
            </p>
            <div className="space-y-3">
              {activeChallenges.map((challenge, index) => (
                <motion.button
                  key={challenge.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedChallenge(challenge.id);
                    setStep('upload');
                  }}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all',
                    selectedChallenge === challenge.id
                      ? 'bg-reel-primary/10 border-reel-primary'
                      : 'bg-reel-card border-reel-border hover:border-reel-primary/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{challenge.title}</p>
                      <p className="text-sm text-reel-muted">{challenge.deadline}</p>
                    </div>
                    {selectedChallenge === challenge.id && (
                      <Check className="w-5 h-5 text-reel-primary" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Upload Video */}
        {step === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <label className="w-full max-w-sm aspect-[9/16] rounded-2xl border-2 border-dashed border-reel-border bg-reel-card hover:border-reel-primary hover:bg-reel-card/80 transition-all cursor-pointer flex flex-col items-center justify-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-reel-muted mb-4" />
              <p className="text-white font-medium">Tap to upload</p>
              <p className="text-sm text-reel-muted mt-1">MP4, WebM up to 100MB</p>
              <p className="text-xs text-reel-muted mt-4 px-4 text-center">
                Vertical videos (9:16) work best
              </p>
            </label>
          </motion.div>
        )}

        {/* Step 3: Add Details */}
        {step === 'details' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Video preview */}
            <div className="relative w-full max-w-xs mx-auto aspect-[9/16] rounded-2xl overflow-hidden mb-6">
              {videoPreview && (
                <video
                  src={videoPreview}
                  className="absolute inset-0 w-full h-full object-cover"
                  loop
                  muted
                  autoPlay
                  playsInline
                />
              )}
              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoPreview(null);
                  setStep('upload');
                }}
                className="absolute top-3 right-3 p-2 rounded-full glass"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Title input */}
            <div className="mb-6">
              <label className="block text-sm text-reel-muted mb-2">
                Reel Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your reel a catchy title..."
                className="w-full h-12 px-4 rounded-xl bg-reel-card border border-reel-border focus:border-reel-primary outline-none text-white placeholder:text-reel-muted transition-colors"
                maxLength={100}
              />
              <p className="text-xs text-reel-muted text-right mt-1">
                {title.length}/100
              </p>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isUploading}
              isLoading={isUploading}
              className="w-full h-14 text-lg"
            >
              <Sparkles className="w-5 h-5" />
              {isUploading ? 'Uploading...' : 'Submit Reel'}
            </Button>

            <p className="text-center text-xs text-reel-muted mt-4">
              By submitting, you agree to the challenge rules
            </p>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center pt-12"
          >
            <div className="w-20 h-20 rounded-full bg-reel-success/20 flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-reel-success" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Reel Submitted!
            </h2>
            <p className="text-reel-muted text-center max-w-xs mb-8">
              Your reel is now live in the challenge. Good luck!
            </p>
            <div className="flex gap-3">
              <Link href={`/challenge/${selectedChallenge}`} className="inline-block">
                <Button variant="default">
                  View Challenge
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('select');
                  setSelectedChallenge(null);
                  setVideoFile(null);
                  setVideoPreview(null);
                  setTitle('');
                }}
              >
                Upload Another
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
