'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import Image from 'next/image';

function MobileLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = mobile.length === 10 && pin.length === 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, pin }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const callbackUrl = searchParams.get('callbackUrl');
        const target = (callbackUrl && callbackUrl.startsWith('/')) ? callbackUrl : '/mobile';
        router.push(target);
      } else {
        // Mobile friendly inline error
        setError(data.error || 'Invalid mobile number or PIN.');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FB] font-sans selection:bg-blue-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col px-5 pt-[10vh] max-w-[430px] mx-auto w-full">
        
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/logo.svg"
            alt="Kamna Traders"
            width={200}
            height={85}
            className="object-contain h-[70px] w-auto"
            priority
          />
        </div>

        {/* Surface Card */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col gap-7">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome Back</h1>
            <p className="text-slate-500 mt-1.5 text-[13px] font-medium">Sign in to Kamna ERP</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-[13px] font-semibold border border-red-100 text-center flex items-center justify-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {/* Mobile Number */}
            <div className="space-y-2">
              <label htmlFor="mobile" className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Mobile Number
              </label>
              <div className="flex items-center bg-[#F8F9FB] border-[1.5px] border-slate-100 rounded-[16px] px-4 py-3.5 focus-within:border-[#1A2766]/30 focus-within:bg-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                <span className="text-slate-400 font-semibold mr-2">+91</span>
                <div className="w-[1.5px] h-4 bg-slate-200 mr-3 rounded-full" />
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  className="bg-transparent w-full outline-none text-slate-800 placeholder:text-slate-300 font-semibold text-[15px]"
                  required
                  autoComplete="tel-national"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label htmlFor="pin" className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                6-Digit PIN
              </label>
              <div className="flex items-center bg-[#F8F9FB] border-[1.5px] border-slate-100 rounded-[16px] px-4 py-3.5 focus-within:border-[#1A2766]/30 focus-within:bg-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                <Lock size={18} className="text-slate-400 mr-3" strokeWidth={2.5} />
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="bg-transparent w-full outline-none text-slate-800 placeholder:text-slate-300 font-bold tracking-[0.3em] text-lg h-[22px]"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-[#1A2766] text-white font-bold text-[15px] py-[18px] rounded-[16px] shadow-[0_4px_14px_rgba(26,39,102,0.15)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <div className="w-5 h-5 rounded-full border-[2.5px] border-white/30 border-t-white animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function MobileLogin() {
  return (
    <Suspense fallback={<div className="flex-1 flex flex-col bg-[#F8F9FB]"><div className="flex-1 bg-[#F8F9FB]" /></div>}>
      <MobileLoginContent />
    </Suspense>
  );
}
