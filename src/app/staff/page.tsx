'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Phone, RotateCcw, ArrowLeft, ArrowRight, ShieldCheck, Leaf } from 'lucide-react';
import dynamic from 'next/dynamic';

// Load background + badges lazily (client-only)
const AmbientBackground = dynamic(() => import('@/components/login/AmbientBackground'), { ssr: false });
const FloatingBadges  = dynamic(() => import('@/components/login/FloatingBadges'),  { ssr: false });

type Step = 'mobile' | 'pin' | 'reset';

/* ── Alert box ────────────────────────────────────────────────────────────── */
function AlertBox({ type, message }: { type: 'error' | 'success'; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -6 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className={`px-4 py-3 rounded-xl text-sm mb-6 border ${
        type === 'error'
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-green-50 border-green-200 text-green-700'
      }`}
    >
      {message}
    </motion.div>
  );
}

/* ── Gradient button ──────────────────────────────────────────────────────── */
function Btn({
  children, loading, disabled, onClick, type = 'submit'
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={!disabled && !loading ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      className="relative w-full py-[16px] rounded-[14px] font-semibold text-[15px] text-white overflow-hidden
                 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      style={{
        background: 'linear-gradient(90deg, #1A2766 0%, #AE1B1E 100%)',
        boxShadow: '0 6px 24px rgba(26,39,102,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {/* Shine sweep */}
      {!disabled && !loading && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none"
          initial={{ x: '-150%' }}
          animate={{ x: '250%' }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
        />
      )}
      <span className="relative flex items-center justify-center gap-2">
        {loading
          ? <motion.div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          : children}
      </span>
    </motion.button>
  );
}

/* ── Input row ────────────────────────────────────────────────────────────── */
function InputRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex rounded-[14px] overflow-hidden bg-white
                 transition-all duration-200
                 focus-within:shadow-[0_0_0_3px_rgba(26,39,102,0.1)] focus-within:border-[#1A2766]"
      style={{ border: '1.5px solid #e2e8f0' }}
    >
      {children}
    </div>
  );
}

/* ── Login form content ───────────────────────────────────────────────────── */
function StaffLoginContent() {
  const [step,          setStep]          = useState<Step>('mobile');
  const [mobile,        setMobile]        = useState('');
  const [pin,           setPin]           = useState('');
  const [error,         setError]         = useState('');
  const [resetMsg,      setResetMsg]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [isTransition,  setIsTransition]  = useState(false);
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('error') === 'superseded') {
      setError('Your session was signed in on another device.');
    }
  }, [searchParams]);

  /* ── Auth handlers (UNCHANGED) ─────────────────────────────────────────── */
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = mobile.trim();
    if (!/^\d{10}$/.test(clean)) { setError('Enter a valid 10-digit mobile number'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/check-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: clean }),
      });
      const data = await res.json();
      setLoading(false);
      res.ok ? setStep('pin') : setError(data.error || 'No active account found with this phone number.');
    } catch {
      setLoading(false);
      setError('Connection error. Please try again.');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, pin }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsTransition(true);
        router.push(data.role === 'ADMIN' ? '/admin' : '/staff/dashboard');
      } else {
        setLoading(false);
        setError(data.error || 'Login failed');
      }
    } catch {
      setLoading(false);
      setError('Connection error. Please try again.');
    }
  };

  const handleResetPin = async () => {
    setLoading(true);
    const res  = await fetch('/api/auth/reset-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setResetMsg('New PIN sent to your WhatsApp.'); setStep('pin'); }
    else         { setError(data.error || 'Failed to reset PIN'); }
  };
  /* ─────────────────────────────────────────────────────────────────────── */

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-50"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Ambient Background Layer ────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <AmbientBackground />
      </div>

      {/* ── Floating Badges (hidden on mobile) ────────────────────────────── */}
      <FloatingBadges />

      {/* ── Centered login card ────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pointer-events-none">
        
        {/* Make card itself pointer-events-auto so it receives clicks */}
        <motion.div
          className="w-full max-w-[440px] pointer-events-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.003 }}
        >
          {/* Card shell */}
          <div
            className="relative rounded-[32px] overflow-hidden flex flex-col"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04), inset 0 2px 4px rgba(255,255,255,1)',
            }}
          >
            {/* Logo header */}
            <div className="px-10 pt-10 pb-6 flex flex-col items-center">
              <Image
                src="/logo.svg"
                alt="Kamna Traders"
                width={200}
                height={85}
                className="object-contain h-24 w-auto"
                priority
              />
              <div className="flex items-center gap-3 w-full mt-6">
                <div className="h-px bg-slate-200 flex-1" />
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-400">
                  Staff &amp; Admin Portal
                </p>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
            </div>

            {/* Form body */}
            <div className="px-10 pb-10">
              <AnimatePresence mode="wait">
                {error    && <AlertBox key="e" type="error"   message={error} />}
                {resetMsg && <AlertBox key="r" type="success" message={resetMsg} />}
              </AnimatePresence>

              {/* Step heading */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24 }}
                  className="mb-8"
                >
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {step === 'mobile' && 'Welcome Back!'}
                    {step === 'pin'    && 'Enter Your PIN'}
                    {step === 'reset'  && 'Reset PIN'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-2 font-medium">
                    {step === 'mobile' && 'Continue to Kamna Energy Platform'}
                    {step === 'pin'    && `Signing in as +91 ${mobile}`}
                    {step === 'reset'  && 'A new PIN will be sent via WhatsApp'}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* ── Step: Mobile ── */}
              <AnimatePresence mode="wait">
                {step === 'mobile' && (
                  <motion.form
                    key="m"
                    onSubmit={handleMobileSubmit}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.24 }}
                    className="space-y-6"
                  >
                    <div>
                      <label htmlFor="mobile-input"
                        className="block text-[11px] uppercase tracking-[0.2em] mb-2.5 font-bold text-slate-500"
                      >
                        WhatsApp Number
                      </label>
                      <InputRow>
                        <span className="inline-flex items-center px-4 gap-2 text-[15px] font-medium text-slate-500 border-r border-slate-200 shrink-0">
                          <Phone size={16} />+91
                        </span>
                        <input
                          id="mobile-input"
                          type="tel"
                          inputMode="numeric"
                          value={mobile}
                          onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="flex-1 bg-transparent px-4 py-4 text-[15px] text-slate-800 placeholder-slate-400 outline-none font-medium"
                          placeholder="Enter 10 digit number"
                          maxLength={10}
                          required
                          autoFocus
                          autoComplete="tel"
                        />
                      </InputRow>
                    </div>
                    <Btn loading={loading} disabled={mobile.length !== 10}>
                      Continue <ArrowRight size={18} />
                    </Btn>
                  </motion.form>
                )}

                {/* ── Step: PIN ── */}
                {step === 'pin' && (
                  <motion.form
                    key="p"
                    onSubmit={handlePinSubmit}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.24 }}
                    className="space-y-6"
                  >
                    <div>
                      <label htmlFor="pin-input"
                        className="block text-[11px] uppercase tracking-[0.2em] mb-2.5 font-bold text-slate-500"
                      >
                        6-Digit PIN
                      </label>
                      <InputRow>
                        <span className="inline-flex items-center px-4 text-slate-500 shrink-0 border-r border-slate-200">
                          <Lock size={16} />
                        </span>
                        <input
                          id="pin-input"
                          type="password"
                          inputMode="numeric"
                          value={pin}
                          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="flex-1 bg-transparent px-4 py-4 text-[15px] text-center tracking-[0.8em]
                                     font-mono text-slate-800 placeholder-slate-400 outline-none
                                     disabled:opacity-40"
                          placeholder="••••••"
                          maxLength={6}
                          required
                          autoFocus
                          disabled={loading || isTransition}
                          autoComplete="current-password"
                        />
                      </InputRow>
                    </div>
                    <Btn loading={loading || isTransition} disabled={pin.length !== 6}>
                      {isTransition ? 'Redirecting…' : (
                        <>Login <ArrowRight size={18} /></>
                      )}
                    </Btn>
                    <div className="flex justify-between pt-2">
                      <button type="button"
                        onClick={() => { setStep('mobile'); setPin(''); setError(''); }}
                        className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <ArrowLeft size={14} /> Change number
                      </button>
                      <button type="button"
                        onClick={() => setStep('reset')}
                        className="text-[12px] font-bold transition-opacity hover:opacity-80"
                        style={{ color: '#AE1B1E' }}
                      >
                        Forgot PIN?
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* ── Step: Reset ── */}
                {step === 'reset' && (
                  <motion.div
                    key="r"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.24 }}
                    className="space-y-6"
                  >
                    <div className="rounded-[14px] p-5 text-center bg-slate-50 border border-slate-200">
                      <RotateCcw size={28} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-[15px] text-slate-600 font-medium">Reset PIN for</p>
                      <p className="text-lg font-bold mt-1" style={{ color: '#1A2766' }}>+91 {mobile}</p>
                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        A new 6-digit PIN will be sent to your WhatsApp.
                      </p>
                    </div>
                    <Btn loading={loading} type="button" onClick={handleResetPin}>
                      Send New PIN
                    </Btn>
                    <button type="button"
                      onClick={() => { setStep('pin'); setError(''); }}
                      className="flex items-center justify-center gap-1.5 w-full text-[12px] font-medium
                                 text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to PIN entry
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Embedded Trust Notice ── */}
            <div className="mx-10 mb-8 p-4 rounded-[14px] bg-slate-50 border border-slate-100 flex items-start gap-3">
              <div className="p-1.5 bg-blue-100 rounded-full text-blue-600 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-800 mb-0.5">Secure Access</p>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Your data is protected with enterprise grade security.
                </p>
              </div>
            </div>

            {/* Card footer */}
            <div className="px-10 py-5 bg-slate-50 flex items-center justify-center gap-1.5 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500">
                Building India's Clean Energy Future
              </p>
              <Leaf size={12} className="text-emerald-500" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile: simplified sky bg for readability */}
      <div
        className="absolute inset-0 lg:hidden pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FAF7F5 100%)',
        }}
      />
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#1A2766]"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      }
    >
      <StaffLoginContent />
    </Suspense>
  );
}
