'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, MessageCircle, AlertCircle, RefreshCw, CheckCircle2, Circle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommunicationWidgetProps {
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  className?: string;
}

const FINAL_STATUSES = ['SENT', 'DELIVERED', 'READ', 'FAILED'];

const PROGRESS_STEPS = [
  { label: 'Queued', match: ['QUEUED'] },
  { label: 'Validated', match: ['VALIDATED'] },
  { label: 'Processing', match: ['PROCESSING', 'SENDING'] },
  { label: 'Provider Accepted', match: ['META_ACCEPTED'] },
  { label: 'Sent', match: ['SENT', 'DELIVERED', 'READ'] }
];

export function CommunicationWidget({ customerId, orderId, invoiceId, className = '' }: CommunicationWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLatest = async () => {
    try {
      const query = new URLSearchParams();
      if (customerId) query.set('customerId', customerId);
      if (orderId) query.set('orderId', orderId);
      if (invoiceId) query.set('invoiceId', invoiceId);

      const res = await fetch(`/api/communications/latest?${query.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch latest');
      
      return data.message;
    } catch (err: any) {
      console.error('Failed to fetch latest:', err);
      return null;
    }
  };

  const fetchStatus = async (messageId: string) => {
    try {
      const res = await fetch(`/api/communications/status/${messageId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
      return data.message;
    } catch (err: any) {
      console.error('Failed to fetch status:', err);
      return null;
    }
  };

  const startPolling = (messageId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      const updatedMessage = await fetchStatus(messageId);
      if (updatedMessage) {
        setMessage(updatedMessage);
        setLastUpdated(new Date());
        
        if (FINAL_STATUSES.includes(updatedMessage.status)) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      }
    }, 5000);
  };

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!customerId && !orderId && !invoiceId) return;
      
      setLoading(true);
      setError(null);
      
      const latestMessage = await fetchLatest();
      
      if (mounted) {
        setLoading(false);
        if (latestMessage) {
          setMessage(latestMessage);
          setLastUpdated(new Date());
          if (!FINAL_STATUSES.includes(latestMessage.status)) {
            startPolling(latestMessage.messageId);
          }
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [customerId, orderId, invoiceId]);

  if (!customerId && !orderId && !invoiceId) {
    return null;
  }

  const getStepIndex = (status: string) => {
    const index = PROGRESS_STEPS.findIndex(step => step.match.includes(status));
    return index !== -1 ? index : 0;
  };

  const renderProgress = () => {
    if (!message || message.status === 'FAILED') return null;
    
    const currentIndex = getStepIndex(message.status);

    return (
      <div className="flex items-center gap-1.5 mt-2">
        {PROGRESS_STEPS.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          
          return (
            <div key={step.label} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 ${isCurrent ? 'opacity-100' : 'opacity-70'}`}>
                {isCompleted ? (
                  <CheckCircle2 size={12} className={idx === 3 ? 'text-green-500' : 'text-blue-500'} />
                ) : (
                  <Circle size={12} className="text-slate-300" />
                )}
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isCompleted ? (idx === 3 ? 'text-green-700' : 'text-blue-700') : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {idx < PROGRESS_STEPS.length - 1 && (
                <div className={`w-3 h-px ${isCompleted ? 'bg-blue-300' : 'bg-slate-200'}`}></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3 overflow-hidden">
        <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0 mt-0.5 border border-blue-100">
          <MessageCircle size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Communication Gateway</span>
            {message && !FINAL_STATUSES.includes(message.status) && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                Polling Active
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
              <RefreshCw size={12} className="animate-spin" />
              <span>Checking status...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          ) : message ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    message.status === 'DELIVERED' || message.status === 'READ' || message.status === 'SENT' ? 'bg-green-50 text-green-700 border-green-200' :
                    message.status === 'META_ACCEPTED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    message.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                    {message.status}
                  </span>
                </span>
                <span className="flex items-center gap-1 truncate font-medium">
                  {message.channel}
                </span>
                {lastUpdated && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
                    <Clock size={10} />
                    Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                  </span>
                )}
              </div>
              
              {renderProgress()}
            </div>
          ) : (
            <div className="mt-1 text-slate-500 text-xs italic">
              No recent communications found.
            </div>
          )}
        </div>
      </div>
      
      {message && (
        <a 
          href={`http://localhost:3004/communications/${message.messageId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-[#1A2766] hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">View Timeline</span>
        </a>
      )}
    </div>
  );
}
