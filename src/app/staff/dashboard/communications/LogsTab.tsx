'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCcw, Download, Info, CheckCircle2, Clock, XCircle, FileJson, Copy, Eye } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import CommunicationDetailsDrawer from './CommunicationDetailsDrawer';

interface LogData {
  id: string;
  createdAt: string;
  apiAcceptedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  channel: string;
  direction: string;
  fromAddress?: string;
  toAddress?: string;
  customerName?: string;
  customerId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateCategory?: string;
  body: string;
  status: string;
  createdBy: { name: string };
  type: string;
  relatedRecord?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  providerResponse?: any;
  providerMessageId?: string;
  conversationId?: string;
  pricingCost?: number;
  pricingCategory?: string;
  variablesJson?: any;
  headerType?: string;
  footer?: string;
  buttonsJson?: any;
  retryCount: number;
  errorMessage?: string;
}

export default function LogsTab() {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & KPIs
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState({
    messagesToday: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    deliveryRate: 0,
    readRate: 0,
  });

  // Filters
  const [dateRange, setDateRange] = useState('7_days');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [moduleType, setModuleType] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [detailsLog, setDetailsLog] = useState<LogData | null>(null);

  useEffect(() => {
    fetchLogs();
    
    // Auto refresh every 15 seconds
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [page, dateRange, fromDate, toDate, channel, status, moduleType]);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (channel) params.append('channel', channel);
      if (status) params.append('status', status);
      if (moduleType) params.append('type', moduleType);
      if (search) params.append('search', search);

      // Handle Date Range
      if (dateRange === 'custom' && fromDate && toDate) {
        params.append('fromDate', fromDate);
        params.append('toDate', toDate);
      } else if (dateRange !== 'custom') {
        const today = new Date();
        let from = new Date();
        if (dateRange === 'today') {
          // Keep from as today
        } else if (dateRange === 'yesterday') {
          from.setDate(today.getDate() - 1);
          today.setDate(today.getDate() - 1);
        } else if (dateRange === '7_days') {
          from.setDate(today.getDate() - 7);
        } else if (dateRange === '30_days') {
          from.setDate(today.getDate() - 30);
        }
        params.append('fromDate', from.toISOString());
        params.append('toDate', today.toISOString());
      }

      const res = await fetch(`/api/communications/logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleRetry = async (id: string) => {
    if (!confirm('Are you sure you want to retry sending this communication?')) return;
    try {
      const res = await fetch(`/api/communications/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      alert('Retry queued successfully!');
      fetchLogs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadJson = (log: LogData) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(log, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `comm_log_${log.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-gray-500 font-medium">Messages Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.messagesToday}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-emerald-600 font-medium">Delivered Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.delivered}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-blue-600 font-medium">Read Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.read}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-red-600 font-medium">Failed Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.failed}</p>
        </div>
        <div className="bg-[#1A2766] p-4 rounded-xl border border-[#1A2766] shadow-sm flex flex-col justify-center text-white">
          <p className="text-sm text-blue-100 font-medium flex justify-between">
            <span>Delivery Rate</span>
            <span>Read Rate</span>
          </p>
          <p className="text-xl font-bold mt-1 flex justify-between">
            <span>{kpis.deliveryRate}%</span>
            <span>{kpis.readRate}%</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-[#E7EAF0] shadow-sm flex flex-wrap gap-4 items-center">
        <select 
          value={dateRange} 
          onChange={(e) => setDateRange(e.target.value)} 
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none min-w-[140px]"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7_days">Last 7 Days</option>
          <option value="30_days">Last 30 Days</option>
          <option value="custom">Custom Range</option>
        </select>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <span className="text-gray-400">-</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
        )}

        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
          <option value="">All Modes</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
          <option value="SYSTEM">System</option>
        </select>

        <select value={moduleType} onChange={(e) => setModuleType(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
          <option value="">All Modules</option>
          <option value="INVOICE">Invoice</option>
          <option value="DCR">DCR</option>
          <option value="PAYMENT">Payment</option>
          <option value="ORDER">Order</option>
          <option value="GENERAL">General</option>
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none">
          <option value="">All Statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="API_ACCEPTED">API Accepted</option>
          <option value="SENT">Sent</option>
          <option value="DELIVERED">Delivered</option>
          <option value="READ">Read</option>
          <option value="FAILED">Failed</option>
        </select>

        <form onSubmit={handleSearch} className="flex-1 min-w-[250px] relative ml-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search provider ID, phone, template, preview..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A2766]/20 outline-none"
          />
        </form>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <th className="p-4 font-semibold">Date & Time</th>
              <th className="p-4 font-semibold">Mode</th>
              <th className="p-4 font-semibold">From / To</th>
              <th className="p-4 font-semibold">Customer</th>
              <th className="p-4 font-semibold">Module / Record</th>
              <th className="p-4 font-semibold">Preview</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Initiated By</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-20 text-center">
                  <Loader2 className="animate-spin text-[#1A2766] mx-auto" size={32} />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-red-500">{error}</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-gray-400">No logs found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{format(new Date(log.createdAt), 'MMM dd, yyyy')}</div>
                    <div className="text-xs text-gray-500">{format(new Date(log.createdAt), 'hh:mm:ss a')}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="font-semibold text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {log.channel}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-1 uppercase">{log.direction}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500">From: <span className="font-medium text-gray-800">{log.fromAddress || '-'}</span></div>
                    <div className="text-xs text-gray-500 mt-0.5">To: <span className="font-medium text-gray-800">{log.toAddress || '-'}</span></div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{log.customerName || log.customerId || 'Unknown'}</div>
                    {log.templateName && <div className="text-[10px] text-gray-500 mt-1 bg-gray-100 inline-block px-1.5 py-0.5 rounded truncate max-w-[150px]">Tpl: {log.templateName}</div>}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-gray-900 font-medium">{log.type}</div>
                    {log.relatedRecordId || log.relatedRecord ? (
                      <div className="text-xs mt-0.5">
                        <a 
                          href={
                            log.relatedRecordType === 'INVOICE' ? `/staff/dashboard/invoices/${log.relatedRecordId}` : 
                            log.relatedRecordType === 'ORDER' ? `/staff/dashboard/solar-orders/${log.relatedRecordId}` :
                            log.relatedRecordType === 'DCR' ? `/staff/dashboard/dcrs/${log.relatedRecordId}` :
                            log.customerId ? `/staff/dashboard/customers/${log.customerId}` : '#'
                          } 
                          className="text-blue-600 hover:underline"
                          onClick={(e) => {
                            if (!log.relatedRecordId && !log.customerId) e.preventDefault();
                          }}
                        >
                          {log.relatedRecord || log.relatedRecordId || 'View Record'}
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-0.5">-</div>
                    )}
                  </td>
                  <td className="p-4 max-w-[200px]">
                    <div className="truncate text-xs text-gray-700" title={log.body || ''}>
                      {log.body ? (log.body.length > 80 ? log.body.substring(0, 80) + '...' : log.body) : '-'}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                      log.status === 'QUEUED' ? 'bg-gray-100 text-gray-600' :
                      log.status === 'API_ACCEPTED' ? 'bg-blue-100 text-blue-600' :
                      log.status === 'SENT' ? 'bg-orange-100 text-orange-600' :
                      log.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                      log.status === 'READ' ? 'bg-blue-900 text-blue-100' :
                      log.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.status}
                    </span>
                    {log.retryCount > 0 && <div className="text-[10px] text-red-500 mt-1 ml-1">Retried: {log.retryCount}x</div>}
                  </td>
                  <td className="p-4 whitespace-nowrap text-gray-700">
                    {log.createdBy?.name || 'System'}
                  </td>
                  <td className="p-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setDetailsLog(log)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDownloadJson(log)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Download JSON">
                        <Download size={16} />
                      </button>
                      {log.status === 'FAILED' && (
                        <button onClick={() => handleRetry(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Retry">
                          <RefreshCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="px-2 py-1 text-sm border border-gray-200 rounded bg-white outline-none">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </div>
          
          {totalPages > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded bg-white hover:bg-gray-50 disabled:opacity-50">Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailsLog && (
        <CommunicationDetailsDrawer 
          log={detailsLog} 
          onClose={() => setDetailsLog(null)} 
        />
      )}
    </div>
  );
}
