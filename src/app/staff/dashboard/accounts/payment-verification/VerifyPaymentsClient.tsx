'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Landmark,
  Banknote,
  Smartphone,
  ExternalLink,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SyncZohoProgressModal from '@/components/accounts/manage-payments/SyncZohoProgressModal';
import AuditVerifiedPaymentsModal from '@/components/accounts/manage-payments/AuditVerifiedPaymentsModal';

interface PaymentItem {
  id: string;
  zohoPaymentId: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  amount: number | string;
  bankCharges?: number | string | null;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  description?: string | null;
  invoiceNumbers?: string | null;
  isVerified: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REVERIFICATION_REQUIRED';
  verificationMethod?: string | null;
  bankMatchStatus?: 'MATCHED' | 'CATEGORIZED' | 'UNMATCHED' | 'NONE' | null;
  importedTransactionId?: string | null;
  requiresManualVerification?: boolean;
  verificationInvalidatedAt?: string | null;
  verificationInvalidationReason?: string | null;
  isAuditVerified?: boolean;
  verifiedFieldCustomerName?: boolean;
  verifiedFieldAmount?: boolean;
  verifiedFieldBankCharges?: boolean;
  verifiedFieldPaymentDate?: boolean;
  verifiedFieldPaymentMode?: boolean;
  verifiedFieldDepositTo?: boolean;
  zohoData?: any;
  lastSyncedAt: string;
}

interface StatsData {
  pendingVerification: number;
  reverificationRequired?: number;
  autoVerifiedThisWeek: number;
  cashPending: number;
  verifiedThisWeek: number;
}

interface ZohoApiUsageData {
  total: number;
  paymentListCalls: number;
  paymentDetailCalls: number;
  paymentUpdateCalls: number;
}

interface VerifyPaymentsClientProps {
  canAction: boolean;
}

export default function VerifyPaymentsClient({ canAction }: VerifyPaymentsClientProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    pendingVerification: 0,
    autoVerifiedThisWeek: 0,
    cashPending: 0,
    verifiedThisWeek: 0,
  });
  const [zohoApiUsage, setZohoApiUsage] = useState<ZohoApiUsageData>({
    total: 0,
    paymentListCalls: 0,
    paymentDetailCalls: 0,
    paymentUpdateCalls: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const isVerifyingRef = useRef<boolean>(false);
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  // Explicit 6-field Audit Verification states for current payment
  const [verifiedFields, setVerifiedFields] = useState<{
    customerName: boolean;
    amount: boolean;
    bankCharges: boolean;
    paymentDate: boolean;
    paymentMode: boolean;
    depositTo: boolean;
  }>({
    customerName: false,
    amount: false,
    bankCharges: false,
    paymentDate: false,
    paymentMode: false,
    depositTo: false,
  });

  // Live Sync Modal states
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [activeSyncRunId, setActiveSyncRunId] = useState<string | null>(null);

  // Live Audit Modal states
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [activeAuditRunId, setActiveAuditRunId] = useState<string | null>(null);
  const [auditing, setAuditing] = useState<boolean>(false);

  // LOCAL ONLY: Allow Zoho Writes toggle (stored in browser localStorage, default false)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const [allowZohoWrites, setAllowZohoWrites] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customerPaymentVerificationAllowZohoWrites');
      if (stored === 'true') {
        setAllowZohoWrites(true);
      }
    }
  }, []);

  const handleToggleClick = () => {
    if (!allowZohoWrites) {
      // Prompt confirmation before enabling
      setShowConfirmModal(true);
    } else {
      // Disabling does not need confirmation
      setAllowZohoWrites(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('customerPaymentVerificationAllowZohoWrites', 'false');
      }
      toast('Zoho writes disabled (Dry Run mode active)', { icon: 'ℹ️' });
    }
  };

  const confirmEnableWrites = () => {
    setAllowZohoWrites(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('customerPaymentVerificationAllowZohoWrites', 'true');
    }
    setShowConfirmModal(false);
    toast.success('Zoho writes ENABLED for this local environment');
  };

  const fetchQueue = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/api/staff/accounts/payment-verification/queue');
      const data = await res.json();
      if (res.ok && data.success) {
        setPayments(data.payments || []);
        setStats(data.stats || {
          pendingVerification: 0,
          reverificationRequired: 0,
          autoVerifiedThisWeek: 0,
          cashPending: 0,
          verifiedThisWeek: 0,
        });
        if (data.zohoApiUsage) {
          setZohoApiUsage(data.zohoApiUsage);
        }
      } else {
        toast.error(data.error || 'Failed to fetch queue');
      }
    } catch {
      toast.error('Network error loading queue');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(true);
  }, [fetchQueue]);

  const handleSync = async () => {
    if (syncing) return;

    // Generate unique syncRunId immediately
    const runId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setActiveSyncRunId(runId);
    setShowSyncModal(true);
    setSyncing(true);

    try {
      const headers: Record<string, string> = {};
      if (allowZohoWrites) {
        headers['x-allow-zoho-writes'] = 'true';
      }
      const syncUrl = `/api/staff/accounts/payment-verification/sync?syncRunId=${encodeURIComponent(runId)}${
        allowZohoWrites ? '&allowZohoWrites=true' : ''
      }`;

      const res = await fetch(syncUrl, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyRunning) {
          toast.error('Sync already running in background');
        } else {
          toast.error(data.error || 'Sync request failed');
        }
      }
    } catch (err: any) {
      toast.error('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleAudit = async () => {
    if (auditing) return;

    const runId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setActiveAuditRunId(runId);
    setShowAuditModal(true);
    setAuditing(true);

    try {
      const headers: Record<string, string> = {};
      if (allowZohoWrites) {
        headers['x-allow-zoho-writes'] = 'true';
      }
      const auditUrl = `/api/staff/accounts/payment-verification/integrity-audit?auditRunId=${encodeURIComponent(runId)}${
        allowZohoWrites ? '&allowZohoWrites=true' : ''
      }`;

      const res = await fetch(auditUrl, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyRunning) {
          toast.error('Integrity audit already running in background');
        } else {
          toast.error(data.error || 'Audit request failed');
        }
      }
    } catch (err: any) {
      toast.error('Failed to trigger audit');
    } finally {
      setAuditing(false);
    }
  };

  const filteredPayments = useMemo(() => {
    if (modeFilter === 'ALL') return payments;
    return payments.filter(
      (p) => p.paymentMode.toLowerCase() === modeFilter.toLowerCase()
    );
  }, [payments, modeFilter]);

  // Ensure selectedIndex is always within range
  const safeIndex = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, filteredPayments.length - 1)
  );
  const currentPayment: PaymentItem | undefined = filteredPayments[safeIndex];

  const handleNext = () => {
    if (safeIndex < filteredPayments.length - 1) {
      setSelectedIndex(safeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) {
      setSelectedIndex(safeIndex - 1);
    }
  };

  const handleSkip = () => {
    if (safeIndex < filteredPayments.length - 1) {
      setSelectedIndex(safeIndex + 1);
      toast('Skipped to next payment', { icon: '⏭️' });
    } else {
      toast('At end of pending queue', { icon: 'ℹ️' });
    }
  };

  // Reset field verification status when switching selected payment
  useEffect(() => {
    if (currentPayment) {
      setVerifiedFields({
        customerName: Boolean(currentPayment.verifiedFieldCustomerName),
        amount: Boolean(currentPayment.verifiedFieldAmount),
        bankCharges: Boolean(currentPayment.verifiedFieldBankCharges),
        paymentDate: Boolean(currentPayment.verifiedFieldPaymentDate),
        paymentMode: Boolean(currentPayment.verifiedFieldPaymentMode),
        depositTo: Boolean(currentPayment.verifiedFieldDepositTo),
      });
    }
  }, [currentPayment?.zohoPaymentId]);

  const toggleFieldVerification = (field: keyof typeof verifiedFields) => {
    setVerifiedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const verifyAllFields = () => {
    setVerifiedFields({
      customerName: true,
      amount: true,
      bankCharges: true,
      paymentDate: true,
      paymentMode: true,
      depositTo: true,
    });
    toast.success('All 6 fields marked as verified');
  };

  const allFieldsVerified = useMemo(() => {
    return (
      verifiedFields.customerName &&
      verifiedFields.amount &&
      verifiedFields.bankCharges &&
      verifiedFields.paymentDate &&
      verifiedFields.paymentMode &&
      verifiedFields.depositTo
    );
  }, [verifiedFields]);

  const verifiedFieldsCount = useMemo(() => {
    return Object.values(verifiedFields).filter(Boolean).length;
  }, [verifiedFields]);

  const handleVerify = async () => {
    if (!currentPayment) return;
    if (isVerifyingRef.current || verifying) return;
    if (!canAction) {
      toast.error('You do not have permission to verify payments.');
      return;
    }

    if (!allFieldsVerified) {
      toast.error('Please verify all six payment fields before marking this payment as Audit Verified.');
      return;
    }

    isVerifyingRef.current = true;
    setVerifying(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (allowZohoWrites) {
        headers['x-allow-zoho-writes'] = 'true';
      }
      const verifyUrl = `/api/staff/accounts/payment-verification/${currentPayment.zohoPaymentId}/verify${
        allowZohoWrites ? '?allowZohoWrites=true' : ''
      }`;

      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          verifiedFields,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Payment ${currentPayment.paymentNumber} Audit Verified successfully in Zoho Books!`);
        // Remove locally from state or reload queue
        setPayments((prev) => prev.filter((p) => p.zohoPaymentId !== currentPayment.zohoPaymentId));
        setStats((prev) => ({
          ...prev,
          pendingVerification: Math.max(0, prev.pendingVerification - 1),
          verifiedThisWeek: prev.verifiedThisWeek + 1,
        }));
        await fetchQueue();
      } else {
        if (data.skipped || data.code === 'SKIPPED_DUE_TO_LOCAL_WRITE_DISABLED') {
          toast.error('Zoho writes are disabled in Local Only mode.', {
            duration: 4000,
          });
        } else {
          toast.error(data.error || 'Verification failed');
        }
      }
    } catch {
      toast.error('Network error during verification');
    } finally {
      isVerifyingRef.current = false;
      setVerifying(false);
    }
  };

  const formatCurrency = (amt: number | string) => {
    const num = typeof amt === 'string' ? parseFloat(amt) : amt;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getModeBadge = (mode: string) => {
    const m = (mode || '').toLowerCase();
    if (m.includes('bank') || m.includes('neft') || m.includes('rtgs') || m.includes('imps')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Landmark size={12} />
          Bank Transfer
        </span>
      );
    }
    if (m.includes('cash')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Banknote size={12} />
          Cash
        </span>
      );
    }
    if (m.includes('pos')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Smartphone size={12} />
          POS Device
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
        <Layers size={12} />
        {mode || 'Other'}
      </span>
    );
  };

  // Inspect raw Zoho details
  const zohoDetail = currentPayment?.zohoData || {};
  const rawZohoStatus = String(
    zohoDetail.payment_status || zohoDetail.status || ''
  ).toLowerCase().trim();
  const isVoidPayment = rawZohoStatus === 'void' || rawZohoStatus === 'cancelled' || rawZohoStatus === 'canceled';

  const importedTxns: any[] = Array.isArray(zohoDetail.imported_transactions)
    ? zohoDetail.imported_transactions
    : [];
  const primaryImportedTxn = importedTxns[0];
  const appliedInvoices: any[] = Array.isArray(zohoDetail.invoices) ? zohoDetail.invoices : [];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-[#1A2766] tracking-tight">
              Verify Payments
            </h1>
            <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
              Verification Workspace
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Review and verify customer payments from Zoho Books. Bank transfer payments are
            auto-verified when matched with bank statements. Cash payments require manual verification.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* LOCAL ONLY: Yellow warning toggle control for development */}
          {isDevelopment && (
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              allowZohoWrites
                ? 'bg-amber-500/10 border-amber-400 text-amber-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🟨</span>
                  <span className="text-[11px] font-black tracking-wider uppercase text-amber-900">
                    LOCAL ONLY
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleClick}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    allowZohoWrites ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={allowZohoWrites}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      allowZohoWrites ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-gray-800">
                  Allow Zoho Writes
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded uppercase ${
                  allowZohoWrites ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {allowZohoWrites ? 'ON' : 'OFF'}
                </span>
              </div>

              <p className="text-[10px] text-amber-800/90 font-medium leading-tight">
                {allowZohoWrites
                  ? '⚠️ Zoho writes enabled for this local environment'
                  : 'Dry Run — Zoho writes are disabled'}
              </p>
            </div>
          )}

          <button
            onClick={handleAudit}
            disabled={auditing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs hover:bg-indigo-100 disabled:opacity-50 transition-colors h-fit self-center"
            title="Scan Zoho Books for modified payment amount/date on verified payments"
          >
            <ShieldCheck size={14} className={auditing ? 'animate-spin text-indigo-600' : ''} />
            {auditing ? 'Auditing...' : 'Audit Verified Payments'}
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-2xs hover:bg-gray-50 disabled:opacity-50 transition-colors h-fit self-center"
          >
            <RotateCw size={14} className={syncing ? 'animate-spin text-[#1A2766]' : ''} />
            {syncing ? 'Syncing...' : 'Sync Zoho Data'}
          </button>
        </div>
      </div>

      {/* Real-time Sync Zoho Data Live Progress Modal */}
      <SyncZohoProgressModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        syncRunId={activeSyncRunId}
        allowZohoWrites={allowZohoWrites}
        onSyncCompleted={() => {
          fetchQueue();
        }}
      />

      {/* Real-time Verified Payment Integrity Audit Modal */}
      <AuditVerifiedPaymentsModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        auditRunId={activeAuditRunId}
        allowZohoWrites={allowZohoWrites}
        onAuditCompleted={() => {
          fetchQueue();
        }}
      />

      {/* Accidental Click Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-amber-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-extrabold text-gray-900">
                Enable Real Zoho Books Writes?
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This will allow this <strong>LOCAL ERP instance</strong> to make real verification updates to Zoho Books (<code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[11px]">cf_is_verified = true</code>).
              <br /><br />
              Continue?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEnableWrites}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
              >
                Enable Zoho Writes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Pending Verification</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {stats.pendingVerification}
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-1">
            {stats.reverificationRequired && stats.reverificationRequired > 0 ? (
              <span className="text-red-600 font-bold">
                {stats.reverificationRequired} re-verification required
              </span>
            ) : (
              'Requires review'
            )}
          </p>
        </div>

        {/* Card 2: Auto Verified */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Auto Verified (This Week)</span>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <Landmark size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {stats.autoVerifiedThisWeek}
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-1">Bank feed matched</p>
        </div>

        {/* Card 3: Cash Pending */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Cash Pending</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Banknote size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {stats.cashPending}
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Manual action required</p>
        </div>

        {/* Card 4: Verified This Week */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Verified (This Week)</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {stats.verifiedThisWeek}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Completed &amp; synced</p>
        </div>
      </div>

      {/* ── WORKSPACE SPLIT LAYOUT ── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-2xs">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[#1A2766] mb-3" />
          <p className="text-xs font-semibold text-gray-600">Loading payment verification queue...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-2xs">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Check size={28} strokeWidth={2.5} />
          </div>
          <h3 className="text-base font-bold text-gray-900">All Payments Verified</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            There are currently no customer payments pending verification in the local queue.
          </p>
          <button
            onClick={handleSync}
            className="mt-4 px-4 py-2 text-xs font-bold text-[#1A2766] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Check for New Payments in Zoho
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT: PENDING PAYMENTS LIST (5 cols) ── */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800">Pending Payments</span>
                <span className="bg-gray-200 text-gray-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {filteredPayments.length}
                </span>
              </div>

              {/* Mode Filter */}
              <select
                value={modeFilter}
                onChange={(e) => {
                  setModeFilter(e.target.value);
                  setSelectedIndex(0);
                }}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 font-medium outline-none focus:border-[#1A2766]"
              >
                <option value="ALL">All Modes</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="POS Device">POS Device</option>
              </select>
            </div>

            <div className="divide-y divide-gray-100 max-h-[620px] overflow-y-auto">
              {filteredPayments.map((p, idx) => {
                const isSelected = idx === safeIndex;
                const formattedIndex = String(idx + 1).padStart(2, '0');
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedIndex(idx)}
                    className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-50/60 border-l-4 border-l-[#1A2766]'
                        : 'hover:bg-gray-50/80 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {formattedIndex}
                        </span>
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {p.customerName}
                        </span>
                      </div>
                      <span className="text-xs font-black text-gray-900 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-600 font-medium">
                          {p.paymentNumber}
                        </span>
                        <span>•</span>
                        <span>{formatDate(p.paymentDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.verificationStatus === 'REVERIFICATION_REQUIRED' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                            Re-verify
                          </span>
                        )}
                        {getModeBadge(p.paymentMode)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: FOCUSED VERIFICATION PANEL (7 cols) ── */}
          {currentPayment && (
            <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex flex-col">
              {/* Panel Top Nav & Counter */}
              <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#1A2766] uppercase tracking-wider">
                    Payment Verification
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">
                    ({safeIndex + 1} of {filteredPayments.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    disabled={safeIndex === 0}
                    title="Previous Payment"
                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={safeIndex === filteredPayments.length - 1}
                    title="Next Payment"
                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="p-6 space-y-6">
                {/* Hero Amount & Customer Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">
                      {currentPayment.customerName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>Payment #: <strong className="text-gray-700 font-mono">{currentPayment.paymentNumber}</strong></span>
                      <span>•</span>
                      <span>Zoho ID: <span className="font-mono">{currentPayment.zohoPaymentId}</span></span>
                    </div>
                  </div>

                  <div className="text-right sm:text-right">
                    <div className="text-2xl font-black text-[#1A2766] tracking-tight">
                      {formatCurrency(currentPayment.amount)}
                    </div>
                    <div className="mt-1">{getModeBadge(currentPayment.paymentMode)}</div>
                  </div>
                </div>

                {/* Key Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Payment Date
                    </span>
                    <span className="font-bold text-gray-800">
                      {formatDate(currentPayment.paymentDate)}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Deposit Account
                    </span>
                    <span className="font-bold text-gray-800 truncate block" title={currentPayment.accountName || ''}>
                      {currentPayment.accountName || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Reference Number
                    </span>
                    <span className="font-bold text-gray-800 font-mono">
                      {currentPayment.referenceNumber || 'None'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Location / Branch
                    </span>
                    <span className="font-bold text-gray-800 truncate block">
                      {zohoDetail.location_name || zohoDetail.branch_name || 'Budh Vihar Meerut'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Payment Type
                    </span>
                    <span className="font-bold text-gray-800">
                      {zohoDetail.payment_type || 'Customer Advance'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-100">
                    <span className="block text-gray-400 font-semibold uppercase text-[10px] tracking-wider mb-0.5">
                      Status
                    </span>
                    {isVoidPayment ? (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded text-[11px] border border-red-300">
                        <AlertCircle size={11} />
                        Void (Zoho Books)
                      </span>
                    ) : currentPayment.verificationStatus === 'REVERIFICATION_REQUIRED' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded text-[11px] border border-red-200">
                        <AlertCircle size={11} />
                        Re-verification Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                        <Clock size={11} />
                        Pending Verification
                      </span>
                    )}
                  </div>
                </div>

                {/* Re-verification Invalidation Banner */}
                {currentPayment.verificationStatus === 'REVERIFICATION_REQUIRED' && (
                  <div className="p-3.5 bg-red-50/80 border border-red-300 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-red-900">
                      <AlertCircle size={15} className="text-red-600 shrink-0" />
                      Verification Invalidated — Manual Re-verification Required
                    </div>
                    <p className="text-red-700 text-[11px] leading-relaxed">
                      {currentPayment.verificationInvalidationReason ||
                        'Payment amount or date was modified in Zoho Books after initial verification. Auto-verification is disabled for this record.'}
                    </p>
                  </div>
                )}

                {/* VOID / CANCELLED Ineligible Banner */}
                {isVoidPayment && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-extrabold text-red-900 text-sm">
                      <AlertCircle size={18} className="text-red-600 shrink-0" />
                      Payment Ineligible — Voided in Zoho Books
                    </div>
                    <p className="text-red-800 text-xs leading-relaxed font-medium">
                      This payment is no longer eligible for verification because it has been voided or cancelled in Zoho Books. Audit Verification is disabled.
                    </p>
                  </div>
                )}

                {/* Description / Remarks */}
                {currentPayment.description && (
                  <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200/60 text-xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Bank Narration / Description
                    </span>
                    <p className="text-gray-700 font-mono leading-relaxed break-all">
                      {currentPayment.description}
                    </p>
                  </div>
                )}

                {/* ── BANK TRANSACTION MATCH CARD ── */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                    Bank Transaction Status
                  </span>

                  {primaryImportedTxn ? (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          Matched with Bank Transaction
                        </div>
                        <span className="bg-emerald-200/70 text-emerald-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                          {primaryImportedTxn.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-gray-600 pt-1">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Imported Txn ID</span>
                          <span className="font-mono font-bold text-gray-800">
                            {primaryImportedTxn.imported_transaction_id}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Date</span>
                          <span className="font-semibold text-gray-800">
                            {primaryImportedTxn.date}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Amount</span>
                          <span className="font-bold text-gray-800">
                            {formatCurrency(primaryImportedTxn.amount)}
                          </span>
                        </div>
                      </div>

                      {primaryImportedTxn.description && (
                        <div className="text-[10px] font-mono text-emerald-900 bg-white/70 p-2 rounded border border-emerald-100 break-all">
                          {primaryImportedTxn.description}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                      <div className="p-1 bg-gray-200 text-gray-600 rounded-md shrink-0">
                        <AlertCircle size={16} />
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-gray-800">No Bank Transaction Match</div>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          {currentPayment.paymentMode === 'Bank Transfer'
                            ? 'This bank transfer has not yet been matched with a bank statement feed in Zoho Books.'
                            : 'Cash and POS payments do not have bank feed matching and require manual verification.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── APPLIED INVOICES SECTION ── */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                    Applied Invoices ({appliedInvoices.length})
                  </span>

                  {appliedInvoices.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                          <tr>
                            <th className="py-2 px-3">Invoice #</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3 text-right">Invoice Total</th>
                            <th className="py-2 px-3 text-right">Applied</th>
                            <th className="py-2 px-3 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {appliedInvoices.map((inv: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="py-2 px-3 font-mono font-bold text-[#1A2766]">
                                {inv.invoice_number}
                              </td>
                              <td className="py-2 px-3 text-gray-600">{inv.date}</td>
                              <td className="py-2 px-3 text-right font-medium text-gray-700">
                                {formatCurrency(inv.total)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                {formatCurrency(inv.amount_applied)}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-600">
                                {formatCurrency(inv.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 italic">
                      Payment is unapplied / Customer Advance.
                    </div>
                  )}
                </div>

                {/* ── 6-FIELD AUDIT VERIFICATION CARD ── */}
                {!isVoidPayment ? (
                  <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-indigo-100/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#1A2766] uppercase tracking-wider">
                            Audit Verification Checklist
                          </span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                            allFieldsVerified
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {verifiedFieldsCount} of 6 verified
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Verify all 6 critical payment fields (read-only) before marking this payment as Audit Verified.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={verifyAllFields}
                        className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-300 hover:bg-indigo-50 rounded-lg shadow-2xs transition-colors self-start sm:self-auto flex items-center gap-1.5 shrink-0"
                      >
                        <CheckCircle2 size={13} className="text-indigo-600" />
                        Verify All (6 Fields)
                      </button>
                    </div>

                    {/* 6 Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. Customer Name */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            1. Customer Name
                          </span>
                          <span className="text-xs font-bold text-gray-900 truncate block mt-0.5" title={currentPayment.customerName}>
                            {currentPayment.customerName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('customerName')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.customerName
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.customerName ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>

                      {/* 2. Amount Received */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            2. Amount Received
                          </span>
                          <span className="text-xs font-black text-[#1A2766] truncate block mt-0.5">
                            {formatCurrency(currentPayment.amount)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('amount')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.amount
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.amount ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>

                      {/* 3. Bank Charges */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            3. Bank Charges
                          </span>
                          <span className="text-xs font-bold text-gray-800 truncate block mt-0.5">
                            {formatCurrency(currentPayment.bankCharges ?? zohoDetail.bank_charges ?? 0)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('bankCharges')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.bankCharges
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.bankCharges ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>

                      {/* 4. Payment Date */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            4. Payment Date
                          </span>
                          <span className="text-xs font-bold text-gray-800 truncate block mt-0.5">
                            {formatDate(currentPayment.paymentDate)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('paymentDate')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.paymentDate
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.paymentDate ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>

                      {/* 5. Payment Mode */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            5. Payment Mode
                          </span>
                          <div className="mt-0.5">
                            {getModeBadge(currentPayment.paymentMode)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('paymentMode')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.paymentMode
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.paymentMode ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>

                      {/* 6. Deposit To */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200/80 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            6. Deposit To
                          </span>
                          <span className="text-xs font-bold text-gray-800 truncate block mt-0.5" title={currentPayment.accountName || zohoDetail.account_name || 'N/A'}>
                            {currentPayment.accountName || zohoDetail.account_name || 'N/A'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldVerification('depositTo')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            verifiedFields.depositTo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {verifiedFields.depositTo ? (
                            <>
                              <Check size={12} strokeWidth={3} className="text-emerald-600" />
                              Verified
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 text-center text-xs text-red-700 font-medium">
                    Audit Verification Checklist is disabled because this payment is voided in Zoho Books.
                  </div>
                )}

                {/* ── ACTION BUTTONS ── */}
                <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-gray-500 font-medium">
                    {isVoidPayment ? (
                      <span className="text-red-700 font-bold flex items-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0" />
                        Payment is voided in Zoho Books and cannot be verified.
                      </span>
                    ) : !allFieldsVerified ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0" />
                        Verify all 6 fields to enable payment verification ({6 - verifiedFieldsCount} remaining)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="shrink-0" />
                        All 6 fields verified. Ready to record Audit Verification.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={verifying}
                      className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs"
                    >
                      SKIP
                    </button>

                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying || !canAction || !allFieldsVerified || isVoidPayment}
                      title={
                        isVoidPayment
                          ? 'This payment is no longer eligible for verification because it has been voided in Zoho Books.'
                          : !canAction
                          ? 'You do not have action permissions to verify'
                          : !allFieldsVerified
                          ? 'Please verify all six payment fields before marking this payment as Audit Verified.'
                          : 'Verify this payment and update Zoho Books'
                      }
                      className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-lg transition-all shadow-xs ${
                        !allFieldsVerified || isVoidPayment
                          ? 'bg-gray-400 cursor-not-allowed opacity-60'
                          : 'bg-[#1A2766] hover:bg-[#003347] disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {verifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          VERIFY PAYMENT
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM: ZOHO API CALLS USAGE TRACKER ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-extrabold text-[#1A2766]">
            Today's Global Zoho API Usage: <span className="font-mono text-sm">{zohoApiUsage.total}</span>
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            (Resets 00:00 IST)
          </span>
        </div>

        <div className="flex items-center gap-3 text-gray-600 text-[11px] font-medium flex-wrap">
          <span>
            Payment List <strong className="font-mono text-gray-900">{zohoApiUsage.paymentListCalls}</strong>
          </span>
          <span className="text-gray-300">•</span>
          <span>
            Payment Details <strong className="font-mono text-gray-900">{zohoApiUsage.paymentDetailCalls}</strong>
          </span>
          <span className="text-gray-300">•</span>
          <span>
            Payment Updates <strong className="font-mono text-gray-900">{zohoApiUsage.paymentUpdateCalls}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

