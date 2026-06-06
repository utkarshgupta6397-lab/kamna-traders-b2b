'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, CheckCircle, Loader2, Package, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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
  customerName: string;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  totalSerials: number;
  skuGroups: SkuGroup[];
}

export default function ReadyToIssueClient() {
  const [invoices, setInvoices] = useState<ReadyInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [kpis, setKpis] = useState({ invoicesReady: 0, serialsReady: 0 });
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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
          <div className="space-y-3">
            {invoices.map(invoice => {
              const isExpanded = expandedInvoices.has(invoice.id);
              const selectedForInvoice = invoice.skuGroups.flatMap(g => g.serials.map(s => s.serialNumber)).filter(sn => selectedSerials.has(sn));
              
              return (
                <div key={invoice.id} className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-[#1A2766] text-sm">{invoice.invoiceNumber}</span>
                          <span className="text-gray-400 text-xs">·</span>
                          <span className="text-gray-500 text-xs">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            ✓ Ready To Issue
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{invoice.customerName}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          <span>Invoice Value: <span className="font-semibold text-gray-700">{formatCurrency(invoice.invoiceTotal)}</span></span>
                          <span>Serials: <span className="font-semibold text-emerald-700">{invoice.totalSerials}</span></span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {selectedForInvoice.length > 0 && (
                          <button
                            onClick={() => handleIssue(invoice.id, selectedForInvoice)}
                            disabled={isIssuing}
                            className="flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-3 py-2 rounded-lg transition-all border border-emerald-300 disabled:opacity-50"
                          >
                            Issue Selected ({selectedForInvoice.length})
                          </button>
                        )}
                        <button
                          onClick={() => handleIssue(invoice.id, undefined, true)}
                          disabled={isIssuing}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50"
                        >
                          Issue All
                        </button>
                        <button
                          onClick={() => toggleExpand(invoice.id)}
                          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs font-medium px-2.5 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {isExpanded ? 'Collapse' : 'View Serials'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {invoice.skuGroups.map(group => (
                        <div key={group.itemId} className="border-b border-gray-50 last:border-0">
                          <div className="px-4 py-2.5 bg-gray-50/50 flex items-center gap-2">
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
                          <div className="px-4 py-3 flex flex-wrap gap-2">
                            {group.serials.map(serial => (
                              <div
                                key={serial.allocationId}
                                className={`flex items-center gap-2 font-mono text-xs border px-2 py-1.5 rounded-md transition-colors ${
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
