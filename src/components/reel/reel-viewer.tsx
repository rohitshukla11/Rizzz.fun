'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Heart, MessageCircle, Share2, Coins, TrendingUp } from 'lucide-react';
import { cn, formatTokenAmount, truncateAddress, calculatePercentage, formatPercentage } from '@/lib/utils';
import { useAppStore, type Reel } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { ENSAvatar, ENSName } from '@/components/ens/ens-identity';

interface ReelViewerProps {
  reels: Reel[];
  initialIndex?: number;
  onPredictClick: (reel: Reel) => void;
}

export function ReelViewer({ reels, initialIndex = 0, onPredictClick }: ReelViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const { setCurrentReelIndex } = useAppStore();

  const currentReel = reels[currentIndex];
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [-100, 0, 100], [0.5, 1, 0.5]);

  // Calculate total pool for percentage
  const totalPool = reels.reduce((sum, reel) => sum + reel.predictionPool, 0n);
  const currentPercentage = calculatePercentage(currentReel?.predictionPool || 0n, totalPool);

  useEffect(() => {
    setCurrentReelIndex(currentIndex);
  }, [currentIndex, setCurrentReelIndex]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (offset < -threshold || velocity < -500) {
      // Swipe up - next reel
      if (currentIndex < reels.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } else if (offset > threshold || velocity > 500) {
      // Swipe down - previous reel
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  }, [currentIndex, reels.length]);

  const handleTap = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleDoubleTap = useCallback(() => {
    // Like animation could go here
  }, []);

  if (!currentReel) return null;

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full bg-black overflow-hidden"
      onClick={handleTap}
    >
      {/* Video container with swipe */}
      <motion.div
        className="absolute inset-0"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y: dragY, opacity }}
      >
        <video
          ref={videoRef}
          src={currentReel.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          autoPlay
          onClick={(e) => {
            e.stopPropagation();
            setIsPlaying(!isPlaying);
          }}
        />
      </motion.div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

      {/* Top bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 p-4 safe-top"
          >
            <div className="flex items-center justify-between">
              {/* Prediction pool indicator */}
              <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
                <Coins className="w-4 h-4 text-reel-primary" />
                <span className="text-sm font-mono text-white">
                  {formatTokenAmount(currentReel.predictionPool)}
                </span>
                <span className="text-xs text-reel-success font-medium">
                  {formatPercentage(currentPercentage)}
                </span>
              </div>

              {/* Volume toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="glass rounded-full p-2"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        {/* Creator avatar — ENS-powered */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <ENSAvatar address={currentReel.creatorAddress} size="md" className="ring-2 ring-reel-primary" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-reel-primary rounded-full flex items-center justify-center border-2 border-black">
            <span className="text-xs">+</span>
          </div>
        </motion.div>

        {/* Like */}
        <ActionButton
          icon={<Heart className="w-7 h-7" />}
          label={currentReel.votes.toLocaleString()}
          delay={0.3}
        />

        {/* Comment */}
        <ActionButton
          icon={<MessageCircle className="w-7 h-7" />}
          label="Chat"
          delay={0.4}
        />

        {/* Share */}
        <ActionButton
          icon={<Share2 className="w-7 h-7" />}
          label="Share"
          delay={0.5}
        />

        {/* Predict button */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPredictClick(currentReel);
            }}
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center glow-primary"
          >
            <TrendingUp className="w-7 h-7 text-white" />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/30"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </button>
          <p className="text-xs text-center mt-1.5 text-white font-medium">Predict</p>
        </motion.div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-20 p-4 pb-6 safe-bottom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Creator name — ENS-powered */}
          <p className="text-white font-semibold flex items-center gap-2">
            <ENSName
              address={currentReel.creatorAddress}
              withAvatar
              avatarSize="xs"
              className="text-white"
            />
          </p>

          {/* Title */}
          <p className="mt-2 text-white/90 text-sm line-clamp-2">
            {currentReel.title}
          </p>

          {/* Prediction bar */}
          <div className="mt-3">
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-reel-primary to-reel-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${currentPercentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Play/Pause indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe indicator */}
      <motion.div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-1 h-6 bg-white/30 rounded-full" />
        <span className="text-xs">Swipe</span>
      </motion.div>

      {/* Reel progress indicators */}
      <div className="absolute left-1/2 -translate-x-1/2 top-16 flex gap-1">
        {reels.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, i) => {
          const actualIndex = Math.max(0, currentIndex - 2) + i;
          return (
            <div
              key={actualIndex}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                actualIndex === currentIndex
                  ? 'w-6 bg-white'
                  : 'w-1 bg-white/40'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({ 
  icon, 
  label, 
  delay,
  active = false,
}: { 
  icon: React.ReactNode; 
  label: string;
  delay: number;
  active?: boolean;
}) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay }}
      className="flex flex-col items-center"
    >
      <button className={cn(
        'p-1 transition-colors',
        active ? 'text-reel-primary' : 'text-white'
      )}>
        {icon}
      </button>
      <span className="text-xs text-white/80 mt-0.5">{label}</span>
    </motion.div>
  );
}
