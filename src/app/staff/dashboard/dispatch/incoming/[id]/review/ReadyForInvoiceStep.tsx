'use client';
import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Building2, MapPin, Warehouse, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddressData {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  state_code?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export default function ReadyForInvoiceStep({
  order,
  workflow,
  meta,
  onRefresh,
}: {
  order: any;
  workflow: any;
  meta?: any;
  onRefresh: () => void;
}) {
  const [billingVerified, setBillingVerified] = useState(false);
  const [shippingVerified, setShippingVerified] = useState(false);
  const [warehouseVerified, setWarehouseVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const so = (order?.zohoDetailsJson || {}) as Record<string, any>;

  // Resolve warehouse from meta (API) or directly from zoho details
  const resolvedWarehouse = meta?.resolvedWarehouse || null;
  const warehouseName =
    resolvedWarehouse?.name ||
    so.location_name ||
    so.warehouse_name ||
    so.branch_name ||
    (Array.isArray(so.locations) && so.locations[0]?.location_name) ||
    (Array.isArray(so.line_items) && so.line_items.find((l: any) => l.warehouse_name)?.warehouse_name) ||
    null;

  const warehouseId =
    resolvedWarehouse?.id ||
    so.location_id ||
    so.warehouse_id ||
    (Array.isArray(so.locations) && so.locations[0]?.location_id) ||
    null;

  // Address data & IDs
  const billingAddr: AddressData | undefined = so.billing_address;
  const shippingAddr: AddressData | undefined = so.shipping_address;

  const billingAddressId = meta?.billingAddressId || (so.billing_address_id ? String(so.billing_address_id) : null);
  const shippingAddressId = meta?.shippingAddressId || (so.shipping_address_id ? String(so.shipping_address_id) : null);

  const isAddressMismatch = Boolean(
    (meta?.isAddressMismatch !== undefined)
      ? meta.isAddressMismatch
      : (billingAddressId && shippingAddressId && billingAddressId !== shippingAddressId)
  );

  const hasBillingData = Boolean(billingAddr && (billingAddr.address || billingAddr.city || billingAddr.state || billingAddr.attention));
  const hasShippingData = Boolean(shippingAddr && (shippingAddr.address || shippingAddr.city || shippingAddr.state || shippingAddr.attention));
  const hasWarehouseData = Boolean(warehouseName && warehouseName.trim().length > 0);

  if (workflow.readyForInvoiceStatus === 'COMPLETED') {
    return (
      <div className="bg-white border border-emerald-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 text-emerald-800">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-emerald-600" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-base text-emerald-900">Ready For Invoice Completed</h3>
            <p className="text-sm text-emerald-700">Billing Address, Shipping Address, and Dispatch Warehouse have been confirmed.</p>
          </div>
        </div>
      </div>
    );
  }

  const isAllVerified = billingVerified && shippingVerified && warehouseVerified;

  const handleComplete = async () => {
    if (!isAllVerified) {
      toast.error('Please verify all checklist items before completing.');
      return;
    }
    if (!hasBillingData || !hasShippingData || !hasWarehouseData) {
      toast.error('Cannot complete checklist: required address or warehouse information is missing.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/ready-for-invoice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingVerified, shippingVerified, warehouseVerified }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to complete Ready For Invoice');

      toast.success('Ready For Invoice Completed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Ready For Invoice Verification</h3>
          <p className="text-xs text-gray-500 mt-0.5">Verify dispatch locations and customer invoice destinations before generating invoice.</p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 w-fit">
          Step 3 of 4
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Prominent Address Mismatch Caution Banner */}
        {isAddressMismatch && (
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 shadow-sm flex items-start gap-3.5 animate-in fade-in duration-200">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
              <ShieldAlert size={22} className="text-amber-700 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-amber-950 text-sm tracking-tight">
                  CAUTION: Shipping Destination Differs From Billing Address
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Address IDs Mismatch
                </span>
              </div>
              <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                The Shipping Address ID (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px] text-amber-950">{shippingAddressId || 'N/A'}</code>) differs from the Billing Address ID (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px] text-amber-950">{billingAddressId || 'N/A'}</code>).
                Please double-check the recipient and delivery destination before completing invoice preparation.
              </p>
            </div>
          </div>
        )}

        {/* Addresses Grid (Side by side on desktop, stacked on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 1. BILLING ADDRESS CARD */}
          <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
            billingVerified
              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-gray-500 shrink-0" />
                  <span className="font-bold text-gray-900 text-sm">Billing Address</span>
                </div>
                {billingAddressId && (
                  <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shrink-0" title="Billing Address ID">
                    ID: {billingAddressId}
                  </span>
                )}
              </div>

              {hasBillingData ? (
                <div className="text-xs space-y-1 text-gray-700 leading-relaxed">
                  {billingAddr?.attention && (
                    <div className="font-semibold text-gray-900 text-sm mb-1">{billingAddr.attention}</div>
                  )}
                  {billingAddr?.address && <div>{billingAddr.address}</div>}
                  {billingAddr?.street2 && <div>{billingAddr.street2}</div>}
                  <div className="font-medium text-gray-800">
                    {[billingAddr?.city, billingAddr?.state || billingAddr?.state_code, billingAddr?.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                  {billingAddr?.country && <div className="text-gray-500">{billingAddr.country}</div>}
                  {billingAddr?.phone && (
                    <div className="text-gray-600 pt-1 flex items-center gap-1 font-mono text-[11px]">
                      <span>📞</span> {billingAddr.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-rose-600 font-medium">⚠️ Billing address not found in order data.</p>
                </div>
              )}
            </div>

            {/* Checkbox */}
            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="chk-billing"
                disabled={!hasBillingData}
                checked={billingVerified}
                onChange={(e) => setBillingVerified(e.target.checked)}
                className="w-5 h-5 text-[#1A2766] rounded border-gray-300 focus:ring-[#1A2766] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="chk-billing" className={`text-xs font-bold select-none cursor-pointer ${billingVerified ? 'text-emerald-700' : 'text-gray-800'} ${!hasBillingData ? 'opacity-40 cursor-not-allowed' : ''}`}>
                Verify Billing Address matches customer ledger
              </label>
            </div>
          </div>

          {/* 2. SHIPPING ADDRESS CARD */}
          <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
            shippingVerified
              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600 shrink-0" />
                  <span className="font-bold text-gray-900 text-sm">Shipping Address</span>
                </div>
                {shippingAddressId && (
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                    isAddressMismatch
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`} title="Shipping Address ID">
                    ID: {shippingAddressId}
                  </span>
                )}
              </div>

              {hasShippingData ? (
                <div className="text-xs space-y-1 text-gray-700 leading-relaxed">
                  {shippingAddr?.attention && (
                    <div className="font-semibold text-gray-900 text-sm mb-1">{shippingAddr.attention}</div>
                  )}
                  {shippingAddr?.address && <div>{shippingAddr.address}</div>}
                  {shippingAddr?.street2 && <div>{shippingAddr.street2}</div>}
                  <div className="font-medium text-gray-800">
                    {[shippingAddr?.city, shippingAddr?.state || shippingAddr?.state_code, shippingAddr?.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                  {shippingAddr?.country && <div className="text-gray-500">{shippingAddr.country}</div>}
                  {shippingAddr?.phone && (
                    <div className="text-gray-600 pt-1 flex items-center gap-1 font-mono text-[11px]">
                      <span>📞</span> {shippingAddr.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-rose-600 font-medium">⚠️ Shipping address not found in order data.</p>
                </div>
              )}
            </div>

            {/* Checkbox */}
            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="chk-shipping"
                disabled={!hasShippingData}
                checked={shippingVerified}
                onChange={(e) => setShippingVerified(e.target.checked)}
                className="w-5 h-5 text-[#1A2766] rounded border-gray-300 focus:ring-[#1A2766] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="chk-shipping" className={`text-xs font-bold select-none cursor-pointer ${shippingVerified ? 'text-emerald-700' : 'text-gray-800'} ${!hasShippingData ? 'opacity-40 cursor-not-allowed' : ''}`}>
                Verify Shipping Destination is confirmed for dispatch
              </label>
            </div>
          </div>
        </div>

        {/* 3. DISPATCH WAREHOUSE CARD */}
        <div className={`p-5 rounded-xl border transition-all ${
          warehouseVerified
            ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Warehouse size={18} className="text-[#1A2766] shrink-0" />
              <div>
                <span className="font-bold text-gray-900 text-sm">Dispatch Warehouse / Branch</span>
                <span className="text-xs text-gray-500 ml-2">(Fulfillment Location)</span>
              </div>
            </div>
            {warehouseId && (
              <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 self-start sm:self-auto">
                Location ID: {warehouseId}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              {hasWarehouseData ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-base font-bold text-gray-900 truncate">
                    {warehouseName}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold">
                  <AlertTriangle size={15} />
                  <span>Warehouse location not assigned in Zoho order. Please check internally.</span>
                </div>
              )}
            </div>

            {/* Checkbox */}
            <div className="flex items-center gap-3 shrink-0">
              <input
                type="checkbox"
                id="chk-warehouse"
                disabled={!hasWarehouseData}
                checked={warehouseVerified}
                onChange={(e) => setWarehouseVerified(e.target.checked)}
                className="w-5 h-5 text-[#1A2766] rounded border-gray-300 focus:ring-[#1A2766] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label htmlFor="chk-warehouse" className={`text-xs font-bold select-none cursor-pointer ${warehouseVerified ? 'text-emerald-700' : 'text-gray-800'} ${!hasWarehouseData ? 'opacity-40 cursor-not-allowed' : ''}`}>
                Verify Dispatch Warehouse
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {!isAllVerified ? (
            <span className="text-amber-700 font-medium">
              * All 3 checklist verifications are required to proceed to Invoice Confirmation.
            </span>
          ) : (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 size={14} /> All checklist verifications satisfied. Ready to proceed.
            </span>
          )}
        </div>

        <button
          onClick={handleComplete}
          disabled={!isAllVerified || submitting || !hasBillingData || !hasShippingData || !hasWarehouseData}
          className="w-full sm:w-auto bg-[#1A2766] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Complete Ready For Invoice
        </button>
      </div>
    </div>
  );
}
