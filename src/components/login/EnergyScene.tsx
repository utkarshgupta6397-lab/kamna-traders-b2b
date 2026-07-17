'use client';

import { motion } from 'framer-motion';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER COMPONENTS
──────────────────────────────────────────────────────────────────────────────*/

// Energy packet traveling along path
function Pulse({ d, dur, delay, color = '#38bdf8', r = 2.5 }: { d: string; dur: number; delay: number; color?: string; r?: number }) {
  return (
    <motion.circle
      r={r}
      fill={color}
      style={{ offsetPath: `path("${d}")`, offsetDistance: '0%' } as React.CSSProperties}
      animate={{ offsetDistance: ['0%', '100%'] }}
      transition={{ duration: dur, delay, ease: 'linear', repeat: Infinity, repeatDelay: 1 }}
    />
  );
}

// Wind Turbine (Modern, elegant)
function WindTurbine({ x, y, s = 1, speed = 8 }: { x: number; y: number; s?: number; speed?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* Tower - Gradient for cylindrical feel */}
      <defs>
        <linearGradient id={`tower-grad-${x}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <path d="M-4,0 L4,0 L2.5,-120 L-2.5,-120 Z" fill={`url(#tower-grad-${x})`} />
      {/* Nacelle */}
      <rect x="-6" y="-126" width="20" height="10" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.5" />
      {/* Hub */}
      <circle cx="0" cy="-121" r="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.5" />
      {/* Blades */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
        style={{ originX: '0px', originY: '-121px' } as React.CSSProperties}
      >
        <path d="M-1.5,-121 Q-3,-170 0,-190 Q3,-170 1.5,-121 Z" fill="#ffffff" stroke="#f1f5f9" strokeWidth="0.5" />
        <path d="M-1.5,-121 Q-3,-170 0,-190 Q3,-170 1.5,-121 Z" fill="#ffffff" stroke="#f1f5f9" strokeWidth="0.5" transform="rotate(120 0 -121)" />
        <path d="M-1.5,-121 Q-3,-170 0,-190 Q3,-170 1.5,-121 Z" fill="#ffffff" stroke="#f1f5f9" strokeWidth="0.5" transform="rotate(240 0 -121)" />
      </motion.g>
    </g>
  );
}

// Transmission Tower (High detail)
function TransmissionTower({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* Base Legs */}
      <line x1="-25" y1="0" x2="-8" y2="-100" stroke="#64748b" strokeWidth="1.5" />
      <line x1="25" y1="0" x2="8" y2="-100" stroke="#64748b" strokeWidth="1.5" />
      {/* Cross Arms */}
      <line x1="-35" y1="-70" x2="35" y2="-70" stroke="#64748b" strokeWidth="1.5" />
      <line x1="-30" y1="-85" x2="30" y2="-85" stroke="#64748b" strokeWidth="1.5" />
      <line x1="-20" y1="-100" x2="20" y2="-100" stroke="#64748b" strokeWidth="1.5" />
      {/* X Bracing */}
      <path d="M-25,0 L8,-100 M25,0 L-8,-100" stroke="#94a3b8" strokeWidth="0.5" opacity="0.7" />
      <path d="M-19,-35 L19,-35 M-14,-65 L14,-65" stroke="#94a3b8" strokeWidth="1" />
      {/* Top Peak */}
      <line x1="-8" y1="-100" x2="0" y2="-120" stroke="#64748b" strokeWidth="1.5" />
      <line x1="8" y1="-100" x2="0" y2="-120" stroke="#64748b" strokeWidth="1.5" />
      {/* Insulators */}
      <circle cx="-35" cy="-65" r="1.5" fill="#e2e8f0" />
      <circle cx="35" cy="-65" r="1.5" fill="#e2e8f0" />
      <circle cx="-30" cy="-80" r="1.5" fill="#e2e8f0" />
      <circle cx="30" cy="-80" r="1.5" fill="#e2e8f0" />
    </g>
  );
}

// Hero Solar Farm (High Perspective, realistic grid)
function HeroSolarFarm({ x, y }: { x: number; y: number }) {
  const rows = 14;
  const perspectivePanels = [];
  
  for (let r = 0; r < rows; r++) {
    const scale = 1 + (r * 0.15); // Perspective scaling
    const w = 40 * scale;
    const h = 18 * scale;
    const cols = 20 - Math.floor(r * 0.5); // Fewer cols further back if we wanted, but let's keep it wide
    
    // Calculate total width of this row to center it
    const rowWidth = cols * (w + 2 * scale);
    const startX = x - rowWidth / 2;
    const rowY = y + (r * h * 0.85); // Overlap

    for (let c = 0; c < cols; c++) {
      const px = startX + c * (w + 2 * scale);
      
      // Calculate skew for perspective (outer panels skew more)
      const distFromCenter = (c - cols/2) / (cols/2);
      const skewX = distFromCenter * 15;

      perspectivePanels.push(
        <g key={`${r}-${c}`} transform={`translate(${px}, ${rowY}) skewX(${skewX})`}>
          {/* Panel Base */}
          <rect width={w} height={h} rx={1 * scale} fill="#1e3a8a" stroke="#3b82f6" strokeWidth={0.5 * scale} />
          {/* Grid Lines */}
          <line x1={w*0.25} y1="0" x2={w*0.25} y2={h} stroke="#2563eb" strokeWidth={0.25 * scale} opacity="0.6" />
          <line x1={w*0.5} y1="0" x2={w*0.5} y2={h} stroke="#2563eb" strokeWidth={0.25 * scale} opacity="0.6" />
          <line x1={w*0.75} y1="0" x2={w*0.75} y2={h} stroke="#2563eb" strokeWidth={0.25 * scale} opacity="0.6" />
          <line x1="0" y1={h*0.5} x2={w} y2={h*0.5} stroke="#2563eb" strokeWidth={0.25 * scale} opacity="0.6" />
          {/* Shimmer reflection */}
          <motion.rect 
            width={w} height={h} fill="url(#panel-shimmer)" rx={1 * scale}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 4, repeat: Infinity, delay: (r*0.2) + (c*0.1) }}
          />
        </g>
      );
    }
  }

  return <g>{perspectivePanels}</g>;
}

// Modern House with Solar
function ModernHouse({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* Shadow */}
      <ellipse cx="60" cy="45" rx="60" ry="10" fill="rgba(0,0,0,0.15)" />
      
      {/* Main Structure Right */}
      <rect x="40" y="0" width="70" height="40" fill="#f8fafc" />
      <polygon points="40,0 110,0 110,-20 40,-10" fill="#e2e8f0" />
      
      {/* Main Structure Left (Forward) */}
      <rect x="0" y="-10" width="60" height="55" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.5" />
      <polygon points="-5,-10 30,-30 65,-10 65,0 -5,0" fill="#334155" /> {/* Dark Roof */}
      
      {/* Roof Solar Panels */}
      <g transform="translate(10, -18) skewY(-30) scale(1, 0.8)">
        <rect x="0" y="0" width="20" height="15" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="0.5" />
        <rect x="22" y="0" width="20" height="15" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="0.5" />
      </g>
      
      {/* Windows */}
      <rect x="10" y="10" width="40" height="20" fill="#cbd5e1" opacity="0.6" />
      <rect x="55" y="10" width="15" height="20" fill="#cbd5e1" opacity="0.6" />
      <rect x="80" y="10" width="15" height="20" fill="#cbd5e1" opacity="0.6" />
      
      {/* Door */}
      <rect x="25" y="30" width="10" height="15" fill="#475569" />
      
      {/* Warm interior glow */}
      <motion.rect x="10" y="10" width="40" height="20" fill="#fef08a" style={{ mixBlendMode: 'overlay' }}
        animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </g>
  );
}

// BESS (Battery Energy Storage System) - Detailed Container
function DetailedBESS({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* Shadow */}
      <ellipse cx="40" cy="40" rx="45" ry="8" fill="rgba(0,0,0,0.2)" />
      {/* Container Body */}
      <rect x="0" y="0" width="80" height="40" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      {/* Doors/Panels */}
      <rect x="5" y="5" width="15" height="30" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
      <rect x="25" y="5" width="15" height="30" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
      <rect x="45" y="5" width="15" height="30" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
      {/* HVAC / Unit on side */}
      <rect x="65" y="10" width="10" height="20" fill="#94a3b8" />
      <line x1="67" y1="12" x2="73" y2="12" stroke="#475569" strokeWidth="0.5" />
      <line x1="67" y1="16" x2="73" y2="16" stroke="#475569" strokeWidth="0.5" />
      <line x1="67" y1="20" x2="73" y2="20" stroke="#475569" strokeWidth="0.5" />
      
      {/* Energy Storage Logo / Accent */}
      <rect x="-2" y="15" width="4" height="10" fill="#10b981" />
      <motion.rect x="35" y="-5" width="10" height="3" rx="1" fill="#10b981"
        animate={{ opacity: [0.5, 1, 0.5], boxShadow: ['0 0 0px #10b981', '0 0 10px #10b981', '0 0 0px #10b981'] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <text x="35" y="20" fill="#64748b" fontSize="6" fontWeight="bold">ENERGY</text>
      <text x="35" y="28" fill="#64748b" fontSize="6" fontWeight="bold">STORAGE</text>
    </g>
  );
}

// Modern EV Charger with Car
function EVChargerWithCar({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* Shadow */}
      <ellipse cx="30" cy="15" rx="35" ry="5" fill="rgba(0,0,0,0.15)" />
      
      {/* EV Charger Station */}
      <rect x="55" y="-15" width="12" height="30" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
      <rect x="57" y="-10" width="8" height="10" rx="1" fill="#0f172a" />
      <motion.circle cx="61" cy="-5" r="2" fill="#22c55e"
        animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* Sleek Electric Vehicle (Side Profile) */}
      <g transform="translate(0, 0)">
        {/* Car Body Base */}
        <path d="M 0,5 L 50,5 L 52,10 L -2,10 Z" fill="#94a3b8" />
        {/* Car Body Main */}
        <path d="M 0,5 Q 5,-5 15,-5 L 35,-5 Q 45,-5 50,5 Z" fill="#ffffff" />
        {/* Windows */}
        <path d="M 15,-4 L 32,-4 Q 38,0 42,4 L 10,4 Q 12,0 15,-4 Z" fill="#cbd5e1" opacity="0.8" />
        {/* Wheels */}
        <circle cx="10" cy="10" r="4" fill="#334155" />
        <circle cx="10" cy="10" r="2" fill="#e2e8f0" />
        <circle cx="40" cy="10" r="4" fill="#334155" />
        <circle cx="40" cy="10" r="2" fill="#e2e8f0" />
      </g>
      
      {/* Charging Cable */}
      <path d="M 55,5 Q 50,15 45,5" fill="none" stroke="#475569" strokeWidth="1" />
    </g>
  );
}

// Smart Substation
function SmartSubstation({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="0" y="0" width="80" height="40" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      {/* Transformers */}
      <rect x="10" y="-15" width="20" height="15" fill="#94a3b8" />
      <rect x="12" y="-20" width="4" height="5" fill="#cbd5e1" />
      <rect x="24" y="-20" width="4" height="5" fill="#cbd5e1" />
      
      <rect x="50" y="-15" width="20" height="15" fill="#94a3b8" />
      <rect x="52" y="-20" width="4" height="5" fill="#cbd5e1" />
      <rect x="64" y="-20" width="4" height="5" fill="#cbd5e1" />
      
      {/* Cooling fins */}
      {Array.from({length: 4}).map((_, i) => (
        <line key={`f1-${i}`} x1={15 + i*3} y1="-10" x2={15 + i*3} y2="0" stroke="#64748b" strokeWidth="0.5" />
      ))}
      {Array.from({length: 4}).map((_, i) => (
        <line key={`f2-${i}`} x1={55 + i*3} y1="-10" x2={55 + i*3} y2="0" stroke="#64748b" strokeWidth="0.5" />
      ))}

      {/* Control building */}
      <rect x="35" y="10" width="30" height="20" fill="#f8fafc" />
      <rect x="40" y="15" width="10" height="15" fill="#334155" />
    </g>
  );
}

// City Skyline (Distant)
function DistantCity({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const buildings = [];
  let currX = 0;
  // Generate random skyline
  // Seeded math.random for consistency
  const seed = [3,1,4,1,5,9,2,6,5,3,5, 8,9,7,9,3,2,3,8,4,6];
  let i = 0;
  
  while (currX < w) {
    const bw = 10 + (seed[i%seed.length] * 2);
    const bh = 20 + (seed[(i+1)%seed.length] * 5);
    i++;
    
    // Atmospheric perspective colors
    buildings.push(
      <rect key={currX} x={x + currX} y={y - bh} width={bw} height={bh} fill="rgba(148, 163, 184, 0.4)" />
    );
    // Optional highlight
    if (i%3===0) {
       buildings.push(
        <rect key={`${currX}-h`} x={x + currX + bw - 2} y={y - bh} width={2} height={bh} fill="rgba(203, 213, 225, 0.3)" />
      );
    }
    
    currX += bw + (seed[i%seed.length]);
  }
  return <g>{buildings}</g>;
}


/* ─────────────────────────────────────────────────────────────────────────────
   INDIA HOLOGRAPHIC MAP
──────────────────────────────────────────────────────────────────────────────*/
function IndiaHologram({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  // A clean, continuous path for India silhouette
  const path = `
    M 86,2 Q 108,6 128,12 Q 150,18 166,32 Q 178,44 180,58
    Q 176,70 165,78 Q 170,88 158,96 Q 146,106 132,116
    Q 120,128 114,146 Q 108,165 104,183 Q 99,200 94,216
    Q 89,230 86,242 Q 82,248 79,242 Q 73,228 63,210
    Q 52,188 42,162 Q 31,136 24,110 Q 16,84 10,62
    Q 2,44 4,30 Q 10,16 24,10 Q 12,20 8,32 Q 6,42 10,52
    Q 18,62 26,56 Q 18,68 8,58 Q 2,48 4,36 Q 10,18 24,10
    Q 38,4 54,2 Q 68,0 86,2 Z
  `;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${s})`}>
      {/* Outer Breathing Glow */}
      <motion.ellipse cx={90} cy={125} rx={120} ry={150}
        fill="url(#hologram-glow)"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Map Fill with Grid Pattern */}
      <motion.path
        d={path}
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Dots and Connecting Network within Map */}
      <g opacity="0.6">
        <circle cx={68} cy={30} r="2" fill="#fff" />
        <circle cx={120} cy={72} r="2" fill="#fff" />
        <circle cx={36} cy={110} r="2" fill="#fff" />
        <circle cx={100} cy={155} r="2" fill="#fff" />
        <circle cx={82} cy={215} r="2" fill="#fff" />
        
        <path d="M 68,30 L 120,72 L 100,155 L 82,215 L 36,110 Z" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d="M 68,30 L 36,110" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
      </g>
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN SCENE (Hero Experience)
──────────────────────────────────────────────────────────────────────────────*/
export default function EnergyScene({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const px = (mouseX - 0.5) * 15;
  const py = (mouseY - 0.5) * 8;

  // Energy flows matching the story: 
  // Solar (left) -> Substation (mid-right) -> Grid (far right) -> City/Industry (mid) -> Home/EV (foreground right)
  const flows = {
    solarToSub: "M 350,550 C 450,560 550,500 650,470",
    windToSub: "M 200,380 C 350,400 500,450 620,460",
    subToTower: "M 670,470 C 720,475 750,450 820,440",
    towerToTower2: "M 820,440 L 980,450",
    towerToIndustry: "M 980,450 C 950,480 880,490 850,510",
    towerToBESS: "M 980,450 C 1050,490 1100,530 1100,560",
    bessToHome: "M 1100,580 C 1050,600 1000,620 950,620",
    homeToEV: "M 900,630 C 850,630 820,630 780,630",
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      aria-hidden="true"
      style={{
        transform: `translate(${px}px, ${py}px)`,
        transition: 'transform 0.8s ease-out',
        willChange: 'transform',
      }}
    >
      {/* ── Background: Bright Morning Sky ── */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(170deg, #60a5fa 0%, #93c5fd 25%, #bfdbfe 50%, #fef3c7 85%, #fde68a 100%)',
      }} />

      {/* ── Sunrise Haze (Bottom Left) ── */}
      <motion.div
        className="absolute bottom-0 left-0 w-3/4 h-3/4 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 10% 80%, rgba(253, 230, 138, 0.6) 0%, rgba(253, 224, 71, 0.2) 40%, transparent 70%)',
          mixBlendMode: 'screen'
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="hologram-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          
          <linearGradient id="panel-shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Depth Gradients for Landscape */}
          <linearGradient id="grad-bg-mountains" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.2" />
          </linearGradient>
          
          <linearGradient id="grad-mid-hills" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="grad-fore-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#166534" stopOpacity="0.9" />
          </linearGradient>
          
          <linearGradient id="grad-river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>

        {/* ── Sun ── */}
        <circle cx="150" cy="500" r="100" fill="#fde047" filter="url(#hologram-glow)" opacity="0.8" />
        <circle cx="150" cy="500" r="40" fill="#fef08a" />

        {/* ── Birds ── */}
        <motion.path d="M 400,200 Q 405,195 410,200 Q 415,195 420,200" fill="none" stroke="#64748b" strokeWidth="1.5"
          animate={{ x: [0, 400], y: [0, -50] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} />
        <motion.path d="M 430,220 Q 435,215 440,220 Q 445,215 450,220" fill="none" stroke="#64748b" strokeWidth="1.5"
          animate={{ x: [0, 400], y: [0, -50] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear', delay: 1 }} />

        {/* ── Background: Mountains & Skyline ── */}
        <path d="M 0,450 Q 200,350 400,420 T 900,380 T 1600,450 L 1600,900 L 0,900 Z" fill="url(#grad-bg-mountains)" />
        <DistantCity x={700} y={420} w={600} h={100} />

        {/* ── Midground: Hills & Wind Farms ── */}
        <path d="M 0,500 Q 300,400 600,480 T 1200,450 T 1600,500 L 1600,900 L 0,900 Z" fill="url(#grad-mid-hills)" />
        
        <WindTurbine x={150} y={440} s={0.7} speed={8} />
        <WindTurbine x={280} y={410} s={0.8} speed={10} />
        <WindTurbine x={420} y={430} s={0.75} speed={9} />

        {/* ── River ── */}
        <path d="M 600,480 Q 700,500 650,550 T 900,600 T 1600,620 L 1600,650 T 900,620 T 630,550 T 600,480 Z" fill="url(#grad-river)" opacity="0.8" />

        {/* ── India Hologram Map ── */}
        <IndiaHologram cx={1000} cy={100} s={0.9} />

        {/* ── Connection lines from Map to Landscape ── */}
        <motion.path d="M 1090, 220 L 820, 440" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4 4"
          animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
        <motion.path d="M 1090, 220 L 350, 550" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4 4"
          animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
        <motion.path d="M 1090, 220 L 980, 450" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4 4"
          animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />

        {/* ── Transmission Infrastructure ── */}
        <TransmissionTower x={820} y={450} s={0.6} />
        <TransmissionTower x={980} y={460} s={0.7} />
        
        {/* Wires */}
        <path d="M 800,408 Q 900,430 955,410" fill="none" stroke="#64748b" strokeWidth="0.5" />
        <path d="M 803,400 Q 900,420 958,400" fill="none" stroke="#64748b" strokeWidth="0.5" />
        <path d="M 800,390 Q 900,410 955,390" fill="none" stroke="#64748b" strokeWidth="0.5" />
        
        <path d="M 1000,410 Q 1100,440 1200,420" fill="none" stroke="#64748b" strokeWidth="0.5" />
        <path d="M 1005,400 Q 1100,430 1200,410" fill="none" stroke="#64748b" strokeWidth="0.5" />
        <path d="M 1000,390 Q 1100,420 1200,400" fill="none" stroke="#64748b" strokeWidth="0.5" />

        {/* ── Energy Flow Lines ── */}
        {Object.values(flows).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        ))}
        {/* Glow Pulses */}
        <Pulse d={flows.solarToSub} dur={4} delay={0} color="#fde047" r={3} />
        <Pulse d={flows.windToSub} dur={3} delay={1} color="#fde047" r={3} />
        <Pulse d={flows.subToTower} dur={2} delay={0.5} color="#38bdf8" r={3} />
        <Pulse d={flows.towerToTower2} dur={2} delay={0} color="#38bdf8" r={3} />
        <Pulse d={flows.towerToIndustry} dur={2.5} delay={1} color="#38bdf8" r={3} />
        <Pulse d={flows.towerToBESS} dur={3} delay={0} color="#38bdf8" r={3} />
        <Pulse d={flows.bessToHome} dur={2} delay={1.5} color="#22c55e" r={3} />
        <Pulse d={flows.homeToEV} dur={1.5} delay={0} color="#22c55e" r={3} />

        {/* ── Substation & Industry ── */}
        <SmartSubstation x={620} y={450} s={0.7} />
        
        {/* Industry Building */}
        <g transform="translate(800, 480)">
          <rect x="0" y="0" width="80" height="40" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
          <rect x="20" y="-10" width="10" height="10" fill="#cbd5e1" />
          <rect x="50" y="-15" width="10" height="15" fill="#cbd5e1" />
          {/* Industry Solar Roof */}
          <rect x="5" y="-3" width="70" height="3" fill="#1e3a8a" />
          <text x="40" y="25" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold">GREEN IND.</text>
        </g>

        {/* ── Foreground: Landscape, Hero Solar Farm, Houses, BESS ── */}
        <path d="M 0,550 Q 400,500 800,580 T 1600,600 L 1600,900 L 0,900 Z" fill="url(#grad-fore-green)" />
        
        {/* Left Side: Massive Hero Solar Farm */}
        <HeroSolarFarm x={350} y={550} />

        {/* Right Side Foreground */}
        <DetailedBESS x={1050} y={540} s={1.2} />
        
        <ModernHouse x={850} y={600} s={1.3} />
        <EVChargerWithCar x={720} y={630} s={1.2} />

        {/* Small details (trees, rocks) */}
        <circle cx="1000" cy="650" r="20" fill="#15803d" />
        <circle cx="1020" cy="640" r="15" fill="#166534" />
        <circle cx="1150" cy="680" r="30" fill="#15803d" />
        <circle cx="1180" cy="670" r="25" fill="#166534" />
        <circle cx="700" cy="680" r="15" fill="#15803d" />
        
        {/* Floating Light Particles (Atmosphere) */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.circle
            key={`p-${i}`}
            cx={Math.random() * 1600}
            cy={Math.random() * 900}
            r={Math.random() * 2 + 1}
            fill="#ffffff"
            initial={{ opacity: Math.random() * 0.5 + 0.1, y: 0 }}
            animate={{ opacity: [0, 0.8, 0], y: -50 - Math.random() * 50 }}
            transition={{ duration: 4 + Math.random() * 6, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 5 }}
          />
        ))}
      </svg>
    </div>
  );
}
