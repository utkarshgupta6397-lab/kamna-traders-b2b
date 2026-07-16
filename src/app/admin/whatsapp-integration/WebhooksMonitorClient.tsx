'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, Activity, Zap, Info, Copy, ExternalLink, ShieldAlert, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhooksMonitorClientProps {
  webhooks: any[];
  config: {
    webhookUrl: string | null;
    cloudflareUrl: string | null;
    environment: string;
    verifyToken: string | null;
  };
  stats: {
    lastWebhook: Date | null;
    lastDelivery: Date | null;
    lastRead: Date | null;
    lastError: Date | null;
  }
}

export default function WebhooksMonitorClient({ webhooks, config, stats }: WebhooksMonitorClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleCopy = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleTestHealth = async () => {
    setTesting(true);
    try {
      const startTime = performance.now();
      const res = await fetch('/api/webhooks/whatsapp/health');
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      if (res.ok) {
        toast.success(`Webhook endpoint reachable! (${latency}ms)`);
      } else if (res.status === 404) {
        toast.error('Webhook endpoint returned 404. Ensure route exists.');
      } else if (res.status === 500) {
        toast.error('Webhook endpoint returned 500. Internal server error.');
      } else {
        toast.error(`Webhook endpoint returned ${res.status}.`);
      }
    } catch (e) {
      toast.error('Meta cannot reach your webhook. Tunnel URL unreachable or changed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Configuration Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1A2766]">Webhook Configuration</h3>
          {config.environment !== 'production' && !config.cloudflareUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
              <ShieldAlert size={14} /> Cloudflare tunnel not configured
            </span>
          )}
          {config.environment !== 'production' && config.cloudflareUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 size={14} /> Tunnel Active
            </span>
          )}
        </div>
        
        <div className="p-6 grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Webhook URL</span>
              <div className="flex items-center gap-2">
                <code className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md flex-1">
                  {config.webhookUrl || 'Not configured in environment'}
                </code>
                <button onClick={() => handleCopy(config.webhookUrl)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title="Copy URL">
                  <Copy size={16} />
                </button>
                <a href="/api/webhooks/whatsapp/health" target="_blank" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Open Endpoint">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Verify Token</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{config.verifyToken || '-'}</span>
                <button onClick={() => handleCopy(config.verifyToken)} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Environment</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{config.environment}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Tunnel</span>
              <span className="text-sm font-medium text-gray-900">{config.cloudflareUrl || 'None'}</span>
            </div>
            
            <button
              onClick={handleTestHealth}
              disabled={testing}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              {testing ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
              Test Webhook Endpoint
            </button>
          </div>
          
          <div className="space-y-6 border-l border-gray-100 pl-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Incoming Webhook</span>
              <span className="text-sm font-medium text-gray-900">{stats.lastWebhook ? format(new Date(stats.lastWebhook), 'MMM dd, yyyy HH:mm:ss') : 'Never'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Delivery Event</span>
              <span className="text-sm font-medium text-gray-900">{stats.lastDelivery ? format(new Date(stats.lastDelivery), 'MMM dd, yyyy HH:mm:ss') : 'Never'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Read Event</span>
              <span className="text-sm font-medium text-gray-900">{stats.lastRead ? format(new Date(stats.lastRead), 'MMM dd, yyyy HH:mm:ss') : 'Never'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Error</span>
              <span className="text-sm font-medium text-red-600">{stats.lastError ? format(new Date(stats.lastError), 'MMM dd, yyyy HH:mm:ss') : 'Never'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monitor Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1A2766]">Webhook Monitor</h3>
          <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {webhooks.length} Events
          </span>
        </div>
        
        {webhooks.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Activity size={48} className="text-gray-300 mb-4" />
            <h2 className="text-lg font-bold text-gray-800">No Webhooks Received</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">
              Webhook payloads will appear here in real-time as Meta sends them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Event Type</th>
                  <th className="px-6 py-3">Message ID (wamid)</th>
                  <th className="px-6 py-3">Result</th>
                  <th className="px-6 py-3 text-right">Raw payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {webhooks.map((wh) => {
                  const isExpanded = expandedId === wh.id;
                  
                  // Try to guess the event type
                  let eventType = 'Unknown';
                  let messageId = wh.matchedMessageId || '-';
                  
                  if (wh.body?.entry?.[0]?.changes?.[0]?.value) {
                    const val = wh.body.entry[0].changes[0].value;
                    if (val.statuses) {
                      eventType = `Status: ${val.statuses[0].status}`;
                      if (!messageId || messageId === '-') messageId = val.statuses[0].id;
                    } else if (val.messages) {
                      eventType = 'Incoming Message';
                      if (!messageId || messageId === '-') messageId = val.messages[0].id;
                    }
                  }

                  return (
                    <React.Fragment key={wh.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                          {format(new Date(wh.receivedAt), 'MMM dd, HH:mm:ss')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {eventType}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500 max-w-[200px] truncate">
                          {messageId}
                        </td>
                        <td className="px-6 py-4">
                          {wh.processingResult === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={12} /> Success
                            </span>
                          ) : wh.processingResult === 'FAILED_NO_MATCH' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Info size={12} /> Orphan (No Match)
                            </span>
                          ) : wh.processingResult === 'IGNORED_MESSAGE_OBJECT' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                              <Zap size={12} /> Ignored
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <XCircle size={12} /> {wh.processingResult || 'Failed'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => toggleExpand(wh.id)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
                          >
                            {isExpanded ? 'Hide JSON' : 'View JSON'}
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-gray-900 p-0">
                            <div className="p-4 max-h-[500px] overflow-y-auto">
                              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(wh.body, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
