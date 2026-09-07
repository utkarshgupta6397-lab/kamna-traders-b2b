import React from 'react';
import { getSession } from '@/lib/auth';
import PreDispatchWorkflowClient from './PreDispatchWorkflowClient';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const isAdmin = session?.role === 'ADMIN';
  const permissions = {
    isAdmin,
    canRateReview: isAdmin || Boolean(session?.dispatch_rate_review),
    canPaymentVerify: isAdmin || Boolean(session?.dispatch_payment_verification),
    canTruckDetails: isAdmin || Boolean(session?.dispatch_truck_details),
    canReadyForInvoice: isAdmin || Boolean(session?.dispatch_ready_for_invoice),
    canInvoiceConfirm: isAdmin || Boolean(session?.dispatch_invoice_confirmation),
    canWorkflowOverride: isAdmin || Boolean(session?.dispatch_workflow_override),
  };

  return <PreDispatchWorkflowClient id={id} permissions={permissions} />;
}

