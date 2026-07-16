'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, CheckCircle2, Clock, XCircle, AlertTriangle, Copy, Eye } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TemplateDrawer from './TemplateDrawer';
import TemplateTestModal from './TemplateTestModal';
import { Send } from 'lucide-react';

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [testModalTemplate, setTestModalTemplate] = useState<any | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/communications/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || []);
      setStats(data.stats);
      setTestPhoneNumber(data.testPhoneNumber || null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/communications/templates/sync', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Sync complete. Added: ${data.added}, Updated: ${data.updated}, Disabled: ${data.disabled}`);
        await fetchTemplates();
      } else {
        toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSingleSync = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/communications/templates/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Template updated.");
        await fetchTemplates();
      } else {
        toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCopy = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(name);
    toast.success(`Copied: ${name}`);
  };

  const getStatusBadge = (t: any) => {
    const isRefreshing = refreshingIds.has(t.id);
    switch (t.status) {
      case 'APPROVED': return <span title="This template is ready to use." className="flex w-fit items-center gap-1 text-[10px] uppercase font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200"><CheckCircle2 size={10}/> Approved</span>;
      case 'PENDING': return (
        <span title="This template is awaiting Meta approval." className="flex w-fit items-center gap-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <Clock size={10}/> Pending
          <button 
            onClick={(e) => handleSingleSync(e, t.id)}
            disabled={isRefreshing}
            className="ml-1 text-amber-600 hover:text-amber-900 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </span>
      );
      case 'REJECTED': return <span title="Meta rejected this template." className="flex w-fit items-center gap-1 text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200"><XCircle size={10}/> Rejected</span>;
      case 'DISABLED': return <span className="flex w-fit items-center gap-1 text-[10px] uppercase font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"><AlertTriangle size={10}/> Disabled</span>;
      default: return <span className="flex w-fit text-[10px] uppercase font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{t.status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">WhatsApp Templates</h2>
            <p className="text-xs text-gray-500 font-medium">
              Last Sync: {templates.length > 0 ? format(new Date(templates[0].lastSyncedAt), 'PPp') : 'Never'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-[#1A2766] hover:bg-[#121c4a] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing with Meta...' : 'Sync Templates'}
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Templates</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved</p>
            <p className="mt-1 text-2xl font-black text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending</p>
            <p className="mt-1 text-2xl font-black text-amber-500">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rejected</p>
            <p className="mt-1 text-2xl font-black text-red-500">{stats.rejected}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Languages</p>
            <p className="mt-1 text-2xl font-black text-blue-600">{stats.languages}</p>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <RefreshCw className="animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-200 mb-3" />
            <h3 className="text-base font-bold text-gray-800">No Templates Found</h3>
            <p className="text-sm text-gray-500 mt-1">Click the Sync Templates button to fetch from Meta.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Template Name</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Language</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Header Type</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Last Synced</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t: any) => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="text-sm font-bold text-gray-900">{t.name}</div>
                      <div className="text-[10px] font-mono text-gray-400 mt-0.5">{t.metaTemplateId}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {t.language}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {getStatusBadge(t)}
                    </td>
                    <td className="px-5 py-3">
                      {t.headerType ? (
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {t.headerType}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500 font-medium whitespace-nowrap">
                      {format(new Date(t.lastSyncedAt), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleCopy(e, t.name)}
                          title="Copy Template Name"
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleSingleSync(e, t.id)}
                          disabled={refreshingIds.has(t.id)}
                          title="Refresh Status"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={refreshingIds.has(t.id) ? 'animate-spin text-blue-600' : ''} />
                        </button>
                        <button 
                          onClick={() => setSelectedTemplate(t)}
                          title="View Details"
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTestModalTemplate(t);
                          }}
                          disabled={t.status !== 'APPROVED'}
                          title="Send Test Message"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TemplateDrawer 
        template={selectedTemplate} 
        onClose={() => setSelectedTemplate(null)} 
      />

      <TemplateTestModal
        template={testModalTemplate}
        isOpen={!!testModalTemplate}
        onClose={() => setTestModalTemplate(null)}
        testPhoneNumber={testPhoneNumber}
      />
    </div>
  );
}
