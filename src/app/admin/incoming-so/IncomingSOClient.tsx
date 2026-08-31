'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Copy, Check, Clock, ShieldAlert, Wifi, Code2, AlertTriangle, FileDown, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestLog {
  id: string;
  salesorder_id: string;
  status: string;
  error_message: string | null;
  received_at: string;
}

export default function IncomingSOClient({ endpoint: initialEndpoint, apiKey: initialApiKey, hasValidPublicUrl: initialHasValidUrl, isProduction, initialBaseUrl }: { endpoint: string, apiKey: string, hasValidPublicUrl: boolean, isProduction: boolean, initialBaseUrl: string }) {
  
  const [currentEndpoint, setCurrentEndpoint] = useState(initialEndpoint);
  const [currentApiKey, setCurrentApiKey] = useState(initialApiKey);
  const [currentHasValidUrl, setCurrentHasValidUrl] = useState(initialHasValidUrl);
  
  const [editMode, setEditMode] = useState(false);
  const [formBaseUrl, setFormBaseUrl] = useState(initialBaseUrl);
  const [formApiKey, setFormApiKey] = useState(initialApiKey === 'NOT_CONFIGURED' ? '' : initialApiKey);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveConfig = async () => {
    // Validation
    let cleanUrl = formBaseUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    // Prevent accidental inclusion of API path
    if (cleanUrl.endsWith('/api/dispatch/incoming-so')) {
      cleanUrl = cleanUrl.replace('/api/dispatch/incoming-so', '');
    }

    const urlError = validateUrl(cleanUrl);
    if (urlError) {
      toast.error(urlError);
      return;
    }

    if (!formApiKey.trim()) {
      toast.error('API Key cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const p1 = fetch('/api/admin/incoming-so/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'INCOMING_SO_PUBLIC_BASE_URL', value: cleanUrl })
      });
      const p2 = fetch('/api/admin/incoming-so/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'INCOMING_SO_API_KEY', value: formApiKey })
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      const data1 = await res1.json();
      const data2 = await res2.json();

      if (!res1.ok) throw new Error(data1.error || 'Failed to save Base URL');
      if (!res2.ok) throw new Error(data2.error || 'Failed to save API Key');

      toast.success('Configuration saved successfully');
      
      const newUrl = data1.value;
      const newKey = data2.value;
      
      setCurrentApiKey(newKey);
      
      if (newUrl) {
        setCurrentEndpoint(newUrl + '/api/dispatch/incoming-so');
        setCurrentHasValidUrl(true);
      } else {
        setCurrentEndpoint('https://CONFIGURE_INCOMING_SO_PUBLIC_BASE_URL/api/dispatch/incoming-so');
        setCurrentHasValidUrl(false);
      }
      
      setEditMode(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [testStatus, setTestStatus] = useState<'Not Tested' | 'Testing' | 'Connected' | 'Connection Failed'>('Not Tested');
  const [testMessage, setTestMessage] = useState('');

  const validateUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return 'URL must use HTTPS protocol';
      return null;
    } catch (e) {
      return 'Invalid URL format';
    }
  };

  const handleTestConnection = async () => {
    if (!currentHasValidUrl || currentApiKey === 'NOT_CONFIGURED') {
      toast.error('Please save a valid configuration first.');
      return;
    }
    setTestStatus('Testing');
    setTestMessage('');
    try {
      const res = await fetch(currentEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': currentApiKey
        },
        body: JSON.stringify({ test_connection: true })
      });
      
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setTestStatus('Connected');
        setTestMessage(data.message || 'Connected successfully');
      } else {
        setTestStatus('Connection Failed');
        setTestMessage(data?.error || `HTTP Error ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('Connection Failed');
      setTestMessage(err.message || 'Network error');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/incoming-so');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        toast.error('Failed to load incoming SO logs.');
      }
    } catch (err) {
      toast.error('Network error loading logs.');
    } finally {
      setLoading(false);
    }
  };

  const [fetchingSoId, setFetchingSoId] = useState<string | null>(null);
  const [soDetails, setSoDetails] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleFetchDetails = async (salesorder_id: string) => {
    setFetchingSoId(salesorder_id);
    try {
      const res = await fetch(`/api/admin/incoming-so/${salesorder_id}/zoho-details`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSoDetails(data.data);
        setDrawerOpen(true);
      } else {
        toast.error(data.error || 'Failed to fetch details');
      }
    } catch (err: any) {
      toast.error('Network error while fetching details');
    } finally {
      setFetchingSoId(null);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const delugeSnippet = `// Zoho Books Deluge: Push to Dispatch MVP
// Add this to your Custom Button script

result = Map();

salesorder_id = salesorder.get("salesorder_id");

if(salesorder_id == null || salesorder_id == "")
{
    result.put("success", false);
    result.put("message", "Error: No Sales Order ID found.");
    return result;
}

headerMap = Map();
headerMap.put("X-API-Key", "${currentApiKey}");
headerMap.put("Content-Type", "application/json");

payload = Map();
payload.put("salesorder_id", salesorder_id);

response = invokeurl
[
    url :"${currentEndpoint}"
    type :POST
    parameters: payload.toString()
    headers: headerMap
    detailed: true
];

info response;

responseCode = response.get("responseCode");
responseText = response.get("responseText");

if (responseCode == 200 || responseCode == 201) {
    // Check if the ERP explicitly returned { "success": true }
    // Optional depending on Zoho's JSON parsing, but checking HTTP 200 is a minimum safe assumption
    result.put("success", true);
    result.put("message", "Sales Order pushed to Dispatch");
} else {
    result.put("success", false);
    result.put("message", "Dispatch failed (HTTP " + responseCode + "): " + responseText);
}

return result;`;

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    return logs.filter(l => l.salesorder_id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [logs, searchQuery]);

  const totalReceived = logs.filter(l => l.status === 'RECEIVED').length;
  
  const todayReceived = logs.filter(l => {
    if (l.status !== 'RECEIVED') return false;
    const d = new Date(l.received_at);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;
  
  const lastReceivedLog = logs.find(l => l.status === 'RECEIVED');
  const lastReceivedText = lastReceivedLog 
    ? new Date(lastReceivedLog.received_at).toLocaleString() 
    : 'No requests yet';

  const connectionActive = totalReceived > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Received</span>
            <FileDown size={16} />
          </div>
          <span className="text-2xl font-black text-gray-900">{totalReceived}</span>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
            <Clock size={16} />
          </div>
          <span className="text-2xl font-black text-blue-600">{todayReceived}</span>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Last Received</span>
            <RefreshCw size={16} />
          </div>
          <span className="text-sm font-bold text-gray-900 truncate mt-1">{lastReceivedText}</span>
        </div>

        <div className={`border rounded-xl p-4 flex flex-col justify-between shadow-sm ${connectionActive ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`flex items-center justify-between mb-2 ${connectionActive ? 'text-emerald-600' : 'text-gray-500'}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Connection Status</span>
            <Wifi size={16} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${connectionActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={`text-sm font-bold ${connectionActive ? 'text-emerald-700' : 'text-gray-700'}`}>
              {connectionActive ? 'Active' : 'Awaiting Request'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Warning */}
      {!currentHasValidUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-4 items-start shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full flex-shrink-0 mt-0.5">
            <AlertTriangle size={20} className="text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900">Action Required: Public API URL not configured</h3>
            <p className="text-sm text-amber-700 mt-1">
              Zoho Books operates in the cloud and cannot send requests directly to a local development machine. 
              To receive Incoming Sales Orders, you must configure a publicly reachable HTTPS URL for this ERP deployment.
            </p>
            <p className="text-xs font-mono text-amber-800 bg-amber-100 px-2 py-1 rounded inline-block mt-3 border border-amber-200">
              INCOMING_SO_PUBLIC_BASE_URL
            </p>
          </div>
        </div>
      )}

      
      {/* API Connection Panel */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Code2 size={16} className="text-gray-400" />
              API Connection Details
            </h3>
            {isProduction && (
              <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-200 px-2 py-0.5 rounded">Production (Read-Only)</span>
            )}
            {!isProduction && (
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-100 px-2 py-0.5 rounded">Local Development</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isProduction && !editMode && (
              <button onClick={() => setEditMode(true)} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 transition-colors">
                Edit Configuration
              </button>
            )}
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase">Sensitive</span>
          </div>
        </div>
        
        {editMode ? (
          <div className="p-5 space-y-4 bg-gray-50 border-b border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Public Base URL</label>
              <input 
                type="url" 
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://your-public-tunnel.trycloudflare.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-500 mt-1">Enter the public HTTPS URL that Zoho Books can reach. Do not enter localhost or a local IP address.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Incoming SO API Key</label>
              <input 
                type="text" 
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-500 mt-1">This key is required in the X-API-Key header sent by Zoho Books.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button disabled={saving} onClick={handleSaveConfig} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              <button disabled={saving} onClick={() => setEditMode(false)} className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Incoming SO API Endpoint</label>
                <div className="flex">
                  <input 
                    type="text" 
                    readOnly 
                    value={currentHasValidUrl ? currentEndpoint : 'Awaiting configuration...'} 
                    className={`flex-1 border border-gray-200 rounded-l-lg px-3 py-2 text-sm font-mono focus:outline-none ${!currentHasValidUrl ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-700'}`}
                  />
                  <button 
                    onClick={() => handleCopy(currentEndpoint, 'Endpoint')}
                    className="bg-gray-100 hover:bg-gray-200 border border-l-0 border-gray-200 rounded-r-lg px-3 flex items-center justify-center transition-colors text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy Endpoint"
                    disabled={!currentHasValidUrl}
                  >
                    {copiedField === 'Endpoint' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><ShieldAlert size={12} className="text-red-500" /> API Key</span>
                  <button onClick={() => setShowApiKey(!showApiKey)} className="text-[10px] text-blue-600 font-medium">{showApiKey ? 'Hide' : 'Reveal'}</button>
                </label>
                <div className="flex">
                  <input 
                    type={showApiKey ? 'text' : 'password'} 
                    readOnly 
                    value={currentApiKey === 'NOT_CONFIGURED' ? 'Missing Configuration' : currentApiKey} 
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-l-lg px-3 py-2 text-sm text-gray-700 font-mono focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopy(currentApiKey, 'API Key')}
                    className="bg-gray-100 hover:bg-gray-200 border border-l-0 border-gray-200 rounded-r-lg px-3 flex items-center justify-center transition-colors text-gray-600"
                    disabled={currentApiKey === 'NOT_CONFIGURED'}
                    title="Copy API Key"
                  >
                    {copiedField === 'API Key' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Provide this to the Zoho Books Deluge script as the X-API-Key header.</p>
              </div>

              {/* Test Connection Section */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleTestConnection}
                    disabled={testStatus === 'Testing' || !currentHasValidUrl || currentApiKey === 'NOT_CONFIGURED'}
                    className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {testStatus === 'Testing' ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
                    Test Connection
                  </button>
                  {testStatus !== 'Not Tested' && (
                    <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                      testStatus === 'Testing' ? 'text-gray-500' :
                      testStatus === 'Connected' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {testStatus === 'Connected' ? <Check size={12} /> : 
                       testStatus === 'Connection Failed' ? <AlertTriangle size={12} /> : null}
                      {testStatus}
                    </span>
                  )}
                </div>
                {testMessage && (
                  <span className={`text-[10px] truncate max-w-[150px] ${testStatus === 'Connected' ? 'text-emerald-600' : 'text-red-500'}`} title={testMessage}>
                    {testMessage}
                  </span>
                )}
              </div>
            </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Zoho Books Deluge Setup</label>
              <button 
                onClick={() => handleCopy(delugeSnippet, 'Deluge Script')}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase bg-blue-50 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                disabled={!currentHasValidUrl}
              >
                {copiedField === 'Deluge Script' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Code</>}
              </button>
            </div>
            <pre className={`${!currentHasValidUrl ? 'opacity-50' : ''} bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded-lg text-[11px] font-mono overflow-x-auto h-[170px] border border-gray-800`}>
              {delugeSnippet}
            </pre>
          </div>
        </div>
      </div>


      {/* Queue Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-gray-800 text-sm">Incoming Request Queue</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search by SO ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1A2766]/30 focus:border-[#1A2766]"
              />
            </div>
            <button 
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Request #</th>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Sales Order ID</th>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Error / Details</th>
                <th className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-gray-400" />
                        <span className="text-sm">Loading requests...</span>
                      </div>
                    ) : logs.length === 0 ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                          <FileDown size={24} className="text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-700">No incoming Sales Orders yet</p>
                        <p className="text-xs text-gray-400 mt-1">Sales Orders sent from Zoho Books using the Push to Dispatch button will appear here.</p>
                      </div>
                    ) : (
                      <span className="text-sm">No results match your search.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">...{log.id.slice(-6)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-800 font-mono">{log.salesorder_id}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{new Date(log.received_at).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      {log.status === 'RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          <Check size={10} strokeWidth={3} /> Received
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          <AlertTriangle size={10} strokeWidth={2} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-xs truncate" title={log.error_message || ''}>
                      {log.error_message || <span className="text-gray-300 italic">None</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {log.salesorder_id && /^\d+$/.test(log.salesorder_id) ? (
                        <button
                          onClick={() => handleFetchDetails(log.salesorder_id)}
                          disabled={fetchingSoId === log.salesorder_id}
                          className="inline-flex items-center gap-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {fetchingSoId === log.salesorder_id ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                          Fetch Details
                        </button>
                      ) : (
                        <button
                          disabled
                          title="Invalid or missing Sales Order ID"
                          className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-400 px-3 py-1.5 rounded text-xs font-medium cursor-not-allowed opacity-60"
                        >
                          <Search size={12} />
                          Fetch Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zoho Details Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Sales Order Details</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50">
              {soDetails ? (
                <>
                  {/* Summary */}
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-500 block">SO Number</span><span className="font-semibold text-gray-900">{soDetails.salesorder_number || '-'}</span></div>
                      <div><span className="text-xs text-gray-500 block">Reference</span><span className="font-semibold text-gray-900">{soDetails.reference_number || '-'}</span></div>
                      <div><span className="text-xs text-gray-500 block">Status</span><span className="font-semibold text-gray-900">{soDetails.status || '-'}</span></div>
                      <div><span className="text-xs text-gray-500 block">Date</span><span className="font-semibold text-gray-900">{soDetails.date || '-'}</span></div>
                      <div><span className="text-xs text-gray-500 block">Amount</span><span className="font-semibold text-gray-900">{soDetails.currency_code} {soDetails.total}</span></div>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Customer Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-500 block">Name</span><span className="font-semibold text-gray-900">{soDetails.customer_name || '-'}</span></div>
                      <div><span className="text-xs text-gray-500 block">Email</span><span className="font-semibold text-gray-900">{soDetails.email || '-'}</span></div>
                    </div>
                  </div>

                  {/* Line Items */}
                  {soDetails.line_items && soDetails.line_items.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Line Items</h3></div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-2 text-xs font-medium text-gray-500">Item</th>
                              <th className="px-5 py-2 text-xs font-medium text-gray-500">Qty</th>
                              <th className="px-5 py-2 text-xs font-medium text-gray-500 text-right">Rate</th>
                              <th className="px-5 py-2 text-xs font-medium text-gray-500 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {soDetails.line_items.map((item: any) => (
                              <tr key={item.item_id}>
                                <td className="px-5 py-3">
                                  <div className="font-medium text-gray-900">{item.name}</div>
                                  <div className="text-xs text-gray-500">{item.sku}</div>
                                </td>
                                <td className="px-5 py-3">{item.quantity}</td>
                                <td className="px-5 py-3 text-right">{item.rate}</td>
                                <td className="px-5 py-3 text-right font-medium">{item.item_total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No details available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
