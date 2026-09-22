import React from 'react';
import { LucideIcon, Wrench } from 'lucide-react';

export interface WipWidgetProps {
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  className?: string;
}

export default function WipWidget({
  size = 'md',
  icon: Icon = Wrench,
  className = '',
}: WipWidgetProps) {
  const isSmall = size === 'sm';

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center min-h-0 text-center select-none pointer-events-none ${
        isSmall ? 'py-1 gap-1' : 'py-6 gap-2 sm:gap-2.5'
      } ${className}`}
      aria-label="Work in progress"
    >
      <span
        className={`font-black uppercase text-slate-300/80 select-none ${
          isSmall
            ? 'text-[10px] tracking-widest leading-none'
            : 'text-xs sm:text-sm tracking-[0.2em] leading-normal'
        }`}
      >
        WORK IN PROGRESS
      </span>
      <Icon
        size={isSmall ? 12 : 20}
        className="text-slate-300/70 shrink-0"
        aria-hidden="true"
      />
    </div>
  );
}
