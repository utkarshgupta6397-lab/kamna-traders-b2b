'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

export default function ResetPinButton({ mobile }: { mobile: string }) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm(`Are you sure you want to reset the PIN for ${mobile}? A WhatsApp message will be sent.`)) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('PIN reset and sent via WhatsApp');
      } else {
        toast.error(data.error || 'Failed to reset PIN');
      }
    } catch (error) {
      toast.error('Network error');
    }
    setLoading(false);
  };

  return (
    <button 
      type="button" 
      onClick={handleReset}
      disabled={loading}
      className="text-amber-500 hover:bg-amber-50 p-1.5 rounded transition-colors disabled:opacity-50"
      title="Reset PIN via WhatsApp"
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
    </button>
  );
}
