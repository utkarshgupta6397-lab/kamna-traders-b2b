'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Key, Globe, Clock, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ZohoConnectionHealth() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/zoho/auth-status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load Zoho connection health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-48 mb-6"></div>;
  }

  if (!status) return null;

  const isHealthy = !status.isScopeMismatch && status.isConfigured;

  return (
    <div className={`rounded-xl border ${isHealthy ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'} shadow-sm overflow-hidden mb-6`}>
      <div className={`p-4 border-b ${isHealthy ? 'border-gray-100' : 'border-red-200'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {isHealthy ? <ShieldCheck className="text-emerald-500" /> : <ShieldAlert className="text-red-500" />}
          <div>
            <h2 className={`font-bold ${isHealthy ? 'text-gray-900' : 'text-red-900'}`}>
              Zoho Books Connection Health
            </h2>
            <p className={`text-xs ${isHealthy ? 'text-gray-500' : 'text-red-700'}`}>
              {isHealthy ? 'Connection is active and healthy.' : 'OAuth scope mismatch detected. Reauthorization required.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {!isHealthy && (
            <a 
              href="/api/admin/zoho/auth-url"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 shadow-sm"
            >
              <Key size={14} /> Reconnect OAuth
            </a>
          )}
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Organization ID</div>
          <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            <Globe size={14} className="text-gray-400" />
            {status.orgId || '-'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Scope Version</div>
          <div className="text-sm font-medium flex items-center gap-2">
            <span className={status.isScopeMismatch ? 'text-red-600' : 'text-emerald-600'}>v{status.currentVersion}</span>
            {status.isScopeMismatch && <span className="text-xs text-gray-500">→ v{status.requiredVersion} required</span>}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Granted Scopes</div>
          <div className="text-xs font-mono text-gray-600 truncate max-w-sm" title={status.grantedScopes}>
            {status.grantedScopes}
          </div>
        </div>
      </div>
    </div>
  );
}
