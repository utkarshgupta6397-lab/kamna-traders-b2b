'use client';

import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

interface SnoozeModalProps {
  task: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SnoozeModal({ task, onClose, onSuccess }: SnoozeModalProps) {
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  
  const submitSnooze = async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/solar-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dateStr })
      });
      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFutureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const quickOptions = [
    { label: 'Tomorrow', date: getFutureDate(1) },
    { label: 'Day After Tomorrow', date: getFutureDate(2) },
    { label: '+3 Days', date: getFutureDate(3) },
    { label: 'Next Week', date: getFutureDate(7) },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-[111] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-900">Snooze Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-2">
          {!showCustom ? (
            <div className="flex flex-col">
              {quickOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => submitSnooze(opt.date)}
                  disabled={loading}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors border-b border-gray-100 last:border-0"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2"
              >
                <Calendar size={14} /> Custom Date...
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Date</label>
                <input
                  required
                  type="date"
                  autoFocus
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => customDate && submitSnooze(customDate)}
                  disabled={loading || !customDate}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Snooze'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
