'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Package, Tag, Hash, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export interface SerialItem {
  id: string;
  serialNumber: string;
  skuId?: string | null;
  status: string;
  vendorDcrStatus: string;
  vendorName?: string | null;
  computedProduct?: string | null;
  computedSku?: string | null;
  productImage?: string | null;
  tag?: {
    id: string;
    tag: string;
  } | null;
  allocations?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupStatusSummary {
  isMixed: boolean;
  primaryStatus: string;
  counts: Record<string, number>;
}

export interface GroupVendorDcrSummary {
  isMixed: boolean;
  primaryStatus: string;
  receivedCount: number;
  totalCount: number;
}

export interface GroupedSerial {
  groupKey: string;
  productName: string;
  sku: string;
  serialTag: string;
  hasTag: boolean;
  productImage: string | null;
  serials: SerialItem[];
  totalCount: number;
  statusSummary: GroupStatusSummary;
  vendorDcrSummary: GroupVendorDcrSummary;
  invoiceId?: string | null;
}

export function groupSerialsByProductAndTag(
  serials: SerialItem[] = [],
  invoiceId?: string | null
): GroupedSerial[] {
  const groupsMap = new Map<string, GroupedSerial>();

  for (const serial of serials) {
    const rawProduct = serial.computedProduct || serial.skuId || 'Unknown Product';
    const productName = rawProduct.trim();
    const sku = serial.computedSku || serial.skuId || '';
    
    // Stable serial tag resolution
    const hasTag = Boolean(serial.tag?.tag && serial.tag.tag.trim().length > 0);
    const serialTag = hasTag ? serial.tag!.tag.trim() : 'No Serial Tag';

    // Invoice context isolation
    const invContext = invoiceId || serial.allocations?.[0]?.invoiceId || '__GLOBAL__';

    // Primary grouping key: INVOICE + PRODUCT + SERIAL TAG
    const groupKey = `${invContext}::${productName}::${sku}::${serialTag}`;

    let group = groupsMap.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        productName,
        sku,
        serialTag,
        hasTag,
        productImage: serial.productImage || null,
        serials: [],
        totalCount: 0,
        statusSummary: {
          isMixed: false,
          primaryStatus: serial.status,
          counts: {},
        },
        vendorDcrSummary: {
          isMixed: false,
          primaryStatus: serial.vendorDcrStatus,
          receivedCount: 0,
          totalCount: 0,
        },
        invoiceId: invContext !== '__GLOBAL__' ? invContext : null,
      };
      groupsMap.set(groupKey, group);
    }

    group.serials.push(serial);
    if (!group.productImage && serial.productImage) {
      group.productImage = serial.productImage;
    }
  }

  // Calculate summaries for each group
  const result: GroupedSerial[] = [];

  for (const group of groupsMap.values()) {
    group.totalCount = group.serials.length;

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    let receivedDcrCount = 0;
    const vendorDcrCounts: Record<string, number> = {};

    for (const s of group.serials) {
      const st = s.status || 'AVAILABLE';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const vd = s.vendorDcrStatus || 'NOT_RECEIVED';
      vendorDcrCounts[vd] = (vendorDcrCounts[vd] || 0) + 1;
      if (vd === 'RECEIVED') {
        receivedDcrCount++;
      }
    }

    const uniqueStatuses = Object.keys(statusCounts);
    const isMixedStatus = uniqueStatuses.length > 1;
    group.statusSummary = {
      isMixed: isMixedStatus,
      primaryStatus: isMixedStatus ? 'MIXED' : (uniqueStatuses[0] || 'AVAILABLE'),
      counts: statusCounts,
    };

    const uniqueVendorDcr = Object.keys(vendorDcrCounts);
    const isMixedVendorDcr = uniqueVendorDcr.length > 1;
    group.vendorDcrSummary = {
      isMixed: isMixedVendorDcr,
      primaryStatus: isMixedVendorDcr ? 'MIXED' : (uniqueVendorDcr[0] || 'NOT_RECEIVED'),
      receivedCount: receivedDcrCount,
      totalCount: group.totalCount,
    };

    result.push(group);
  }

  return result;
}

export const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'ALLOCATED':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'HOLD':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'READY_TO_ISSUE':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'ISSUED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'RETURNED':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'MIXED':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const getVendorDcrBadgeStyle = (status: string) => {
  switch (status) {
    case 'NOT_RECEIVED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'PENDING':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'RECEIVED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'EXEMPT':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'MIXED':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

interface MobileGroupedSerialsProps {
  serials?: SerialItem[];
  invoiceId?: string | null;
  activeFilter?: string;
  searchQuery?: string;
  className?: string;
}

export function MobileGroupedSerials({
  serials = [],
  invoiceId,
  activeFilter = 'ALL',
  searchQuery = '',
  className = '',
}: MobileGroupedSerialsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    return groupSerialsByProductAndTag(serials, invoiceId);
  }, [serials, invoiceId]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const copyToClipboard = async (text: string, label: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(key);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (!serials || serials.length === 0) {
    return (
      <div className="text-center p-6 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
        No solar items found for this invoice.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {groups.map(group => {
        const isExpanded = Boolean(expandedGroups[group.groupKey]);
        const serialPreview = group.serials.slice(0, 4).map(s => s.serialNumber).join(', ');
        const remainingCount = group.serials.length - 4;

        // Status presentation
        let statusDisplay = group.statusSummary.primaryStatus.replace(/_/g, ' ');
        if (group.statusSummary.isMixed) {
          const breakdown = Object.entries(group.statusSummary.counts)
            .map(([st, count]) => `${count} ${st.toLowerCase().replace(/_/g, ' ')}`)
            .join(' · ');
          statusDisplay = `Mixed · ${breakdown}`;
        }

        // Vendor DCR presentation
        let vendorDcrDisplay = `Vendor DCR: ${group.vendorDcrSummary.primaryStatus.replace(/_/g, ' ')}`;
        if (group.vendorDcrSummary.isMixed) {
          vendorDcrDisplay = `Vendor DCR: ${group.vendorDcrSummary.receivedCount}/${group.vendorDcrSummary.totalCount} Received`;
        }

        return (
          <div
            key={group.groupKey}
            className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden transition-all duration-200"
          >
            {/* CARD HEADER / COLLAPSED VIEW */}
            <div
              onClick={() => toggleGroup(group.groupKey)}
              className="p-3.5 cursor-pointer active:bg-slate-50 transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2.5">
                {/* Product thumbnail or placeholder */}
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden text-slate-400">
                    {group.productImage ? (
                      <img
                        src={group.productImage}
                        alt={group.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={20} strokeWidth={1.75} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[13px] text-slate-900 leading-snug break-words">
                      {group.productName}
                    </h4>
                    
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600 font-medium">
                      <Tag size={12} className="text-slate-400 shrink-0" />
                      <span className="text-slate-400">Serial Tag:</span>
                      <span className={`font-semibold ${group.hasTag ? 'text-indigo-700 bg-indigo-50/70 border border-indigo-100/80 px-1.5 py-0.2 rounded text-[10px]' : 'text-slate-400 italic'}`}>
                        {group.serialTag}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Serial count badge & Expand chevron */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span className="font-bold text-[11px] text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                    [{group.totalCount}]
                  </span>
                  <div className="text-slate-400 p-0.5">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
              </div>

              {/* Status and Vendor DCR badges */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
                <span className={`px-2 py-0.5 font-bold uppercase tracking-wider rounded border ${getStatusBadgeStyle(group.statusSummary.primaryStatus)}`}>
                  {statusDisplay}
                </span>
                
                <span className={`px-2 py-0.5 font-semibold rounded border ${getVendorDcrBadgeStyle(group.vendorDcrSummary.primaryStatus)}`}>
                  {vendorDcrDisplay}
                </span>
              </div>

              {/* Collapsed Serials preview */}
              {!isExpanded && (
                <div className="text-[11px] text-slate-500 font-mono pt-1 truncate">
                  <span className="text-slate-400 font-sans font-medium text-[10px] uppercase tracking-wide mr-1">Serials:</span>
                  {serialPreview}
                  {remainingCount > 0 && (
                    <span className="text-slate-400 font-sans font-semibold text-[10px] ml-1">
                      +{remainingCount} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* EXPANDED VIEW */}
            {isExpanded && (
              <div className="border-t border-slate-200 bg-slate-50/60 p-3 flex flex-col gap-2.5 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1">
                    <Hash size={13} className="text-slate-400" />
                    Serial Numbers ({group.totalCount})
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const allSerialsText = group.serials.map(s => s.serialNumber).join(', ');
                      copyToClipboard(allSerialsText, `all ${group.totalCount} serials`, `group-${group.groupKey}`);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#1A2766] hover:text-indigo-800 bg-white border border-slate-200 px-2 py-1 rounded shadow-2xs active:bg-slate-100 transition-colors"
                  >
                    {copiedKey === `group-${group.groupKey}` ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    Copy All
                  </button>
                </div>

                {/* Individual Serials List */}
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {group.serials.map(serial => {
                    const isCopied = copiedKey === serial.id;
                    const matchesActiveFilter = activeFilter !== 'ALL' && (
                      activeFilter === serial.status ||
                      (activeFilter === 'VENDOR_PENDING' && serial.vendorDcrStatus === 'NOT_RECEIVED') ||
                      (activeFilter === 'SERIAL_PENDING' && serial.status === 'AVAILABLE')
                    );

                    return (
                      <div
                        key={serial.id}
                        className={`flex items-center justify-between bg-white border rounded-lg p-2 text-xs transition-colors ${
                          matchesActiveFilter ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono font-bold text-slate-800 text-[11px] truncate select-all">
                            {serial.serialNumber}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(serial.serialNumber, serial.serialNumber, serial.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                            title="Copy Serial Number"
                          >
                            {isCopied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${getStatusBadgeStyle(serial.status)}`}>
                            {serial.status.replace(/_/g, ' ')}
                          </span>

                          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded border ${getVendorDcrBadgeStyle(serial.vendorDcrStatus)}`}>
                            {serial.vendorDcrStatus === 'RECEIVED' ? 'DCR Recv' : serial.vendorDcrStatus === 'NOT_RECEIVED' ? 'DCR Pend' : serial.vendorDcrStatus}
                          </span>
                        </div>
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
  );
}
