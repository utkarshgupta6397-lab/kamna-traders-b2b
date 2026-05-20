'use client';

import { useState } from 'react';
import { Layout, Search, User, FileJson, AlertCircle, RefreshCw, Copy, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

type CustomerStatementCustomer = {
  contactId: string;
  contactName: string;
  companyName?: string;
  gstNo?: string;
  mobile?: string;
  email?: string;
  outstandingReceivable?: number;
  outstandingReceivableFormatted?: string;
  billingAddress?: string;
};

export default function CustomerStatementDebugPage() {
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: CustomerStatementCustomer; raw?: any; error?: string } | null>(null);
  const [expandedJson, setExpandedJson] = useState(true);

  const handleFetch = async () => {
    if (!customerId || !/^\d{19}$/.test(customerId.trim())) {
      toast.error('Please enter a valid 19-digit Zoho Customer ID.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/customer-statement/customer?customerId=${encodeURIComponent(customerId.trim())}`);
      const data = await res.json();
      
      setResult(data);
      
      if (data.success) {
        toast.success('Customer fetched successfully!');
      } else {
        toast.error(data.error || 'Failed to fetch customer.');
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
            <Layout className="text-[#1A2766]" />
            Customer Statement Debugger
          </h1>
          <p className="text-sm text-gray-500 mt-1">Internal tool to fetch and inspect customer master details from Zoho Books.</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full max-w-md">
          <label className="block text-sm font-bold text-gray-700 mb-2">Zoho Customer ID</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="e.g. 123456789000012345"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent transition-all"
            />
          </div>
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-[#1A2766] text-white rounded-lg font-bold hover:bg-[#25368a] transition-all disabled:opacity-50 h-[42px]"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Fetch Customer'}
        </button>
      </div>

      {/* Results Section */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Section 1 - Normalized Customer Data */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <User size={16} />
                  Normalized Customer Data
                </h3>
                {result.success ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
                ) : (
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">FAILED</span>
                )}
              </div>
              <div className="p-6">
                {result.success && result.data ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Contact Name</div>
                        <div className="font-medium text-gray-900">{result.data.contactName || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Company Name</div>
                        <div className="font-medium text-gray-900">{result.data.companyName || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Mobile</div>
                        <div className="font-medium text-gray-900">{result.data.mobile || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Email</div>
                        <div className="font-medium text-gray-900">{result.data.email || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">GST No</div>
                        <div className="font-medium text-gray-900">{result.data.gstNo || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Outstanding Receivable</div>
                        <div className="font-medium text-red-600">
                          {result.data.outstandingReceivableFormatted || `₹${result.data.outstandingReceivable || '0.00'}`}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Zoho Contact ID</div>
                        <div className="font-mono text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100 inline-block mt-1">
                          {result.data.contactId}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Billing Address</div>
                        <div className="text-sm text-gray-700 mt-1 whitespace-pre-line bg-gray-50 p-3 rounded-lg border border-gray-100">
                          {result.data.billingAddress || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                    <AlertCircle size={20} />
                    <span className="font-medium">{result.error || 'Unknown error occurred.'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2 - Raw Zoho Response */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`p-4 flex items-center justify-between text-white ${result.success ? 'bg-emerald-600' : 'bg-red-600'}`}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpandedJson(!expandedJson)} className="focus:outline-none">
                    {expandedJson ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm flex items-center gap-2">
                      <FileJson size={16} />
                      Raw Zoho Response
                    </span>
                    <span className="text-[10px] opacity-80 uppercase font-bold tracking-widest">
                      {result.success ? 'SUCCESS' : 'ERROR'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => copyToClipboard(result.raw || result, 'Raw Response')}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              {expandedJson && (
                <div className="bg-gray-900 border-t border-gray-800">
                  <pre className={`p-6 text-xs overflow-auto max-h-[600px] font-mono ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {JSON.stringify(result.raw || result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
