'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, MessageSquare, AlertTriangle, LayoutDashboard, Users } from 'lucide-react';

interface Communication {
  id: string;
  channel: string;
  direction: string;
  type: string;
  status: string;
  subject?: string;
  customerId: string;
  createdAt: string;
  sentAt?: string;
  createdBy: { name: string };
}
import TemplatesTab from './TemplatesTab';
import LogsTab from './LogsTab';
import { Database } from 'lucide-react';

export default function CommunicationsClient({ hasTemplatePermission }: { hasTemplatePermission?: boolean }) {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LOGS' | 'CUSTOMERS' | 'TEMPLATES'>('LOGS');
  
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  const TABS = [
    { id: 'CUSTOMERS', label: 'Customers', icon: Users },
  ];

  if (hasTemplatePermission) {
    TABS.push({ id: 'TEMPLATES', label: 'Templates', icon: MessageSquare as any });
  }

  TABS.push({ id: 'LOGS', label: 'Logs', icon: Database });

  useEffect(() => {
    if (activeTab === 'CUSTOMERS') {
      fetchCommunications();
    }
  }, [activeTab, channelFilter, statusFilter, typeFilter]);

  const fetchCommunications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelFilter) params.append('channel', channelFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (customerFilter) params.append('customerId', customerFilter);

      const res = await fetch(`/api/communications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch communications');
      const data = await res.json();
      setCommunications(data.communications || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCommunications();
  };

  return (
    <div className="space-y-6">
      {/* Module Tab Navigation (Matches AccountsTabs layout) */}
      <div className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                isActive
                  ? 'border-[#1A2766] text-[#1A2766]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'DASHBOARD' && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <LayoutDashboard size={48} className="text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-800">Communications Dashboard</h2>
            <p className="text-gray-500 mt-2 max-w-sm">
              Coming Soon. This area will display KPIs and reporting for your customer communications.
            </p>
          </div>
        )}

        {activeTab === 'CUSTOMERS' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search/Filter Area */}
            <div className="bg-white p-4 rounded-xl border border-[#E7EAF0] shadow-sm flex flex-wrap gap-4 items-center">
              <form onSubmit={handleCustomerSearch} className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by Customer ID..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A2766]/20 outline-none"
                />
              </form>
              
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">All Channels</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
                <option value="SYSTEM">System</option>
              </select>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">All Types</option>
                <option value="INVOICE">Invoice</option>
                <option value="DCR">DCR</option>
                <option value="PAYMENT">Payment</option>
                <option value="ORDER">Order</option>
                <option value="GENERAL">General</option>
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#1A2766]" size={32} />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-red-500">
                  <AlertTriangle size={32} className="mb-2" />
                  <p>{error}</p>
                </div>
              ) : communications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <MessageSquare size={32} className="mb-2 opacity-50" />
                  <p>No communications found.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {communications.map((comm) => (
                    <div key={comm.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                      <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        comm.channel === 'WHATSAPP' ? 'bg-green-100 text-green-700' : 
                        comm.channel === 'EMAIL' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {comm.channel.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {comm.subject || `${comm.type} - ${comm.direction}`}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            comm.status === 'DELIVERED' || comm.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' :
                            comm.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {comm.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          <span>Customer: <span className="font-medium text-gray-700">{comm.customerId}</span></span>
                          <span>•</span>
                          <span>By: {comm.createdBy?.name || 'System'}</span>
                          <span>•</span>
                          <span>{new Date(comm.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'LOGS' && <LogsTab />}

        {activeTab === 'TEMPLATES' && <TemplatesTab />}
      </div>
    </div>
  );
}
