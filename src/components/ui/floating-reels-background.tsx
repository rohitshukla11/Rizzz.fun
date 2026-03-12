'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

interface FloatingReel {
  id: number;
  x: number;
  duration: number;
  delay: number;
  rotation: number;
  hasGlow: boolean;
  hasLikeCount: boolean;
  likeCount: string;
}

export function FloatingReelsBackground() {
  const [reels, setReels] = useState<FloatingReel[]>([]);

  useEffect(() => {
    // Generate initial set of reels
    const generateReel = (id: number): FloatingReel => ({
      id,
      x: Math.random() * 100, // Random x position (0-100%)
      duration: 10 + Math.random() * 8, // 10-18 seconds
      delay: Math.random() * -18, // Stagger spawn times (-18s to 0s)
      rotation: (Math.random() - 0.5) * 16, // -8deg to +8deg
      hasGlow: Math.random() > 0.7, // 30% chance of glow
      hasLikeCount: Math.random() > 0.6, // 40% chance of like count
      likeCount: `${(Math.random() * 5 + 0.5).toFixed(1)}M`,
    });

    // Create initial 16 reels
    const initialReels = Array.from({ length: 16 }, (_, i) => generateReel(i));
    setReels(initialReels);

    // Spawn new reels every 1.5 seconds
    const interval = setInterval(() => {
      setReels((prev) => {
        // Remove oldest reel and add new one
        const newId = prev.length > 0 ? Math.max(...prev.map((r) => r.id)) + 1 : 16;
        const newReel = generateReel(newId);
        return [...prev.slice(1), newReel];
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        {/* Floating reels */}
        {reels.map((reel) => (
          <div
            key={reel.id}
            className="absolute"
            style={{
              left: `${reel.x}%`,
              width: '90px',
              height: '160px',
              bottom: '-160px',
              animation: `floatUp ${reel.duration}s linear ${reel.delay}s infinite`,
              transform: `rotate(${reel.rotation}deg)`,
            }}
          >
            <div
              className="w-full h-full rounded-[10px] border backdrop-blur-[1px] flex flex-col items-center justify-center relative"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(245, 255, 0, 0.25)',
                borderWidth: '1px',
                boxShadow: reel.hasGlow
                  ? '0 0 30px rgba(245,255,0,0.3)'
                  : 'none',
                animation: `sway ${reel.duration}s ease-in-out ${reel.delay}s infinite`,
              }}
            >
              {/* Play button icon */}
              <Play className="w-6 h-6 text-[#F5FF00]/60 fill-[#F5FF00]/60" />
              
              {/* Like count */}
              {reel.hasLikeCount && (
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="font-mono text-[8px] text-[#F5FF00]/70">
                    🔥 {reel.likeCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Radial gradient overlay - on top of reels to fade center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30,24,0,0.0) 0%, rgba(8,8,8,0.7) 70%)',
          }}
        />
      </div>
  );
}
