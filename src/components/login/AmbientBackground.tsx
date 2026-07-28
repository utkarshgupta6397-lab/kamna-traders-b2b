'use client';

import React from 'react';

const AmbientBackground = React.memo(function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#FAF7F5]">
      {/* We apply a single static blur layer on top of the moving elements to get the effect without forcing the browser to recalculate heavy CSS filters on every frame. */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Soft animated gradient blobs - using solid soft colors instead of mix-blend/blur on the moving elements themselves */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full opacity-60 ambient-blob"
          style={{ 
            background: 'radial-gradient(circle, #FFD4C2 0%, transparent 70%)', top: '-20%', left: '-10%',
            animation: 'blob-float-1 25s infinite linear',
            willChange: 'transform'
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-70 ambient-blob"
          style={{ 
            background: 'radial-gradient(circle, #FFE8D6 0%, transparent 70%)', top: '10%', right: '-5%',
            animation: 'blob-float-2 20s infinite linear',
            willChange: 'transform'
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full opacity-60 ambient-blob"
          style={{ 
            background: 'radial-gradient(circle, #D4E4FF 0%, transparent 70%)', bottom: '-20%', left: '20%',
            animation: 'blob-float-3 28s infinite linear',
            willChange: 'transform'
          }}
        />
      </div>
      
      {/* STATIC BLUR OVERLAY - This is highly optimized for the GPU as it sits on a single composited layer over the moving blobs */}
      <div className="absolute inset-0 z-[1] backdrop-blur-[60px]" style={{ willChange: 'backdrop-filter' }} />

      {/* Subtle flowing SVG curves representing energy waves - moved ABOVE the blur */}
      <div className="absolute inset-0 z-[2] opacity-[0.15]">
        <svg className="w-full h-full" preserveAspectRatio="none">
        <path
          className="ambient-svg"
          d="M-200,500 C200,400 400,600 800,500 C1200,400 1600,700 2000,500"
          fill="none"
          stroke="url(#gradient-line-1)"
          strokeWidth="2"
          style={{
            strokeDasharray: '1000 1000',
            opacity: 0.5,
            animation: 'pulse-opacity 15s infinite alternate ease-in-out'
          }}
        />
        <path
          className="ambient-svg"
          d="M-200,300 C300,500 500,200 1000,400 C1500,600 1800,200 2200,400"
          fill="none"
          stroke="url(#gradient-line-2)"
          strokeWidth="1.5"
          style={{
            strokeDasharray: '800 800',
            opacity: 0.5,
            animation: 'pulse-opacity 18s infinite alternate ease-in-out'
          }}
        />
        
        <defs>
          <linearGradient id="gradient-line-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1A2766" stopOpacity="0" />
            <stop offset="50%" stopColor="#1A2766" stopOpacity="1" />
            <stop offset="100%" stopColor="#1A2766" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient-line-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#AE1B1E" stopOpacity="0" />
            <stop offset="50%" stopColor="#AE1B1E" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#AE1B1E" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      </div>

      {/* Floating particles (very subtle) - wrapped in div for z-index */}
      <div className="absolute inset-0 z-[2]">
        {Array.from({ length: 15 }).map((_, i) => {
          // Precalculate static random values so they don't regenerate on every render
          // (Though React.memo prevents most re-renders, it's good practice)
          // We will use inline custom properties to pass values to the keyframe
          const x = (i * 7.5 + 3) % 100; // pseudo-random deterministic
          const y = (i * 13.2 + 5) % 100;
          const size = (i % 4) + 1;
          const duration = 10 + (i % 10);
          const delay = i % 5;
          const px = (i % 2 === 0 ? 1 : -1) * (15 + (i % 15));
          
          return (
            <div
              key={`particle-${i}`}
              className="absolute rounded-full bg-slate-400 opacity-20 ambient-particle"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${x}%`,
                top: `${y}%`,
                '--px': `${px}px`,
                animation: `particle-float ${duration}s infinite ease-in-out ${delay}s`,
                willChange: 'transform, opacity'
              } as React.CSSProperties}
            />
          );
        })}
      </div>
      
      {/* Soft glowing radial rings - moved to static to avoid layout thrashing, just pulse opacity */}
      <div
        className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-10 z-[2] ambient-ring"
        style={{
          border: '1px solid #1A2766',
          boxShadow: '0 0 40px rgba(26,39,102,0.1) inset',
          animation: 'pulse-opacity 15s infinite ease-in-out',
          willChange: 'opacity'
        }}
      />
      <div
        className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full opacity-10 z-[2] ambient-ring"
        style={{
          border: '1px solid #AE1B1E',
          boxShadow: '0 0 30px rgba(174,27,30,0.1) inset',
          animation: 'pulse-opacity 18s infinite ease-in-out 2s',
          willChange: 'opacity'
        }}
      />
      
      {/* Very faint mesh grid over everything */}
      <div 
        className="absolute inset-0 opacity-[0.02] z-[3]"
        style={{
          backgroundImage: 'linear-gradient(#1A2766 1px, transparent 1px), linear-gradient(90deg, #1A2766 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
});

export default AmbientBackground;
