import React from 'react';
import { PAYMENT_STATUS_LABELS } from '@/lib/manage-payments';

interface PaymentStatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function PaymentStatusBadge({
  status,
  className = '',
  size = 'md',
}: PaymentStatusBadgeProps) {
  const normalizedStatus = status?.toUpperCase() || 'PENDING_APPROVAL';
  const label = PAYMENT_STATUS_LABELS[normalizedStatus] || status;

  let colorClasses = 'bg-amber-50 text-amber-700 border-amber-200/80';
  let dotClass = 'bg-amber-500';

  if (normalizedStatus === 'APPROVED') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    dotClass = 'bg-emerald-500';
  } else if (normalizedStatus === 'REJECTED') {
    colorClasses = 'bg-red-50 text-red-700 border-red-200/80';
    dotClass = 'bg-red-500';
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border shrink-0 tracking-wide uppercase ${sizeClasses} ${colorClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}
