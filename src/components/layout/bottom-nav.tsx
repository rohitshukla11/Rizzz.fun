'use client';

import { motion } from 'framer-motion';
import { Home, Search, PlusCircle, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Search, label: 'Explore' },
  { href: '/create', icon: PlusCircle, label: 'Create', special: true },
  { href: '/leaderboard', icon: Trophy, label: 'Ranks' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="glass-strong">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 h-full',
                  item.special && 'flex-none px-4',
                )}
              >
                {item.special ? (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-reel-primary to-reel-accent flex items-center justify-center -mt-5 shadow-xl glow-primary"
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        y: isActive ? -2 : 0,
                      }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 transition-colors',
                          isActive ? 'text-reel-primary' : 'text-reel-muted',
                        )}
                      />
                    </motion.div>
                    <span
                      className={cn(
                        'text-[10px] mt-1 transition-colors',
                        isActive ? 'text-reel-primary font-semibold' : 'text-reel-muted',
                      )}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavIndicator"
                        className="absolute -top-[1px] w-10 h-[2px] bg-gradient-to-r from-reel-primary to-reel-accent rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
