'use client';

import { useState, useEffect } from 'react';
import { motion, animate } from 'framer-motion';
import { Sun, Home, Leaf, Activity, Battery, ShieldCheck, Cpu, Zap, CloudLightning } from 'lucide-react';

/* ── Animated counter ─────────────────────────────────────────────────────── */
function Counter({ to, decimals = 0, dur = 2.5 }: { to: number; decimals?: number; dur?: number }) {
  const [val, setVal] = useState('0');
  useEffect(() => {
    const c = animate(0, to, {
      duration: dur,
      ease: 'easeOut',
      onUpdate(v) { setVal(v.toFixed(decimals)); },
    });
    return () => c.stop();
  }, [to, decimals, dur]);
  return <>{val}</>;
}

/* ── KPI data ─────────────────────────────────────────────────────────────── */
const KPIS = [
  { label: 'Solar Generation', to: 2.68, unit: 'GW', decimals: 2, icon: <Sun size={18} className="text-amber-500" /> },
  { label: 'Homes Powered', to: 248750, unit: '', decimals: 0, icon: <Home size={18} className="text-blue-600" /> },
  { label: 'CO₂ Offset Today', to: 18450, unit: 't', decimals: 0, icon: <Leaf size={18} className="text-emerald-600" /> },
  { label: 'Grid Health', to: 99.98, unit: '%', decimals: 2, icon: <Activity size={18} className="text-red-600" /> },
  { label: 'Battery Capacity', to: 82, unit: '%', decimals: 0, icon: <Battery size={18} className="text-slate-600" /> },
];

/* ── Floating info badges ─────────────────────────────────────────────────── */
const BADGES = [
  { label: 'Wind Farms', val: '1.25 GW', icon: <CloudLightning size={16} className="text-slate-600" />, y: '50%', x: '12%' },
  { label: 'Solar Plants', val: '1.80 GW', icon: <Sun size={16} className="text-slate-600" />, y: '68%', x: '8%' },
  { label: 'Smart Grid', val: 'AI Optimized', icon: <Activity size={16} className="text-slate-600" />, y: '75%', x: '35%' },
  { label: 'Industries', val: 'Clean Energy', icon: <Activity size={16} className="text-slate-600" />, y: '60%', x: '58%' },
  { label: 'EV Charging', val: 'Growing Fast', icon: <Activity size={16} className="text-slate-600" />, y: '72%', x: '62%' },
];

export default function DigitalHUD() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">

      {/* ── Headline block (upper-left) ────────────────────────────────────── */}
      <motion.div
        className="absolute top-10 left-12 max-w-[600px]"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#1A2766] mb-3 opacity-90">
          Kamna Energy Platform
        </p>
        <h1
          className="text-5xl font-extrabold leading-[1.1] text-slate-900 tracking-tight"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Powering India's<br/>
          <span style={{ color: '#AE1B1E' }}>
            Next Energy Revolution
          </span>
        </h1>
        <p className="text-base text-slate-700 mt-5 leading-relaxed max-w-[460px] font-medium">
          Building a sustainable tomorrow with clean energy, smart technology and trusted people.
        </p>
      </motion.div>

      {/* ── KPI glass cards (below headline) ──────────────────────────────── */}
      <div className="absolute top-[280px] left-12 flex flex-wrap gap-4 max-w-[800px]">
        {KPIS.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="rounded-2xl px-5 py-4 border border-white/80"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
            }}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.6 + i * 0.1, type: 'spring', bounce: 0.3 }}
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 shadow-sm shrink-0">
                {kpi.icon}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold mb-1">
                  {kpi.label}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                    <Counter to={kpi.to} decimals={kpi.decimals} dur={2 + i * 0.2} />
                  </p>
                  {kpi.unit && (
                    <span className="text-sm font-semibold text-slate-600">{kpi.unit}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-500 font-medium">Live</span>
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Floating info badges (around landscape) ───────────────────────── */}
      {BADGES.map((b, i) => (
        <motion.div
          key={b.label}
          className="absolute rounded-xl px-4 py-2.5 border border-white/60 flex items-center gap-3"
          style={{
            top: b.y, left: b.x,
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: 1, scale: 1,
            y: [0, -8, 0],
          }}
          transition={{
            opacity: { duration: 0.6, delay: 1 + i * 0.2 },
            scale: { duration: 0.6, delay: 1 + i * 0.2 },
            y: { duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 1.2 },
          }}
        >
          <div className="shrink-0">{b.icon}</div>
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
              {b.label}
            </p>
            <p className="text-xs font-bold text-slate-900 leading-none">{b.val}</p>
          </div>
        </motion.div>
      ))}

      {/* ── Trust Pillars Footer ───────────────────────────────────────────── */}
      <motion.div
        className="absolute bottom-8 left-12 right-[420px] rounded-2xl border border-white/10 flex items-center justify-between px-8 py-5"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        {[
          { icon: <ShieldCheck size={20} className="text-white" />, title: 'Reliable', sub: '99.98% Grid Reliability' },
          { icon: <Leaf size={20} className="text-emerald-400" />, title: 'Sustainable', sub: 'Lower Emissions' },
          { icon: <Cpu size={20} className="text-blue-400" />, title: 'Intelligent', sub: 'AI Powered Energy Systems' },
          { icon: <ShieldCheck size={20} className="text-slate-300" />, title: 'Secure', sub: 'Enterprise Grade Security' },
        ].map(p => (
          <div key={p.title} className="flex items-center gap-3">
            <div className="opacity-90">{p.icon}</div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{p.title}</p>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">{p.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
