'use client';

import { motion } from 'framer-motion';
import { Home, Search, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Search, label: 'Explore' },
  { href: '/leaderboard', icon: Trophy, label: 'Ranks' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-40 safe-bottom pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="glass rounded-full px-2 py-2">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-col items-center justify-center flex-1 h-12"
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-colors mb-0.5',
                        isActive ? 'text-[#F5FF00]' : 'text-reel-muted'
                      )}
                    />
                  </motion.div>
                  <span
                    className={cn(
                      'text-[10px] transition-colors',
                      isActive ? 'text-[#F5FF00] font-semibold' : 'text-reel-muted'
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#F5FF00] rounded-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
