'use client';

import React from 'react';
import { Sun, Zap, Battery, Cpu, Car, Wind } from 'lucide-react';

type BadgeProps = {
  icon: React.ReactNode;
  label: string;
  delay: number;
  initialX: string | number;
  initialY: string | number;
  floatY: number;
};

function FloatingBadge({ icon, label, delay, initialX, initialY, floatY }: BadgeProps) {
  return (
    <div
      className="absolute flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm floating-badge"
      style={{
        left: initialX,
        top: initialY,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.6)',
        color: '#475569', // slate-600
        '--float-y': `${typeof floatY === 'number' ? -floatY : -15}px`,
        animation: `float-badge 4s infinite ease-in-out ${delay}s`,
        willChange: 'transform, opacity' // Optimize animation rendering
      } as React.CSSProperties}
    >
      <div className="text-indigo-600">{icon}</div>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

const FloatingBadges = React.memo(function FloatingBadges() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 hidden md:block">
      <FloatingBadge 
        icon={<Sun size={14} />} 
        label="Solar Energy" 
        initialX="15%" 
        initialY="25%" 
        floatY={-30} 
        delay={0} 
      />
      <FloatingBadge 
        icon={<Zap size={14} />} 
        label="Smart Grid" 
        initialX="80%" 
        initialY="20%" 
        floatY={40} 
        delay={2} 
      />
      <FloatingBadge 
        icon={<Battery size={14} />} 
        label="Energy Storage" 
        initialX="10%" 
        initialY="70%" 
        floatY={-25} 
        delay={4} 
      />
      <FloatingBadge 
        icon={<Cpu size={14} />} 
        label="AI Optimization" 
        initialX="85%" 
        initialY="65%" 
        floatY={30} 
        delay={1} 
      />
      <FloatingBadge 
        icon={<Car size={14} />} 
        label="EV Infrastructure" 
        initialX="25%" 
        initialY="85%" 
        floatY={-20} 
        delay={5} 
      />
      <FloatingBadge 
        icon={<Wind size={14} />} 
        label="Clean Tech" 
        initialX="75%" 
        initialY="85%" 
        floatY={25} 
        delay={3} 
      />
    </div>
  );
});

export default FloatingBadges;
