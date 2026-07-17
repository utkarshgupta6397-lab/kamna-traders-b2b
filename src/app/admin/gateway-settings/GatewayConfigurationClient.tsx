'use client';

import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, CheckCircle, RefreshCw, Server } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GatewayConfigurationClient() {
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('NOT_TESTED');
  const [lastConnectionTest, setLastConnectionTest] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/gateway-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setGatewayUrl(data.config.gatewayUrl || '');
          setApiToken(data.config.apiToken || '');
          setConnectionStatus(data.config.connectionStatus || 'NOT_TESTED');
          setLastConnectionTest(data.config.lastConnectionTest || null);
        }
      }
    } catch (error) {
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/gateway-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayUrl, apiToken })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Gateway Settings Saved');
        setConnectionStatus(data.config.connectionStatus);
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/admin/gateway-settings/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Connection Successful!');
        setConnectionStatus('CONNECTED');
      } else {
        toast.error(`Connection Failed: ${data.error}`);
        setConnectionStatus('FAILED');
      }
      setLastConnectionTest(new Date().toISOString());
    } catch (error) {
      toast.error('Failed to test connection');
      setConnectionStatus('FAILED');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="animate-spin text-[#1A2766]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Server className="text-blue-600" size={20} />
            Kamna Event Gateway Configuration
          </h2>
          <p className="text-sm text-gray-500 mt-1">Configure the central communication gateway for the ERP.</p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Gateway URL</label>
              <input
                type="url"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="http://localhost:3004"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">API Token</label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Gateway JWT or Secret"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-600">Status:</div>
              {connectionStatus === 'CONNECTED' ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded border border-green-200 font-bold text-sm">
                  <CheckCircle size={16} /> Connected
                </div>
              ) : connectionStatus === 'FAILED' ? (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-1 rounded border border-red-200 font-bold text-sm">
                  <AlertTriangle size={16} /> Failed
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-1 rounded border border-gray-200 font-bold text-sm">
                  <Server size={16} /> Not Tested
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !gatewayUrl || !apiToken}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {testing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Test Connection
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#1A2766] hover:bg-[#121c4a] text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                Save Configuration
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
