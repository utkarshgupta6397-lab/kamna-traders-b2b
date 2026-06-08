'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronDown, ChevronUp, CheckCircle, Loader2, Package, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDcrStats } from '../layout';

interface SerialEntry {
  allocationId: string;
  serialNumber: string;
  status: string;
}

interface SkuGroup {
  itemId: string;
  itemName: string;
  sku: string | null;
  quantity: number;
  serials: SerialEntry[];
}

interface ReadyInvoice {
  id: string;
  invoiceNumber: string;
  zohoInvoiceId?: string;
  customerId: string;
  customerName: string;
  customer_gst_no?: string;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  totalSerials: number;
  skuGroups: SkuGroup[];
}

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID;

export default function ReadyToIssueClient() {
  const searchParams = useSearchParams();
  const { refreshStats } = useDcrStats();
  const [invoices, setInvoices] = useState<ReadyInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [kpis, setKpis] = useState({ invoicesReady: 0, serialsReady: 0 });
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [isIssuing, setIsIssuing] = useState(false);
  const [customerGsts, setCustomerGsts] = useState<Record<string, { gst: string; loading: boolean; error: boolean }>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleFetchGst = async (customerId: string) => {
    if (customerGsts[customerId]?.loading) return;

    setCustomerGsts(prev => ({
      ...prev,
      [customerId]: { gst: '', loading: true, error: false }
    }));

    try {
      const res = await fetch(`/api/admin/customer-statement/customer?customerId=${customerId}`);
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        setCustomerGsts(prev => ({
          ...prev,
          [customerId]: { gst: result.data.gstNo || '—', loading: false, error: false }
        }));
      } else {
        setCustomerGsts(prev => ({
          ...prev,
          [customerId]: { gst: '', loading: false, error: true }
        }));
      }
    } catch (err) {
      setCustomerGsts(prev => ({
        ...prev,
        [customerId]: { gst: '', loading: false, error: true }
      }));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/dcr/ready-to-issue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setInvoices(data.invoices || []);
      setTotal(data.total || 0);
      setKpis(data.kpis || { invoicesReady: 0, serialsReady: 0 });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load ready-to-issue queue');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const handleIssue = async (invoiceId: string, serialNumbers?: string[], issueAll?: boolean) => {
    if (!window.confirm("Confirm that the physical DCR has been handed over to the customer.")) return;
    setIsIssuing(true);
    try {
      const res = await fetch('/api/admin/dcr/ready-to-issue/issue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, serialNumbers, issueAll })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.join(', ') || 'Failed to issue');
      toast.success(`Successfully issued ${data.issued} serial(s)`);
      setSelectedSerials(new Set()); // clear selection
      fetchData(); // reload
      refreshStats(); // update sidebar badges

      if (searchParams.get('source') === 'customer_lookup') {
        setTimeout(() => window.close(), 1500);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCopySerials = async (serials: SerialEntry[]) => {
    const text = serials.map(s => s.serialNumber).join(',');
    console.log('Attempting to copy:', text);
    
    const fallbackCopy = (textToCopy: string) => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (successful) {
          toast.success('Serial numbers copied to clipboard');
        } else {
          toast.error('Unable to copy serial numbers');
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
        toast.error('Unable to copy serial numbers');
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Serial numbers copied to clipboard');
      } catch (err) {
        console.error('Clipboard API failed, using fallback', err);
        fallbackCopy(text);
      }
    } else {
      fallbackCopy(text);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Ready To Issue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Management-approved DCRs ready for physical issuance. {total > 0 && <span className="font-semibold text-emerald-600">{total} invoice{total !== 1 ? 's' : ''} waiting.</span>}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Invoices Ready To Issue</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpis.invoicesReady}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Package size={20} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Serials Ready To Issue</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpis.serialsReady}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle size={20} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice number or customer name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Invoice List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-600">No invoices ready to issue</p>
            <p className="text-sm text-gray-400 mt-1">Invoices released from Hold Queue will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4 w-12 text-center bg-gray-50 sticky left-0 z-20">#</th>
                    <th className="px-5 py-4 bg-gray-50 sticky left-[48px] z-20">Invoice Number</th>
                    <th className="px-5 py-4 bg-gray-50">Customer Name</th>
                    <th className="px-5 py-4 bg-gray-50">GST Number</th>
                    <th className="px-5 py-4 bg-gray-50">Invoice Date</th>
                    <th className="px-5 py-4 text-right bg-gray-50">Invoice Value</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Serials Ready</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Status</th>
                    <th className="px-5 py-4 text-right sticky right-0 bg-gray-50 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice, index) => {
                    const isExpanded = expandedInvoices.has(invoice.id);
                    const selectedForInvoice = invoice.skuGroups.flatMap(g => g.serials.map(s => s.serialNumber)).filter(sn => selectedSerials.has(sn));

                    return (
                      <React.Fragment key={invoice.id}>
                        <tr className="hover:bg-emerald-50/20 transition-colors group">
                          <td className="px-5 py-3 text-center text-gray-500 font-medium sticky left-0 bg-white group-hover:bg-[#f3faf7] z-10">{index + 1}</td>
                          <td className="px-5 py-3 font-semibold text-[#1A2766] sticky left-[48px] bg-white group-hover:bg-[#f3faf7] z-10">
                            <a href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${invoice.customerId}&invoiceId=${invoice.id}`} className="hover:underline flex items-center gap-1 w-fit">
                              {invoice.invoiceNumber} <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-800 truncate max-w-xs">
                            <a href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${invoice.customerId}`} className="hover:underline hover:text-[#1A2766]">
                              {invoice.customerName}
                            </a>
                          </td>
                          <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                            {(() => {
                              const gstInfo = customerGsts[invoice.customerId];
                              if (gstInfo) {
                                if (gstInfo.loading) {
                                  return <span className="text-gray-400 italic">Fetching...</span>;
                                }
                                if (gstInfo.error) {
                                  return <span className="text-red-500 font-medium">GST Not Available</span>;
                                }
                                if (gstInfo.gst === 'NOT_AVAILABLE' || gstInfo.gst === '—') {
                                  return <span className="text-red-500 font-medium">GST Not Available</span>;
                                }
                                return <span>{gstInfo.gst}</span>;
                              }
                              if (invoice.customer_gst_no) {
                                if (invoice.customer_gst_no === 'NOT_AVAILABLE' || invoice.customer_gst_no === '—') {
                                  return <span className="text-red-500 font-medium">GST Not Available</span>;
                                }
                                return <span>{invoice.customer_gst_no}</span>;
                              }
                              return (
                                <button
                                  onClick={() => handleFetchGst(invoice.customerId)}
                                  className="text-xs text-[#1A2766] hover:underline font-semibold"
                                >
                                  Fetch GST
                                </button>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-3 text-gray-600">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-700">{formatCurrency(invoice.invoiceTotal)}</td>
                          <td className="px-5 py-3 text-center font-bold text-emerald-700">{invoice.totalSerials}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              ✓ Ready To Issue
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right sticky right-0 bg-white group-hover:bg-[#f3faf7] transition-colors z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex justify-end gap-2">
                              {selectedForInvoice.length > 0 && (
                                <button
                                  onClick={() => handleIssue(invoice.id, selectedForInvoice)}
                                  disabled={isIssuing}
                                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-300 transition-all disabled:opacity-50"
                                >
                                  Issue Selected ({selectedForInvoice.length})
                                </button>
                              )}
                              <button
                                onClick={() => handleIssue(invoice.id, undefined, true)}
                                disabled={isIssuing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
                              >
                                Issue All
                              </button>
                              <button
                                onClick={() => toggleExpand(invoice.id)}
                                className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all flex items-center gap-1"
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                {isExpanded ? 'Collapse' : 'View Serials'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-6 py-4 bg-gray-50/50 border-t border-b border-gray-100">
                              <div className="space-y-3">
                                {invoice.skuGroups.map(group => (
                                  <div key={group.itemId} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                      <button
                                        onClick={() => handleCopySerials(group.serials)}
                                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                                        title="Copy all serial numbers"
                                      >
                                        <Copy size={14} />
                                      </button>
                                      <span className="text-xs font-bold text-gray-700">{group.itemName}</span>
                                      {group.sku && (
                                        <span className="font-mono text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{group.sku}</span>
                                      )}
                                      <span className="ml-auto text-[10px] text-gray-400">{group.serials.length} serial{group.serials.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="p-3 flex flex-wrap gap-2">
                                      {group.serials.map(serial => (
                                        <div
                                          key={serial.allocationId}
                                          className={`flex items-center gap-2 font-mono text-xs border px-2.5 py-1.5 rounded-md transition-colors ${
                                            selectedSerials.has(serial.serialNumber) ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-700'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                            checked={selectedSerials.has(serial.serialNumber)}
                                            onChange={(e) => {
                                              const next = new Set(selectedSerials);
                                              if (e.target.checked) next.add(serial.serialNumber);
                                              else next.delete(serial.serialNumber);
                                              setSelectedSerials(next);
                                            }}
                                            disabled={isIssuing}
                                          />
                                          <span className="cursor-pointer" onClick={() => {
                                              const next = new Set(selectedSerials);
                                              if (next.has(serial.serialNumber)) next.delete(serial.serialNumber);
                                              else next.add(serial.serialNumber);
                                              setSelectedSerials(next);
                                          }}>{serial.serialNumber}</span>
                                          <button
                                            onClick={() => handleIssue(invoice.id, [serial.serialNumber])}
                                            disabled={isIssuing}
                                            className="ml-1 text-[10px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-600 hover:text-emerald-700 hover:border-emerald-400 disabled:opacity-50"
                                          >
                                            Issue
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
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
          </div>
        )}
      </div>
    </div>
  );
}
