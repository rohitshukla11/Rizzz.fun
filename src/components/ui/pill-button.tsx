'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'filled';
  children: React.ReactNode;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ variant = 'outline', className, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200',
          variant === 'filled'
            ? 'bg-[#F5FF00] text-black hover:bg-[#F5FF00]/90'
            : 'border border-[#F5FF00] text-[#F5FF00] bg-transparent hover:bg-[#F5FF00] hover:text-black',
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

PillButton.displayName = 'PillButton';
