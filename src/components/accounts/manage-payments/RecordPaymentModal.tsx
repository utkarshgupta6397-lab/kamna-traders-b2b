'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Search,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  IndianRupee,
  Building2,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage } from '@/lib/image-compress';
import { formatIndianCurrency } from '@/lib/formatters';
import { getAllowedPaymentDateRangeIST } from '@/lib/manage-payments';

interface CustomerOption {
  id: string;
  name: string;
  gstNumber?: string | null;
  status?: string;
}

interface SubmittedData {
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

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const { minDate, maxDate } = getAllowedPaymentDateRangeIST();

  const customerInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerOption[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const [paymentDate, setPaymentDate] = useState(maxDate);
  const [dateError, setDateError] = useState<string | null>(null);

  const [paymentMode] = useState<'POS'>('POS');

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [previewLightboxOpen, setPreviewLightboxOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<SubmittedData | null>(null);

  // Auto-focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        customerInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Clean object URL on unmount or change
  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

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
        console.error('[Customer Search Error]', err);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCustomer]);

  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomer(cust);
    setSearchQuery('');
    setShowDropdown(false);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);
  };

  // Amount validation
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

  // Date validation (Allowed range: Today through 15 calendar days before today)
  const handleDateChange = (val: string) => {
    setPaymentDate(val);
    if (!val) {
      setDateError('Please select a payment date.');
      return;
    }
    if (val > maxDate) {
      setDateError('Future dates are not allowed. Please select today or an earlier date.');
    } else if (val < minDate) {
      setDateError('Payments older than 15 days cannot be recorded. Please select another date.');
    } else {
      setDateError(null);
    }
  };

  // Photo handling
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPEG, PNG, WebP)');
      return;
    }

    try {
      setIsCompressingPhoto(true);
      const result = await compressImage(file, { maxEdge: 1600, quality: 0.8 });
      setPhotoFile(result.file);

      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(result.file);
      setPhotoPreviewUrl(previewUrl);
    } catch (err) {
      console.error('Image compression error:', err);
      // Fallback to original
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl(previewUrl);
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  // Form validity check
  const numericAmount = parseFloat(amount);
  const isCustomerValid = Boolean(selectedCustomer);
  const isAmountValid =
    !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= 200000 && !amountError;
  const isDateValid = Boolean(paymentDate) && paymentDate >= minDate && paymentDate <= maxDate && !dateError;
  const isPhotoValid = Boolean(photoFile && photoPreviewUrl);

  const isFormComplete = isCustomerValid && isAmountValid && isDateValid && isPhotoValid;

  // Submit
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

      // 2. Client-generated UUID idempotency key
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // 3. POST to existing payment endpoint
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
        throw new Error(data.error || 'Failed to record payment');
      }

      toast.success(
        data.isDuplicate ? 'Payment request already submitted' : 'Payment Submitted',
        { id: toastId }
      );

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

      onSuccess();
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Payment submission failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndRecordAnother = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setAmount('');
    setAmountError(null);
    setPaymentDate(maxDate);
    setDateError(null);
    handleRemovePhoto();
    setSubmittedPayment(null);
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <IndianRupee size={18} className="text-[#1A2766]" />
              Record Payment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit a new customer payment request for approval.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {submittedPayment ? (
            /* Success State */
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-in zoom-in-50 duration-200">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Payment Submitted</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Payment request has been recorded and is pending management approval.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-left space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Payment Request Number</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {submittedPayment.requestNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Customer</span>
                  <span className="font-bold text-slate-900 text-right max-w-[60%] truncate">
                    {submittedPayment.customerName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Payment Amount</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatIndianCurrency(submittedPayment.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Payment Date</span>
                  <span className="font-semibold text-slate-800">{submittedPayment.paymentDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Payment Mode</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    POS Device
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndRecordAnother}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
                >
                  Record Another Payment
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#1A2766] hover:bg-[#152055] rounded-lg transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Customer Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer <span className="text-red-500">*</span>
                </label>

                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{selectedCustomer.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">
                          ID: {selectedCustomer.id}
                          {selectedCustomer.gstNumber ? ` • GST: ${selectedCustomer.gstNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="text-xs font-semibold text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-white transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      ref={customerInputRef}
                      type="text"
                      placeholder="Search customer by name or customer ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (customerSuggestions.length > 0) setShowDropdown(true);
                      }}
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] transition-all"
                    />
                    {isSearchingCustomers && (
                      <Loader2
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                      />
                    )}

                    {/* Autocomplete Dropdown */}
                    {showDropdown && customerSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {customerSuggestions.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => handleSelectCustomer(cust)}
                            className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <p className="text-xs font-bold text-slate-900">{cust.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ID: {cust.id}
                              {cust.gstNumber ? ` • GST: ${cust.gstNumber}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Amount (INR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    ₹
                  </span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="0.01"
                    min="1"
                    max="200000"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className={`w-full pl-8 pr-4 py-2 text-sm font-semibold rounded-xl border ${
                      amountError
                        ? 'border-red-400 bg-red-50/40 text-red-900'
                        : 'border-slate-200 bg-slate-50 focus:bg-white text-slate-900'
                    } focus:outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] transition-all tabular-nums`}
                  />
                </div>
                {amountError && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {amountError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Maximum allowed payment amount is ₹2,00,000.</p>
              </div>

              {/* 3. Payment Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                      dateError
                        ? 'border-red-400 bg-red-50/40 text-red-900'
                        : 'border-slate-200 bg-slate-50 focus:bg-white text-slate-900'
                    } focus:outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] transition-all`}
                  />
                </div>
                {dateError && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {dateError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Allowed range: Today through 15 days ago ({minDate} to {maxDate}).
                </p>
              </div>

              {/* 4. Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    className="py-2 px-3 rounded-xl border-2 border-[#1A2766] bg-blue-50/40 text-[#1A2766] text-xs font-bold text-center shadow-xs"
                  >
                    POS Device
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-medium text-center cursor-not-allowed opacity-60"
                    title="Available in future phase"
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-medium text-center cursor-not-allowed opacity-60"
                    title="Available in future phase"
                  >
                    UPI
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-medium text-center cursor-not-allowed opacity-60"
                    title="Available in future phase"
                  >
                    Other
                  </button>
                </div>
              </div>

              {/* 5. Receipt / Slip Photo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Receipt / Slip Photo <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Auto-compressed to ~1600px
                  </span>
                </div>

                {photoPreviewUrl ? (
                  <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setPreviewLightboxOpen(true)}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer relative group shrink-0"
                      >
                        <img
                          src={photoPreviewUrl}
                          alt="Receipt Preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye size={16} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                          {photoFile?.name || 'receipt_slip.jpg'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {photoFile ? `${Math.round(photoFile.size / 1024)} KB` : 'Attached'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreviewLightboxOpen(true)}
                          className="text-[11px] font-semibold text-[#1A2766] hover:underline mt-0.5 inline-block"
                        >
                          View Full Image
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                        title="Retake / Change Photo"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Remove Photo"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      isCompressingPhoto
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-400'
                    }`}
                  >
                    {isCompressingPhoto ? (
                      <div className="flex flex-col items-center justify-center py-2">
                        <Loader2 size={24} className="text-[#1A2766] animate-spin mb-1" />
                        <p className="text-xs font-semibold text-slate-700">Compressing receipt image...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-1">
                        <UploadCloud size={28} className="text-slate-400 mb-1" />
                        <p className="text-xs font-bold text-slate-700">
                          Click to upload receipt / POS slip photo
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Supports JPEG, PNG, WebP. Captured or scanned photo.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {!submittedPayment && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="record-payment-form"
              disabled={!isFormComplete || isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#1A2766] hover:bg-[#152055] rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Payment'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Preview */}
      {previewLightboxOpen && photoPreviewUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewLightboxOpen(false)}
        >
          <div className="relative max-w-2xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewLightboxOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X size={24} />
            </button>
            <img
              src={photoPreviewUrl}
              alt="Receipt Full Preview"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
