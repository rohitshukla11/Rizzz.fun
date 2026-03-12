'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabGroup({ tabs, activeTab, onTabChange, className }: TabGroupProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide relative', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all',
              isActive
                ? 'bg-[#F5FF00] text-black'
                : 'bg-transparent text-reel-muted hover:text-white'
            )}
          >
            {tab.icon}
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}
