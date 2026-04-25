'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StaffLoginPage() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // In a real app, call API to send OTP via WhatsApp
    // We are mocking this as per PRD
    if (mobile.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }
    
    setStep(2);
    // Alerting for dev convenience
    alert('Mock OTP sent to WhatsApp! Use 123456 to bypass.');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, otp }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/staff/dashboard');
      }
    } else {
      const data = await res.json();
      setError(data.error || 'Invalid OTP');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
        <h1 className="text-3xl font-bold text-[#1A2766] mb-2">Staff Portal</h1>
        <p className="text-gray-500 mb-8">Login with your registered WhatsApp number.</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500">
                  +91
                </span>
                <input 
                  type="tel" 
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="flex-1 border rounded-r-lg p-3 focus:ring-2 focus:ring-[#1A2766] outline-none"
                  placeholder="Enter mobile number"
                  required
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#1A2766] text-white py-3 rounded-lg font-bold hover:bg-[#003347] transition-colors">
              Send OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-[#1A2766] outline-none text-center tracking-widest text-lg"
                placeholder="------"
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-400 mt-2">Use 123456 as bypass code.</p>
            </div>
            <button type="submit" className="w-full bg-[#AE1B1E] text-white py-3 rounded-lg font-bold hover:bg-red-800 transition-colors">
              Verify & Login
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-[#1A2766] mt-4 hover:underline">
              Change Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
