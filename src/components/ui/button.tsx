'use client';

import { forwardRef, useState, useEffect, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5FF00] focus-visible:ring-offset-2 focus-visible:ring-offset-reel-bg disabled:pointer-events-none disabled:opacity-50 btn-haptic',
  {
    variants: {
      variant: {
        default:
          'bg-[#F5FF00] text-black hover:bg-[#F5FF00]/90 focus-visible:ring-[#F5FF00]',
        secondary:
          'bg-[#FF4D4D] text-white hover:bg-[#FF4D4D]/90 focus-visible:ring-[#FF4D4D]',
        accent:
          'bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 focus-visible:ring-[#00E5FF]',
        success:
          'bg-[#00ff88] text-black hover:bg-[#00ff88]/90 focus-visible:ring-[#00ff88]',
        outline:
          'border-2 border-[#F5FF00] bg-transparent hover:bg-[#F5FF00] hover:text-black text-[#F5FF00]',
        ghost:
          'bg-transparent hover:bg-reel-surface text-reel-text',
        glass:
          'glass text-white hover:bg-white/10',
      },
      size: {
        default: 'h-12 px-6 text-base rounded-xl',
        sm: 'h-9 px-4 text-sm rounded-lg',
        lg: 'h-14 px-8 text-lg rounded-2xl',
        xl: 'h-16 px-10 text-xl rounded-2xl',
        icon: 'h-12 w-12 rounded-xl',
        'icon-sm': 'h-9 w-9 rounded-lg',
        'icon-lg': 'h-14 w-14 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const buttonProps = {
      ref,
      className: cn(buttonVariants({ variant, size, className })),
      disabled: disabled || isLoading,
      ...props,
    };

    const content = isLoading ? (
      <>
        <span className="animate-spin">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
        <span>Loading...</span>
      </>
    ) : (
      children
    );

    // Use regular button during SSR to prevent hydration issues
    if (!mounted) {
      return (
        <button {...buttonProps}>
          {content}
        </button>
      );
    }

    // Use motion.button on client for animations
    return (
      <motion.button
        {...(buttonProps as any)}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
      >
        {content}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
