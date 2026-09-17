'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Search,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage } from '@/lib/image-compress';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';
import { formatIndianCurrency } from '@/lib/formatters';
import PaymentStatusBadge from '@/components/mobile/manage-payments/PaymentStatusBadge';

interface CustomerOption {
  id: string;
  name: string;
  gstNumber?: string | null;
  status: string;
}

interface SubmittedPaymentData {
  id: string;
  requestNumber: string;
  customerName: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  photoUrl: string;
  status: string;
}

interface RecordPaymentClientProps {
  minDateStr: string;
  maxDateStr: string;
  userName: string;
}

export default function RecordPaymentClient({
  minDateStr,
  maxDateStr,
  userName,
}: RecordPaymentClientProps) {
  const router = useRouter();

  // Refs for smooth scroll & auto-focus
  const customerInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const modeSectionRef = useRef<HTMLDivElement>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerOption[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(maxDateStr);
  const [dateError, setDateError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'POS'>('POS');

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<SubmittedPaymentData | null>(null);

  // Progressive Sequential Unlocking Conditions
  const isCustomerSelected = Boolean(selectedCustomer);

  const numericAmount = parseFloat(amount);
  const isAmountValid =
    isCustomerSelected &&
    !isNaN(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= 200000 &&
    !amountError;

  const isDateValid =
    isAmountValid &&
    Boolean(paymentDate) &&
    paymentDate >= minDateStr &&
    paymentDate <= maxDateStr &&
    !dateError;

  const isModeActive = isDateValid;
  const isPhotoUnlocked = isModeActive && paymentMode === 'POS';
  const isPhotoCaptured = Boolean(photoFile && photoPreviewUrl);

  const isFormComplete = isCustomerSelected && isAmountValid && isDateValid && isPhotoCaptured;

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (!val.trim()) {
      setAmountError(null);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setAmountError('Enter a payment amount greater than ₹0.');
    } else if (num > 200000) {
      setAmountError('Maximum payment amount is ₹2,00,000.');
    } else {
      setAmountError(null);
    }
  };

  const handleDateChange = (val: string) => {
    setPaymentDate(val);
    if (!val) {
      setDateError('Please select a payment date.');
      return;
    }
    if (val > maxDateStr) {
      setDateError('Future dates are not allowed. Please select today or an earlier date.');
    } else if (val < minDateStr) {
      setDateError('Payments older than 15 days cannot be recorded. Please select another date.');
    } else {
      setDateError(null);
    }
  };

  // Auto-focus customer input on initial load
  useEffect(() => {
    customerInputRef.current?.focus();
  }, []);

  // Debounced customer search
  useEffect(() => {
    if (!searchQuery.trim() || selectedCustomer) {
      setCustomerSuggestions([]);
      setIsSearchingCustomers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const res = await fetch(
          `/api/mobile/manage-payments/customers?q=${encodeURIComponent(searchQuery.trim())}`
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setCustomerSuggestions(data.customers || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCustomer]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  // Handle Customer Selection
  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomer(cust);
    setSearchQuery('');
    setShowDropdown(false);

    // Auto-focus amount field after customer selection
    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };

  // Handle Customer Change (Backtracking)
  const handleChangeCustomer = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setAmount('');
    setAmountError(null);
    setPaymentDate(maxDateStr);
    setDateError(null);
    handleRemovePhoto();

    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);
  };

  // Photo change handler with compression
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPhotoUnlocked) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsCompressingPhoto(true);

    try {
      const result = await compressImage(file, {
        maxEdge: 1600,
        quality: 0.8,
      });

      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }

      const newPreview = URL.createObjectURL(result.file);
      setPhotoFile(result.file);
      setPhotoPreviewUrl(newPreview);
      toast.success('Photo captured and compressed');
    } catch (err) {
      console.error('Failed to compress image:', err);
      toast.error('Failed to process image');
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete || isSubmitting) return;

    if (!photoFile) {
      toast.error('Receipt / slip photo is mandatory for POS payment');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Submitting payment request...');

    try {
      // 1. Upload mandatory photo
      const formData = new FormData();
      formData.append('file', photoFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || 'Failed to upload receipt photo');
      }

      const uploadedPhotoUrl = uploadData.url;

      // 2. Client-generated unique idempotency key
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // 3. Post payment request
      const res = await fetch('/api/mobile/manage-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer!.id,
          amount: numericAmount,
          paymentDate,
          paymentMode: 'POS',
          photoUrl: uploadedPhotoUrl,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment request');
      }

      toast.success(
        data.isDuplicate
          ? 'Payment request already submitted'
          : 'Payment submitted for approval',
        { id: toastId }
      );

      // Transition to confirmation screen
      setSubmittedPayment({
        id: data.payment.id,
        requestNumber: data.payment.requestNumber,
        customerName: selectedCustomer!.name,
        customerId: selectedCustomer!.id,
        amount: numericAmount,
        paymentDate,
        paymentMode: 'POS',
        photoUrl: uploadedPhotoUrl,
        status: data.payment.status || 'PENDING_APPROVAL',
      });
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Payment submission failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setAmount('');
    setPaymentDate(maxDateStr);
    handleRemovePhoto();
    setSubmittedPayment(null);

    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIRMATION SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (submittedPayment) {
    return (
      <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
        <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
          <div className="flex items-center px-2 min-h-[56px] py-1">
            <Link
              href="/mobile/accounts/manage-payments"
              className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
              <span className="font-bold text-[15px]">Manage Payments</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 max-w-[430px] mx-auto w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm border border-emerald-200">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <h1 className="text-[22px] font-black text-[#1A2766] tracking-tight text-center">
            Payment Submitted
          </h1>
          <p className="text-slate-500 text-xs text-center mt-1 mb-6 max-w-[280px]">
            Your payment request has been submitted for approval.
          </p>

          <div className="w-full bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Request ID
                </span>
                <span className="font-mono text-sm font-bold text-slate-800">
                  {submittedPayment.requestNumber}
                </span>
              </div>
              <PaymentStatusBadge status={submittedPayment.status} size="sm" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-slate-500 font-medium">Customer</span>
                <div className="text-right max-w-[210px]">
                  <span className="font-bold text-slate-900 block truncate">
                    {submittedPayment.customerName}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {submittedPayment.customerId}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Amount</span>
                <span className="font-extrabold text-[15px] text-[#1A2766]">
                  {formatIndianCurrency(submittedPayment.amount, false)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Date</span>
                <span className="font-semibold text-slate-800">
                  {submittedPayment.paymentDate}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Mode</span>
                <span className="font-bold text-slate-800 px-2.5 py-1 bg-slate-100 rounded text-[11px]">
                  {submittedPayment.paymentMode}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                <span className="text-slate-500 font-medium">Receipt Photo</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  <span>Attached (Mandatory POS)</span>
                </span>
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3">
            <Link
              href="/mobile/accounts/manage-payments"
              className="w-full py-3.5 bg-[#1A2766] text-white text-center rounded-xl font-bold text-sm shadow-sm active:scale-[0.98] transition-transform"
            >
              View in My Payments
            </Link>

            <button
              type="button"
              onClick={handleResetForm}
              className="w-full py-3.5 bg-white text-[#1A2766] border border-slate-200 text-center rounded-xl font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Record Another Payment
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEQUENTIAL PROGRESSIVE RECORD PAYMENT FORM
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts/manage-payments"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Cancel</span>
          </Link>

          <span className="font-bold text-[16px] tracking-tight">Record Payment</span>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full pb-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* STEP 1: Customer Selection (Active on load) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>
                Customer <span className="text-red-500">*</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Step 1</span>
            </label>

            {!selectedCustomer ? (
              <div className="relative">
                <div className="relative flex items-center">
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    placeholder="Search by customer name or ID..."
                    className="w-full pl-10 pr-10 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1A2766] shadow-sm transition-all"
                  />
                  <Search size={18} className="absolute left-3.5 text-slate-400" />
                  {isSearchingCustomers ? (
                    <Loader2 size={18} className="absolute right-3.5 text-slate-400 animate-spin" />
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCustomerSuggestions([]);
                      }}
                      className="absolute right-3 text-slate-400 p-1"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>

                {isSearchingCustomers && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 divide-y divide-slate-100 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 flex flex-col gap-2">
                        <div className="h-4 w-44 bg-slate-200 rounded" />
                        <div className="h-3 w-28 bg-slate-100 rounded" />
                      </div>
                    ))}
                  </div>
                )}

                {!isSearchingCustomers && showDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {customerSuggestions.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full p-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors flex flex-col gap-0.5"
                      >
                        <span className="font-bold text-slate-800 text-sm truncate">
                          {cust.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>ID: {cust.id}</span>
                          {cust.gstNumber && <span>· GST: {cust.gstNumber}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!isSearchingCustomers && showDropdown && searchQuery && customerSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-lg z-30 text-center text-xs text-slate-500 font-medium">
                    No customers found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            ) : (
              /* Selected Customer Card */
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {selectedCustomer.name}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      ID: {selectedCustomer.id}
                      {selectedCustomer.gstNumber && ` · GST: ${selectedCustomer.gstNumber}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleChangeCustomer}
                  className="px-2.5 py-1.5 text-xs font-bold text-[#1A2766] hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: Payment Amount (Unlocked after customer selection) */}
          <div
            className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
              isCustomerSelected ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <div className="flex justify-between items-center">
              <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>
                  Payment Amount <span className="text-red-500">*</span>
                </span>
                {!isCustomerSelected && <Lock size={12} className="text-slate-400" />}
              </label>
              {isAmountValid && (
                <span className="text-[12px] font-bold text-emerald-600">
                  {formatIndianCurrency(numericAmount, false)}
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400 font-bold text-lg">₹</span>
              <input
                ref={amountInputRef}
                type="number"
                inputMode="decimal"
                step="any"
                min="1"
                max="200000"
                placeholder="0.00"
                value={amount}
                disabled={!isCustomerSelected}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`w-full pl-9 pr-4 py-3.5 bg-white border rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2766] shadow-sm tracking-tight disabled:bg-slate-100 disabled:text-slate-400 ${
                  amountError ? 'border-red-400 focus:ring-red-500' : 'border-slate-200'
                }`}
                required
              />
            </div>
            {amountError && (
              <p className="text-xs font-semibold text-red-600 mt-0.5">
                {amountError}
              </p>
            )}
          </div>

          {/* STEP 3: Payment Date (Unlocked after valid amount) */}
          <div
            className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
              isAmountValid ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>
                Payment Date <span className="text-red-500">*</span>
              </span>
              {!isAmountValid && <Lock size={12} className="text-slate-400" />}
            </label>
            <div className="relative flex items-center">
              <input
                ref={dateInputRef}
                type="date"
                value={paymentDate}
                disabled={!isAmountValid}
                onChange={(e) => handleDateChange(e.target.value)}
                className={`w-full px-4 py-3.5 bg-white border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A2766] shadow-sm disabled:bg-slate-100 disabled:text-slate-400 ${
                  dateError ? 'border-red-400 focus:ring-red-500' : 'border-slate-200'
                }`}
                required
              />
            </div>
            {dateError && (
              <p className="text-xs font-semibold text-red-600 mt-0.5">
                {dateError}
              </p>
            )}
          </div>

          {/* STEP 4: Payment Mode (Segmented toggle buttons, POS active, others disabled) */}
          <div
            ref={modeSectionRef}
            className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
              isModeActive ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>
                Payment Mode <span className="text-red-500">*</span>
              </span>
              {!isModeActive && <Lock size={12} className="text-slate-400" />}
            </label>

            {/* Segmented Toggle Group */}
            <div className="grid grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
              {/* POS (Active & Enabled) */}
              <button
                type="button"
                disabled={!isModeActive}
                className="py-2.5 px-2 rounded-xl text-center font-extrabold text-xs transition-all bg-[#1A2766] text-white shadow-sm flex flex-col items-center justify-center gap-0.5"
              >
                <span>POS</span>
                <span className="text-[9px] font-medium opacity-80">Terminal</span>
              </button>

              {/* Cash (Disabled - Coming later) */}
              <button
                type="button"
                disabled
                title="Coming later"
                className="py-2.5 px-2 rounded-xl text-center text-xs font-semibold text-slate-400 bg-slate-200/50 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
              >
                <span>Cash</span>
                <span className="text-[9px] font-medium text-slate-400">Later</span>
              </button>

              {/* UPI (Disabled - Coming later) */}
              <button
                type="button"
                disabled
                title="Coming later"
                className="py-2.5 px-2 rounded-xl text-center text-xs font-semibold text-slate-400 bg-slate-200/50 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
              >
                <span>UPI</span>
                <span className="text-[9px] font-medium text-slate-400">Later</span>
              </button>

              {/* Other (Disabled - Coming later) */}
              <button
                type="button"
                disabled
                title="Coming later"
                className="py-2.5 px-2 rounded-xl text-center text-xs font-semibold text-slate-400 bg-slate-200/50 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
              >
                <span>Other</span>
                <span className="text-[9px] font-medium text-slate-400">Later</span>
              </button>
            </div>
          </div>

          {/* STEP 5: Receipt / Slip Photo (MANDATORY for POS) */}
          <div
            ref={photoSectionRef}
            className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
              isPhotoUnlocked ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>RECEIPT / SLIP PHOTO</span>
                <span className="text-red-500">*</span>
                {!isPhotoUnlocked && <Lock size={12} className="text-slate-400" />}
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Required for POS
              </span>
            </label>

            {/* Hidden Camera Input (Camera only, no gallery) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={!isPhotoUnlocked}
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {!photoPreviewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isPhotoUnlocked || isCompressingPhoto}
                className="w-full flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-slate-300 active:bg-slate-50 transition-colors gap-2 disabled:bg-slate-50 disabled:border-slate-200"
              >
                {isCompressingPhoto ? (
                  <>
                    <Loader2 size={24} className="text-[#1A2766] animate-spin" />
                    <span className="text-xs font-semibold text-slate-600">
                      Compressing photo...
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Camera size={22} />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-800 block">
                        Tap to Capture Photo
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Opens device camera · Auto-compressed
                      </span>
                    </div>
                  </>
                )}
              </button>
            ) : (
              /* Photo Preview Thumbnail & Actions */
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                <div
                  className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer group bg-slate-900"
                  onClick={() => setIsFullscreenPreviewOpen(true)}
                >
                  <img
                    src={photoPreviewUrl}
                    alt="Receipt proof photo"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <Eye size={16} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    Receipt Photo Attached
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">
                    Ready for submission
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all text-xs font-bold flex items-center gap-1"
                    title="Retake photo"
                  >
                    <RotateCcw size={15} />
                    <span>Retake</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 active:scale-95 transition-all text-xs font-bold"
                    title="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 6: Submit Payment Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormComplete || isSubmitting || isCompressingPhoto}
              className="w-full py-4 bg-[#1A2766] text-white font-bold text-sm rounded-xl shadow-[0_2px_12px_rgba(26,39,102,0.25)] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting Payment...</span>
                </>
              ) : (
                <span>Submit Payment</span>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Fullscreen Photo Preview Modal */}
      {photoPreviewUrl && (
        <MobileImagePreview
          isOpen={isFullscreenPreviewOpen}
          onClose={() => setIsFullscreenPreviewOpen(false)}
          imageUrl={photoPreviewUrl}
          title="Receipt Proof Preview"
          subtitle={selectedCustomer ? selectedCustomer.name : 'Payment Proof'}
        />
      )}
    </div>
  );
}
