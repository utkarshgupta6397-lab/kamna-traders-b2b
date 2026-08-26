'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, RefreshCw, Lock, ChevronDown, ChevronUp, CheckCircle, ArrowRightCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Interfaces mirroring the desktop HoldQueueClient
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
  selectedForDCR: boolean;
  totalSerials: number;
  eligibleSerials: number;
  releasedSerials: number;
  serials: SerialEntry[];
}

interface HoldInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  outstandingBalance: number;
  totalSerials: number;
  totalEligible: number;
  totalReleased: number;
  skuGroups: SkuGroup[];
}

interface CustomerHoldRecord {
  customerId: string;
  customerName: string;
  customerGstNo: string | null;
  outstandingBalance: number;
  balanceUpdatedAt?: string | null;
  totalInvoices: number;
  totalSerials: number;
  serialsOnHold: number;
  serialsIssued: number;
  serialsDcrPending: number;
  oldestInvoiceDate: string | null;
  invoices: HoldInvoice[];
}

interface Kpis {
  customersOnHold: number;
  invoicesOnHold: number;
  serialsOnHold: number;
  readyToIssue: number;
  outstandingValueOnHold: number;
  zohoApiCallsToday: number;
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const getAgeInfo = (dateStr: string | null) => {
  if (!dateStr) return { text: 'N/A', color: 'text-slate-500' };
  const diffTime = Math.max(0, new Date().getTime() - new Date(dateStr).getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { text: 'Today', color: 'text-emerald-600' };
  if (diffDays <= 3) return { text: `${diffDays}d`, color: 'text-emerald-600' };
  if (diffDays <= 7) return { text: `${diffDays}d`, color: 'text-orange-500' };
  return { text: `${diffDays}d`, color: 'text-red-600' };
};

export default function MobileHoldQueueClient() {
  const router = useRouter();
  
  // Data States
  const [customers, setCustomers] = useState<CustomerHoldRecord[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ customersOnHold: 0, invoicesOnHold: 0, serialsOnHold: 0, readyToIssue: 0, outstandingValueOnHold: 0, zohoApiCallsToday: 0 });
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHoldRecord | null>(null);
  
  // Search State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Validation / Permission States
  const [unlockedCustomers, setUnlockedCustomers] = useState<Set<string>>(new Set());
  const [globalRefreshCompleted, setGlobalRefreshCompleted] = useState(false);
  const [userPermissions, setUserPermissions] = useState<{holdQueueReviewEnabled: boolean, holdQueueReviewLimit: number | null}>({ holdQueueReviewEnabled: false, holdQueueReviewLimit: null });
  const [refreshingCustomerId, setRefreshingCustomerId] = useState<string | null>(null);
  
  // Detail View States
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'age_desc' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/dcr/hold-queue?${params.toString()}`);
      
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      
      setCustomers(data.customers || []);
      if (data.kpis) setKpis(data.kpis);
      if (data.userPermissions) setUserPermissions(data.userPermissions);
      
      // Update selected customer reference if detail view is open
      if (selectedCustomer) {
        const updated = data.customers?.find((c: any) => c.customerId === selectedCustomer.customerId);
        if (updated) setSelectedCustomer(updated);
        else setSelectedCustomer(null); // Customer is no longer on hold
      }
    } catch (err: any) {
      toast.error('Failed to load Hold Queue');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCustomer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefreshCustomer = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    setRefreshingCustomerId(customerId);
    try {
      const res = await fetch('/api/admin/dcr/hold-queue/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      if (!res.ok) throw new Error('Failed to refresh');
      
      // Only set unlocked. Let UI update immediately to unlocked state
      setUnlockedCustomers(prev => new Set(prev).add(customerId));
      toast.success('Customer balance refreshed');
      
      // Fetch latest data to get exact balance
      fetchData();
    } catch (err: any) {
      toast.error('Unable to refresh outstanding');
    } finally {
      setRefreshingCustomerId(null);
    }
  };

  const handleRelease = async (keys?: string[], releaseAll?: boolean) => {
    if (!selectedCustomer) return;
    setIsReleasing(true);
    
    const keysToProcess = keys || Array.from(selectedSerials);
    
    try {
      if (releaseAll) {
        for (const inv of selectedCustomer.invoices) {
          if (inv.totalEligible > 0) {
            await fetch('/api/admin/dcr/hold-queue/release', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: inv.id, releaseAll: true }),
            });
          }
        }
      } else {
        const byInvoice: Record<string, string[]> = {};
        for (const k of keysToProcess) {
          const [invId, sn] = k.split(':');
          if (!byInvoice[invId]) byInvoice[invId] = [];
          byInvoice[invId].push(sn);
        }

        for (const [invId, serialNumbers] of Object.entries(byInvoice)) {
          await fetch('/api/admin/dcr/hold-queue/release', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invId, serialNumbers }),
          });
        }
      }

      toast.success('DCR items released successfully');
      setSelectedSerials(new Set());
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to release DCR items');
    } finally {
      setIsReleasing(false);
    }
  };
  
  const toggleInvoice = (invId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invId)) next.delete(invId);
      else next.add(invId);
      return next;
    });
  };

  const toggleSkuGroup = (invId: string, itemId: string) => {
    const key = `${invId}:${itemId}`;
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSerialSelection = (invId: string, serialNumber: string) => {
    const key = `${invId}:${serialNumber}`;
    setSelectedSerials(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  
  // ==========================================
  // RENDER: CUSTOMER DETAIL VIEW (HELD INVOICES)
  // ==========================================
  if (selectedCustomer) {
    return (
      <div className="flex-1 flex flex-col font-sans bg-slate-50 min-h-screen pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
          <div className="flex items-center px-1 min-h-[56px] py-1">
            <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
              <ChevronLeft size={24} strokeWidth={2.5} />
              <div className="flex flex-col">
                <span className="font-bold text-[14px] leading-tight truncate max-w-[200px]">{selectedCustomer.customerName}</span>
                <span className="text-[10px] text-blue-200">{fmtCurrency(selectedCustomer.outstandingBalance)} Outstanding</span>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 flex flex-col gap-3">
          {/* Action Bar */}
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm sticky top-[60px] z-40">
            <div className="text-[11px] text-slate-500 font-medium">
              <span className="text-slate-800 font-bold">{selectedSerials.size}</span> selected
            </div>
            
            <div className="flex gap-2">
              {selectedSerials.size > 0 ? (
                <button
                  onClick={() => {
                    if (window.confirm(`Release ${selectedSerials.size} solar items from hold?`)) {
                      handleRelease();
                    }
                  }}
                  disabled={isReleasing}
                  className="flex items-center gap-1 bg-[#1A2766] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                >
                  {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Release
                </button>
              ) : selectedCustomer.invoices.some(inv => inv.totalEligible > 0) ? (
                <button
                  onClick={() => {
                    const total = selectedCustomer.invoices.reduce((sum, inv) => sum + inv.totalEligible, 0);
                    if (window.confirm(`Release all ${total} eligible items?`)) {
                      handleRelease(undefined, true);
                    }
                  }}
                  disabled={isReleasing}
                  className="flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                >
                  {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
                  Release All
                </button>
              ) : null}
            </div>
          </div>

          {/* Invoices List */}
          <div className="flex flex-col gap-3 pb-8">
            {selectedCustomer.invoices.map(invoice => {
              const invExpanded = expandedInvoices.has(invoice.id);
              const eligibleKeys = invoice.skuGroups.flatMap(g => 
                g.selectedForDCR ? g.serials.filter(s => s.isEligible && !s.isReleased).map(s => `${invoice.id}:${s.serialNumber}`) : []
              );
              
              return (
                <div key={invoice.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Invoice Header */}
                  <div 
                    onClick={() => toggleInvoice(invoice.id)}
                    className="p-3 flex justify-between items-start active:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-800 text-[13px]">{invoice.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {new Date(invoice.invoiceDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-slate-800 text-[12px]">{fmtCurrency(invoice.invoiceTotal)}</span>
                      <div className="flex items-center gap-1.5">
                        {eligibleKeys.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Release ${eligibleKeys.length} items from this invoice?`)) {
                                handleRelease(eligibleKeys);
                              }
                            }}
                            disabled={isReleasing}
                            className="bg-[#1A2766] text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm disabled:opacity-50"
                          >
                            Release Invoice
                          </button>
                        )}
                        {invExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </div>
                  </div>
                  
                  {/* Invoice Details */}
                  {invExpanded && (
                    <div className="p-2 bg-slate-50/50">
                      <div className="flex flex-col gap-2">
                        {invoice.skuGroups.filter(g => g.selectedForDCR).map(group => {
                          const skuKey = `${invoice.id}:${group.itemId}`;
                          const skuExpanded = expandedSkus.has(skuKey);
                          const eligibleInSku = group.serials.filter(s => s.isEligible && !s.isReleased).map(s => `${invoice.id}:${s.serialNumber}`);
                          
                          return (
                            <div key={group.itemId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              <div 
                                onClick={() => toggleSkuGroup(invoice.id, group.itemId)}
                                className="p-2 flex justify-between items-center cursor-pointer active:bg-slate-50"
                              >
                                <div className="flex flex-col gap-0.5 max-w-[70%]">
                                  <span className="text-[11px] font-bold text-slate-700 truncate">{group.itemName}</span>
                                  <span className="text-[9px] text-slate-500 font-mono">{group.sku || 'N/A'} (Qty {group.quantity})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {eligibleInSku.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Release ${eligibleInSku.length} items?`)) {
                                          handleRelease(eligibleInSku);
                                        }
                                      }}
                                      disabled={isReleasing}
                                      className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-1 rounded disabled:opacity-50 shadow-sm"
                                    >
                                      Release Item
                                    </button>
                                  )}
                                  {skuExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </div>
                              </div>
                              
                              {skuExpanded && (
                                <div className="p-2 border-t border-slate-100 bg-slate-50 flex flex-col gap-1.5">
                                  {group.serials.map(serial => {
                                    const serialKey = `${invoice.id}:${serial.serialNumber}`;
                                    const isChecked = selectedSerials.has(serialKey);
                                    
                                    return (
                                      <div key={serial.serialNumber} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded">
                                        <div className="flex items-center gap-2">
                                          {serial.isEligible && !serial.isReleased ? (
                                            <input 
                                              type="checkbox" 
                                              checked={isChecked}
                                              onChange={() => toggleSerialSelection(invoice.id, serial.serialNumber)}
                                              className="w-4 h-4 text-[#1A2766] rounded border-slate-300 focus:ring-[#1A2766]"
                                            />
                                          ) : (
                                            <div className="w-4 h-4 border border-slate-200 rounded bg-slate-100 flex-shrink-0" />
                                          )}
                                          <span className="text-[11px] font-mono font-bold text-slate-800">{serial.serialNumber}</span>
                                        </div>
                                        <div className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600">
                                          {serial.isReleased ? 'RELEASED' : serial.isEligible ? 'READY' : 'HOLD'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // RENDER: CUSTOMER LIST VIEW (MAIN HOLD QUEUE)
  // ==========================================
  return (
    <div className="flex-1 flex flex-col font-sans bg-slate-50 min-h-screen pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile/accounts" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="font-bold text-[15px] leading-tight">Hold Queue</span>
              <span className="text-[10px] text-blue-200">Management approval</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 flex flex-col gap-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">On Hold</span>
            <span className="text-lg font-black text-slate-800">{kpis.customersOnHold} <span className="text-xs font-semibold text-slate-500">Cust</span></span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outstanding</span>
            <span className="text-[15px] font-black text-red-600 truncate">{fmtCurrency(kpis.outstandingValueOnHold)}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Invoices</span>
            <span className="text-lg font-black text-slate-800">{kpis.invoicesOnHold}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Items on Hold</span>
            <span className="text-lg font-black text-slate-800">{kpis.serialsOnHold}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, invoice, serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 transition-all shadow-sm"
          />
        </div>

        {/* Customer List */}
        <div className="flex flex-col gap-3 pb-6">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white h-24 rounded-xl border border-slate-200 animate-pulse" />
            ))
          ) : customers.length === 0 ? (
            <div className="text-center p-8 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm">
              No customers on hold found.
            </div>
          ) : (
            customers.map(customer => {
              let isAuthorized = false;
              if (userPermissions.holdQueueReviewEnabled) {
                if (userPermissions.holdQueueReviewLimit === null) isAuthorized = true;
                else isAuthorized = customer.outstandingBalance <= userPermissions.holdQueueReviewLimit;
              }
              const isUnlocked = globalRefreshCompleted || unlockedCustomers.has(customer.customerId);
              const canReview = isAuthorized && isUnlocked;

              return (
                <div 
                  key={customer.customerId}
                  onClick={() => { if (canReview) setSelectedCustomer(customer) }}
                  className={`bg-white border border-slate-200 rounded-xl p-3 shadow-sm transition-transform ${canReview ? 'active:scale-[0.98] cursor-pointer' : 'opacity-80'}`}
                >
                  <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800 text-[14px] leading-tight max-w-[70%]">{customer.customerName}</span>
                    <span className={`font-bold text-[12px] ${customer.outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmtCurrency(customer.outstandingBalance)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">Oldest: {getAgeInfo(customer.oldestInvoiceDate).text}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{customer.totalInvoices} Invoices • {customer.serialsOnHold} Items</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleRefreshCustomer(e, customer.customerId)}
                        disabled={refreshingCustomerId === customer.customerId}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 active:bg-blue-100 transition-colors"
                      >
                        <RefreshCw size={14} className={refreshingCustomerId === customer.customerId ? "animate-spin" : ""} />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canReview) setSelectedCustomer(customer);
                        }}
                        disabled={!canReview}
                        className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors ${
                          canReview 
                            ? 'bg-[#1A2766] text-white hover:bg-[#1A2766]/90' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {!canReview && <Lock size={12} />}
                        Review
                      </button>
                    </div>
                  </div>
                  
                  {!isAuthorized && (
                    <div className="mt-2 text-[9px] text-red-500 font-medium">
                      Exceeds review limit. Requires admin approval.
                    </div>
                  )}
                  {isAuthorized && !isUnlocked && (
                    <div className="mt-2 text-[9px] text-amber-600 font-medium">
                      Tap refresh to unlock customer review.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
