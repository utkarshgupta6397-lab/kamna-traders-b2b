'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Phone, RefreshCw } from 'lucide-react';

type Step = 'mobile' | 'pin' | 'reset';

export default function StaffLoginPage() {
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleMobileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobile.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setStep('pin');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, pin }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      router.push(data.role === 'ADMIN' ? '/admin' : '/staff/dashboard');
    } else {
      setError(data.error || 'Login failed');
    }
  };

  const handleResetPin = async () => {
    setLoading(true);
    const res = await fetch('/api/auth/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResetMsg('New PIN sent to your WhatsApp. Check and try again.');
      setStep('pin');
    } else {
      setError(data.error || 'Failed to reset PIN');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1a40] via-[#1A2766] to-[#003347] flex items-center justify-center p-4">
      {/* Decorative circles */}
      <div className="fixed top-0 left-0 w-80 h-80 bg-[#AE1B1E]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-[#003347]/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        {/* Logo area — white bg, full-color logo */}
        <div className="bg-white pt-8 pb-6 flex flex-col items-center border-b border-gray-100">
          <Image
            src="/logo.svg"
            alt="Kamna Traders"
            width={160}
            height={70}
            className="object-contain h-16 w-auto"
            priority
          />
          <p className="text-gray-400 text-xs mt-3 font-medium">Staff &amp; Admin Portal</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          {resetMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg mb-4 text-sm">
              {resetMsg}
            </div>
          )}

          {step === 'mobile' && (
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WhatsApp Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                    <Phone size={14} className="mr-1.5" />+91
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-r-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
                    placeholder="10-digit number"
                    maxLength={10}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#1A2766] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#003347] transition-colors">
                Continue →
              </button>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">6-Digit PIN</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:ring-2 focus:ring-[#1A2766] outline-none"
                    placeholder="••••••"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Enter your secure 6-digit PIN to access the portal.</p>
              </div>
              <button
                type="submit"
                disabled={loading || pin.length !== 6}
                className="w-full bg-[#AE1B1E] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#900f12] transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Login'}
              </button>
              <div className="flex justify-between text-xs pt-1">
                <button type="button" onClick={() => { setStep('mobile'); setPin(''); setError(''); }} className="text-gray-400 hover:text-gray-600">
                  ← Change number
                </button>
                <button type="button" onClick={() => setStep('reset')} className="text-[#AE1B1E] hover:underline">
                  Forgot PIN?
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <div className="space-y-4 text-center">
              <div className="bg-amber-50 rounded-xl p-4">
                <RefreshCw size={24} className="text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700 font-medium">Reset PIN for</p>
                <p className="text-base font-bold text-[#1A2766]">+91 {mobile}</p>
                <p className="text-xs text-gray-500 mt-1">A new 6-digit PIN will be sent to your WhatsApp.</p>
              </div>
              <button
                onClick={handleResetPin}
                disabled={loading}
                className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send New PIN via WhatsApp'}
              </button>
              <button type="button" onClick={() => { setStep('pin'); setError(''); }} className="text-sm text-gray-400 hover:text-gray-600">
                ← Back to PIN entry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
