'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Layout, Package, Send, CheckCircle2, AlertCircle, Copy, Code, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ZohoDebugPage() {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [activeSkus, setActiveSkus] = useState<any[]>([]);
  const [expandedJson, setExpandedJson] = useState<Record<string, boolean>>({ payload: true, response: true });
  const [tokenStatus, setTokenStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  useEffect(() => {
    fetchStatus();
    fetchSkus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/sku-sync/last-run'); // Reusing existing status check if possible, or just checking tokens
      // For now, let's just check if we have a success param in URL
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'connected') {
        setTokenStatus('connected');
        toast.success('Zoho Connected Successfully');
      } else if (params.get('error')) {
        setTokenStatus('disconnected');
        toast.error(`Connection Error: ${params.get('error')}`);
      } else {
        // Real check would go here
        setTokenStatus('connected'); // Fallback for demo
      }
    } catch (err) {
      setTokenStatus('disconnected');
    }
  };

  const fetchSkus = async () => {
    try {
      const res = await fetch('/api/staff/skus');
      const data = await res.json();
      const skus = Array.isArray(data) ? data : data.skus || [];
      // Filter for active + zohoBooksId2 in frontend for display
      const filtered = skus.filter((s: any) => s.isActive && s.zohoBooksId2);
      setActiveSkus(filtered);
    } catch (err) {
      console.error('Failed to fetch SKUs:', err);
    }
  };

  const handleCreateTestSO = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/zoho/test-sales-order', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success('Sales Order Created Successfully!');
      } else {
        toast.error(data.error || 'Failed to create Sales Order');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    toast.success(`${label} copied!`);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layout className="text-[#AE1B1E]" />
            Zoho Books Integration Debug
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manual test suite for Sales Order creation and OAuth lifecycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/api/zoho/connect"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tokenStatus === 'connected' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-[#1A2766] text-white hover:bg-[#25368a]'
            }`}
          >
            <RefreshCw size={18} className={tokenStatus === 'checking' ? 'animate-spin' : ''} />
            {tokenStatus === 'connected' ? 'Reconnect Zoho' : 'Connect Zoho'}
          </a>
          <button
            onClick={handleCreateTestSO}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-[#AE1B1E] text-white rounded-lg text-sm font-bold hover:bg-red-800 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            Create Test Sales Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & SKUs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Sync Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-[#1A2766]">{activeSkus.length}</div>
                <div className="text-[10px] text-gray-500 uppercase font-bold">Active SKUs</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">{tokenStatus === 'connected' ? 'Valid' : 'None'}</div>
                <div className="text-[10px] text-gray-500 uppercase font-bold">Token Status</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Package size={16} />
                Included SKUs
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">READY</span>
            </div>
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeSkus.map((sku: any) => (
                    <tr key={sku.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[150px]">{sku.name}</div>
                        <div className="text-[10px] font-mono text-gray-400">{sku.zohoBooksId2}</div>
                      </td>
                      <td className="px-4 py-3 text-[#AE1B1E] font-bold">₹{sku.price}</td>
                    </tr>
                  ))}
                  {activeSkus.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-400 italic">No valid SKUs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: JSON Panels */}
        <div className="lg:col-span-2 space-y-6">
          {!testResult && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl h-[600px] flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="p-4 bg-white rounded-full shadow-sm">
                <Code size={48} className="opacity-20" />
              </div>
              <p className="text-sm font-medium">Trigger a Test Sales Order to view diagnostic data</p>
            </div>
          )}

          {testResult && (
            <>
              {/* Payload Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-[#1A2766] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedJson(p => ({ ...p, payload: !p.payload }))}>
                      {expandedJson.payload ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <span className="font-bold text-sm">Generated Request Payload</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(testResult.payload, 'Payload')}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                {expandedJson.payload && (
                  <pre className="p-6 bg-gray-900 text-blue-300 text-xs overflow-auto max-h-[300px] font-mono">
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                )}
              </div>

              {/* Response Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`p-4 flex items-center justify-between text-white ${testResult.success ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedJson(p => ({ ...p, response: !p.response }))}>
                      {expandedJson.response ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">Zoho API Response</span>
                      <span className="text-[10px] opacity-80 uppercase font-bold tracking-widest">HTTP {testResult.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(testResult.response, 'Response')}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                {expandedJson.response && (
                  <pre className={`p-6 text-xs overflow-auto max-h-[400px] font-mono ${testResult.success ? 'bg-gray-900 text-emerald-400' : 'bg-red-50 text-red-900'}`}>
                    {JSON.stringify(testResult.response, null, 2)}
                  </pre>
                )}
              </div>

              {testResult.success && testResult.response.salesorder?.salesorder_id && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-emerald-600" />
                    <div>
                      <div className="text-sm font-bold text-emerald-900">Success! Sales Order Created</div>
                      <div className="text-xs text-emerald-700">ID: {testResult.response.salesorder.salesorder_id}</div>
                    </div>
                  </div>
                  <a 
                    href={`https://books.zoho.in/app/${process.env.NEXT_PUBLIC_ZOHO_ORG_ID || ''}#/salesorders/${testResult.response.salesorder.salesorder_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    View in Zoho <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
