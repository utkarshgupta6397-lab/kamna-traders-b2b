'use client';

import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, AlertCircle, CheckCircle2, Play, Check, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ZohoCreatorIntegrationClient() {
  const [config, setConfig] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/staff/settings/zoho-creator');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setBaseUrl(data.baseUrl);
      }
    } catch (e) {
      console.error('Failed to load Zoho config', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure you want to regenerate the Bearer Token? The old token will immediately stop working, breaking any existing integration.')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch('/api/staff/settings/zoho-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        toast.success('Token regenerated successfully.');
      } else {
        toast.error('Failed to regenerate token.');
      }
    } catch (e) {
      console.error('Error regenerating token', e);
      toast.error('An error occurred while regenerating the token.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleTestApi = async () => {
    if (!endpointUrl || !config?.bearerToken) {
      toast.error('API Endpoint or Bearer Token missing.');
      return;
    }
    
    setTestStatus('loading');
    setTestResult(null);
    const startTime = Date.now();
    
    console.log('[ZOHO-CREATOR-API] ADMIN_API_TEST_START');

    try {
      const res = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.bearerToken}`
        }
      });
      
      const duration = Date.now() - startTime;
      
      if (res.ok) {
        const data = await res.json();
        const count = data?.meta?.count ?? data?.data?.length ?? 0;
        setTestStatus('success');
        setTestResult(`API Connected — ${count} products returned — HTTP ${res.status} — ${duration} ms`);
        console.log('[ZOHO-CREATOR-API] ADMIN_API_TEST_SUCCESS', { duration, count, status: res.status });
      } else {
        setTestStatus('error');
        setTestResult(`API Test Failed — HTTP ${res.status} ${res.statusText}`);
        console.log('[ZOHO-CREATOR-API] ADMIN_API_TEST_FAILED', { duration, status: res.status });
      }
    } catch (e: any) {
      const duration = Date.now() - startTime;
      setTestStatus('error');
      setTestResult(`API Test Failed — Network Error or CORS`);
      console.log('[ZOHO-CREATOR-API] ADMIN_API_TEST_FAILED', { duration, error: e.message });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Zoho Creator configuration...</div>;
  }

  const endpointUrl = baseUrl ? `${baseUrl}/api/integrations/zoho-creator/solar-products` : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Zoho Creator API</h2>
              <p className="text-sm text-gray-500 mt-1">Manage the Solar Products GET API integration endpoint and credentials.</p>
            </div>
            {config ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 size={14} /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={14} /> Not Configured
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Environment & Endpoint */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Endpoint Configuration</h3>
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Base Environment URL (ERP_PUBLIC_BASE_URL)</label>
                {baseUrl ? (
                  <div className="text-sm font-mono text-gray-800">{baseUrl}</div>
                ) : (
                  <div className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <AlertCircle size={16} /> Configuration Missing
                  </div>
                )}
              </div>

              {endpointUrl && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Solar Products API Endpoint</label>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded">GET</span>
                    <code className="flex-1 block px-3 py-2 bg-white rounded border border-gray-200 text-sm text-gray-800 overflow-x-auto">
                      {endpointUrl}
                    </code>
                    <button 
                      onClick={() => handleCopy(endpointUrl, 'API URL')}
                      className="p-2 text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded hover:bg-blue-50 transition-colors"
                      title="Copy URL"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={handleTestApi}
                      disabled={testStatus === 'loading'}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Play size={16} className={testStatus === 'loading' ? 'animate-pulse' : ''} />
                      Test API
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Use Test API to verify the authenticated endpoint, or copy the URL for Zoho Creator configuration. Note: Direct browser visits will return 401 Unauthorized without the token.
                  </p>
                  
                  {testStatus !== 'idle' && (
                    <div className={`mt-4 p-3 rounded text-sm flex items-start gap-2 border ${testStatus === 'loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : testStatus === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {testStatus === 'loading' && <RefreshCw size={18} className="animate-spin mt-0.5" />}
                      {testStatus === 'success' && <Check size={18} className="mt-0.5" />}
                      {testStatus === 'error' && <XCircle size={18} className="mt-0.5" />}
                      <span className="font-medium">{testStatus === 'loading' ? 'Testing API...' : testResult}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Authentication</h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Bearer Token</span>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Token</label>
                {config?.bearerToken ? (
                  <div className="flex items-center gap-3">
                    <code className="flex-1 block px-3 py-2 bg-white rounded border border-gray-200 text-sm text-gray-800 break-all">
                      {config.bearerToken}
                    </code>
                    <button 
                      onClick={() => handleCopy(config.bearerToken, 'Bearer Token')}
                      className="p-2 text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded hover:bg-blue-50 transition-colors"
                      title="Copy Token"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No token generated yet.</div>
                )}
              </div>

              {config?.lastTokenGeneratedAt && (
                <div className="text-xs text-gray-500">
                  Last generated on: {new Date(config.lastTokenGeneratedAt).toLocaleString()}
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
                  {isRegenerating ? 'Generating...' : config ? 'Regenerate Token' : 'Generate Token'}
                </button>
                <p className="text-xs text-amber-600 mt-2">
                  Warning: Regenerating will immediately invalidate the existing token.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
