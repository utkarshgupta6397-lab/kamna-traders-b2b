import React from 'react';
import Link from 'next/link';
import { ChevronRight, Calendar, User, CreditCard } from 'lucide-react';
import PaymentStatusBadge from './PaymentStatusBadge';
import { formatIndianCurrency } from '@/lib/formatters';
import { format } from 'date-fns';

export interface PaymentItem {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  amount: number | string;
  paymentDate: string | Date;
  paymentMode: string;
  photoUrl?: string | null;
  status: string;
  createdById: string;
  createdAt: string | Date;
  customer?: {
    id: string;
    name: string;
    gstNumber?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;
}

interface PaymentCardProps {
  payment: PaymentItem;
  showCreator?: boolean;
}

export default function PaymentCard({ payment, showCreator = false }: PaymentCardProps) {
  const numericAmount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;

  // Format date display
  let dateFormatted = '-';
  try {
    const d = new Date(payment.paymentDate);
    dateFormatted = format(d, 'dd MMM yyyy');
  } catch (e) {
    dateFormatted = String(payment.paymentDate);
  }

  // Submitted time
  let submittedTime = '';
  try {
    const sub = new Date(payment.createdAt);
    submittedTime = format(sub, 'hh:mm a');
  } catch (e) {
    submittedTime = '';
  }

  return (
    <Link
      href={`/mobile/accounts/manage-payments/${payment.id}`}
      className="block bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold text-slate-400 font-mono tracking-tight">
              {payment.requestNumber}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-[15px] leading-tight truncate">
            {payment.customerName || payment.customer?.name || 'Unknown Customer'}
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
            ID: {payment.customerId}
          </p>
        </div>

        <PaymentStatusBadge status={payment.status} size="sm" />
      </div>

      <div className="flex items-end justify-between pt-2.5 border-t border-slate-50 mt-1">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
            Amount
          </span>
          <span className="text-[17px] font-extrabold text-[#1A2766]">
            {formatIndianCurrency(numericAmount, false)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                {payment.paymentMode || 'POS'}
              </span>
              <span>{dateFormatted}</span>
            </div>
            {submittedTime && (
              <span className="text-[10px] text-slate-400 mt-0.5">
                {submittedTime}
              </span>
            )}
          </div>

          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </div>
      </div>

      {showCreator && payment.createdBy?.name && (
        <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <User size={12} className="text-slate-400" />
            <span>By {payment.createdBy.name}</span>
          </span>
        </div>
      )}
    </Link>
  );
}
