'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle, Loader2, TrendingDown, Package, ArrowRightCircle, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface SerialEntry {
  allocationId: string;
  serialNumber: string;
  status: string;
  vendorDcrStatus: string;
  isEligible: boolean;
  isReleased: boolean;
}

interface SkuGroup {
  itemId: string;
  itemName: string;
  sku: string | null;
  quantity: number;
  totalSerials: number;
  eligibleSerials: number;
  releasedSerials: number;
  serials: SerialEntry[];
}

interface HoldInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  outstandingBalance: number;
  totalSerials: number;
  totalEligible: number;
  totalReleased: number;
  releasePercentage: number;
  skuGroups: SkuGroup[];
}

interface Kpis {
  invoicesOnHold: number;
  serialsOnHold: number;
  readyToIssue: number;
  outstandingValueOnHold: number;
}

export default function HoldQueueClient() {
  const [invoices, setInvoices] = useState<HoldInvoice[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ invoicesOnHold: 0, serialsOnHold: 0, readyToIssue: 0, outstandingValueOnHold: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [selectedSerials, setSelectedSerials] = useState<Map<string, Set<string>>>(new Map()); // invoiceId -> Set<serialNumber>
  const [releasingInvoice, setReleasingInvoice] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/dcr/hold-queue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setInvoices(data.invoices || []);
      setKpis(data.kpis || {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to load hold queue');
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

  const toggleSerial = (invoiceId: string, serialNumber: string) => {
    setSelectedSerials(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(invoiceId) || []);
      set.has(serialNumber) ? set.delete(serialNumber) : set.add(serialNumber);
      if (set.size === 0) next.delete(invoiceId); else next.set(invoiceId, set);
      return next;
    });
  };

  const toggleAllSerialsForInvoice = (invoice: HoldInvoice) => {
    const eligibleUnreleased = invoice.skuGroups.flatMap(g => g.serials.filter(s => s.isEligible && !s.isReleased)).map(s => s.serialNumber);
    const currentSelected = selectedSerials.get(invoice.id) || new Set();
    const allSelected = eligibleUnreleased.every(sn => currentSelected.has(sn));
    setSelectedSerials(prev => {
      const next = new Map(prev);
      if (allSelected) { next.delete(invoice.id); } else { next.set(invoice.id, new Set(eligibleUnreleased)); }
      return next;
    });
  };

  const handleRelease = async (invoiceId: string, serialNumbers?: string[], releaseAll?: boolean) => {
    setReleasingInvoice(invoiceId);
    try {
      const res = await fetch('/api/admin/dcr/hold-queue/release', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, serialNumbers, releaseAll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.errors ? data.errors.join('; ') : 'Release failed'));
      toast.success(`${data.released} serial(s) released to Ready To Issue`);
      // Clear selected for this invoice
      setSelectedSerials(prev => { const next = new Map(prev); next.delete(invoiceId); return next; });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReleasingInvoice(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const kpiCards = [
    {
      label: 'Invoices On Hold',
      value: kpis.invoicesOnHold,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: 'Serials On Hold',
      value: kpis.serialsOnHold,
      icon: Package,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
    },
    {
      label: 'Ready To Issue',
      value: kpis.readyToIssue,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Outstanding On Hold',
      value: formatCurrency(kpis.outstandingValueOnHold),
      icon: IndianRupee,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
      isText: true,
    },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Hold Queue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Management approval before DCR issuance. Review outstanding balances and release serials.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map(card => (
            <div key={card.label} className={`bg-white rounded-xl border ${card.border} shadow-sm p-3 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icon className={`w-4.5 h-4.5 ${card.color}`} size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">{card.label}</p>
                <p className={`text-lg font-black mt-0.5 leading-none ${card.isText ? 'text-sm font-bold' : ''} ${card.color}`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice number, customer name, or serial number..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] transition-all outline-none"
            />
          </div>
        </div>

        {/* Invoice List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1A2766]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-700">No invoices in Hold Queue</p>
            <p className="text-sm text-gray-400 mt-1">All allocated invoices with vendor DCR received have been processed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map(invoice => {
              const isExpanded = expandedInvoices.has(invoice.id);
              const isReleasing = releasingInvoice === invoice.id;
              const invoiceSelected = selectedSerials.get(invoice.id) || new Set();
              const eligibleUnreleased = invoice.skuGroups.flatMap(g => g.serials.filter(s => s.isEligible && !s.isReleased));
              const hasOutstanding = invoice.outstandingBalance > 0;
              const releasePercent = invoice.totalEligible > 0 ? Math.round((invoice.totalReleased / invoice.totalEligible) * 100) : 0;

              return (
                <div key={invoice.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Invoice Card Header */}
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {/* Left: Invoice metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-[#1A2766] text-sm">{invoice.invoiceNumber}</span>
                          <span className="text-gray-400 text-xs">·</span>
                          <span className="text-gray-600 text-xs">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</span>
                          {invoice.totalReleased === invoice.totalEligible && invoice.totalEligible > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">All Released</span>
                          ) : invoice.totalReleased > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">Partially Released</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-200">On Hold</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{invoice.customerName}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Invoice: <span className="font-semibold text-gray-700">{formatCurrency(invoice.invoiceTotal)}</span></span>
                          <span className="flex items-center gap-1">
                            Outstanding:
                            <span className={`font-bold ml-0.5 ${hasOutstanding ? 'text-orange-600' : 'text-emerald-600'}`}>
                              {hasOutstanding ? (
                                <span className="flex items-center gap-0.5">
                                  <AlertTriangle size={10} className="text-orange-500" />
                                  {formatCurrency(invoice.outstandingBalance)}
                                </span>
                              ) : '₹0'}
                            </span>
                          </span>
                          <span>Serials: <span className="font-semibold text-gray-700">{invoice.totalReleased}/{invoice.totalEligible} released</span></span>
                        </div>

                        {/* Release Progress Bar */}
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-gray-400">Release Progress</span>
                            <span className="text-[10px] font-bold text-gray-600">{releasePercent}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${releasePercent === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                              style={{ width: `${releasePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {invoiceSelected.size > 0 && (
                          <button
                            onClick={() => handleRelease(invoice.id, Array.from(invoiceSelected))}
                            disabled={isReleasing}
                            className="flex items-center gap-1.5 bg-[#1A2766] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#1A2766]/90 disabled:opacity-50 transition-all"
                          >
                            {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
                            Release Selected ({invoiceSelected.size})
                          </button>
                        )}
                        {eligibleUnreleased.length > 0 && invoiceSelected.size === 0 && (
                          <button
                            onClick={() => handleRelease(invoice.id, undefined, true)}
                            disabled={isReleasing}
                            className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                          >
                            {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Release All ({eligibleUnreleased.length})
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpand(invoice.id)}
                          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs font-medium px-2.5 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {isExpanded ? 'Collapse' : 'Details'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: SKU Groups + Serials */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Select All for invoice */}
                      {eligibleUnreleased.length > 0 && (
                        <div className="px-4 py-2 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={eligibleUnreleased.every(s => invoiceSelected.has(s.serialNumber))}
                            onChange={() => toggleAllSerialsForInvoice(invoice)}
                            className="rounded text-[#1A2766] cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">Select all eligible serials ({eligibleUnreleased.length})</span>
                        </div>
                      )}

                      {invoice.skuGroups.map(group => (
                        <div key={group.itemId} className="border-b border-gray-50 last:border-0">
                          {/* SKU Header */}
                          <div className="px-4 py-2.5 bg-gray-50/50 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-gray-700">{group.itemName}</span>
                              {group.sku && (
                                <span className="ml-2 font-mono text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  {group.sku}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {group.releasedSerials}/{group.eligibleSerials} eligible released
                            </span>
                          </div>

                          {/* Serials Table */}
                          <div className="divide-y divide-gray-50">
                            {group.serials.map(serial => {
                              const isChecked = invoiceSelected.has(serial.serialNumber);
                              return (
                                <div key={serial.allocationId} className={`flex items-center gap-3 px-4 py-2 transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                                  {/* Checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={!serial.isEligible || serial.isReleased}
                                    onChange={() => serial.isEligible && !serial.isReleased && toggleSerial(invoice.id, serial.serialNumber)}
                                    className="rounded text-[#1A2766] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  />

                                  {/* Serial number */}
                                  <span className="font-mono text-xs text-gray-700 flex-1">{serial.serialNumber}</span>

                                  {/* Vendor DCR badge */}
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    serial.vendorDcrStatus === 'RECEIVED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {serial.vendorDcrStatus === 'RECEIVED' ? 'DCR ✓' : 'DCR Pending'}
                                  </span>

                                  {/* Status badge */}
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    serial.isReleased
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : serial.isEligible
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                  }`}>
                                    {serial.isReleased ? 'Released' : serial.status}
                                  </span>

                                  {/* Single release button */}
                                  {serial.isEligible && !serial.isReleased && (
                                    <button
                                      onClick={() => handleRelease(invoice.id, [serial.serialNumber])}
                                      disabled={isReleasing}
                                      className="text-[10px] font-semibold text-[#1A2766] hover:text-[#1A2766]/70 disabled:opacity-40 transition-colors whitespace-nowrap"
                                    >
                                      Release →
                                    </button>
                                  )}
                                </div>
                              );
                            })}
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
