'use client';

import { useState } from 'react';
import { Database, Terminal, AlertCircle, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminBankingDebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFetchRawFeed = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/banking/raw');
      const json = await res.json();
      setResult({ status: res.status, json });
    } catch (err: any) {
      setResult({ status: 'Network Error', json: { success: false, error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result?.json) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.json, null, 2));
      toast.success('Raw response copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const isSuccess = result?.status === 200 && result?.json?.success;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-[#1A2766]" />
            Zoho Banking API Debugger
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Raw, untouched verification of Zoho Banking feed scopes and endpoints. No mock data.
          </p>
        </div>
        <button
          onClick={handleFetchRawFeed}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A2766] hover:bg-[#003347] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching...' : 'Fetch Raw Banking Feed'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scope Status Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <ShieldIcon /> OAuth Scope Status
          </h2>
          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-2 font-mono">
            <div>
              <span className="text-gray-500">Required Scope:</span>{' '}
              <span className="text-emerald-600 font-bold">ZohoBooks.banking.READ</span>
            </div>
            <div>
              <span className="text-gray-500">Active Config Scopes:</span>
              <ul className="text-xs text-gray-600 mt-1 pl-4 list-disc list-inside">
                <li>ZohoBooks.salesorders.CREATE</li>
                <li>ZohoBooks.items.READ</li>
                <li>ZohoBooks.contacts.READ</li>
                <li>ZohoBooks.invoices.READ</li>
                <li>ZohoBooks.customerpayments.READ</li>
                <li>ZohoBooks.bills.READ</li>
                <li className="text-emerald-600 font-bold">ZohoBooks.banking.READ</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            If API fails with 401, verify that you have authorized the Banking module on the Zoho consent screen.
          </p>
        </div>

        {/* Telemetry Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <Terminal size={16} /> API Telemetry
          </h2>
          {result ? (
            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-2 font-mono">
              {result.json?.telemetry?.accountName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Selected Account:</span>
                  <span className="text-emerald-600 font-bold truncate ml-4">
                    {result.json.telemetry.accountName}
                  </span>
                </div>
              )}
              {result.json?.telemetry?.accountId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Account ID:</span>
                  <span className="text-gray-900 font-mono">
                    {result.json.telemetry.accountId}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">HTTP Status:</span>
                <span className={isSuccess ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                  {result.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Endpoint Used:</span>
                <span className="text-blue-600 truncate ml-4" title={result.json?.telemetry?.endpoint}>
                  {result.json?.telemetry?.endpoint || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">HTTP Method:</span>
                <span className="text-gray-900 font-bold">
                  {result.json?.telemetry?.method || result.json?.debug?.method || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fetch Duration:</span>
                <span className="text-gray-900 font-medium">
                  {result.json?.telemetry?.durationMs ? `${result.json.telemetry.durationMs}ms` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Record Count:</span>
                <span className="text-gray-900 font-medium">
                  {result.json?.telemetry?.recordCount ?? '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
              Click fetch to view telemetry
            </div>
          )}
        </div>
      </div>

      {/* Raw Response Viewer */}
      <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-black/20">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : result ? (
              <AlertCircle size={16} className="text-red-500" />
            ) : (
              <Terminal size={16} className="text-gray-400" />
            )}
            Raw JSON Response
          </h2>
          {result && (
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Copy size={14} /> Copy JSON
            </button>
          )}
        </div>
        
        <div className="p-4 overflow-auto max-h-[500px]">
          {result ? (
            <pre className="text-xs font-mono text-emerald-400">
              {JSON.stringify(result.json, null, 2)}
            </pre>
          ) : (
            <div className="text-center text-gray-600 py-10 text-sm italic font-mono">
              Waiting for API request...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
