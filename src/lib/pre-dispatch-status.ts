import { prisma } from './db';
import { format } from 'date-fns';

export type WorkflowStage =
  | 'rate_review'
  | 'payment_verification'
  | 'truck_details'
  | 'ready_for_invoice'
  | 'invoice_confirmation'
  | 'archived'
  | 'sent_back';

export interface ActivePreDispatchOrderItem {
  id: string;
  salesorderNumber: string | null;
  customerName: string;
  warehouse: string;
  stage: WorkflowStage;
  stageBadge: {
    label: string;
    className: string;
  };
  baseTimestamp: string; // ISO string
  formattedTimestamp: string; // e.g. "15 Sep · 09:10 PM"
  total: number | null;
}

/**
 * Determines current workflow stage matching IncomingQueueClient logic.
 */
export function getOrderStage(order: {
  status: string;
  total?: number | null;
  preDispatchWorkflow?: any | null;
}): WorkflowStage {
  if (order.status === 'SENT_BACK_TO_OPS') return 'sent_back';
  if (
    order.status === 'ARCHIVED' ||
    order.preDispatchWorkflow?.overallStatus === 'PRE_DISPATCH_COMPLETED' ||
    order.preDispatchWorkflow?.invoiceConfirmStatus === 'COMPLETED'
  ) {
    return 'archived';
  }

  const wf = order.preDispatchWorkflow;
  if (!wf || wf.rateReviewStatus !== 'COMPLETED') return 'rate_review';
  if (wf.paymentStatus !== 'COMPLETED') return 'payment_verification';
  const isTruckRequired = (order.total ?? 0) > 50000;
  if (isTruckRequired && wf.truckDetailsStatus !== 'COMPLETED') return 'truck_details';
  if (wf.readyForInvoiceStatus !== 'COMPLETED') return 'ready_for_invoice';
  return 'invoice_confirmation';
}

/**
 * Returns stage badge label and Tailwind styling matching Pre-Dispatch design.
 */
export function getStageBadge(order: {
  status: string;
  total?: number | null;
  preDispatchWorkflow?: any | null;
}): { label: string; className: string } {
  const stage = getOrderStage(order);
  switch (stage) {
    case 'sent_back':
      return { label: 'Sent Back to Ops', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'archived':
      return { label: 'Archived', className: 'bg-slate-100 text-slate-700 border-slate-300' };
    case 'invoice_confirmation':
      return { label: 'Invoice Confirmation', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'ready_for_invoice':
      return { label: 'Ready for Invoice', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'truck_details':
      return { label: 'Truck Details', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'payment_verification':
      return { label: 'Payment Verification', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'rate_review':
    default:
      return { label: 'Rate Review', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

/**
 * Resolves source warehouse location from zohoDetailsJson matching IncomingQueueClient.
 */
export function getOrderWarehouse(order: { zohoDetailsJson?: any | null }): string | null {
  const d = (order.zohoDetailsJson || {}) as Record<string, any>;
  if (!d || typeof d !== 'object') return null;

  if (d.location_name && typeof d.location_name === 'string' && d.location_name.trim()) {
    return d.location_name.trim();
  }
  if (d.warehouse_name && typeof d.warehouse_name === 'string' && d.warehouse_name.trim()) {
    return d.warehouse_name.trim();
  }
  if (d.branch_name && typeof d.branch_name === 'string' && d.branch_name.trim()) {
    return d.branch_name.trim();
  }
  if (Array.isArray(d.locations) && d.locations[0]?.location_name) {
    return String(d.locations[0].location_name).trim();
  }
  if (Array.isArray(d.line_items) && d.line_items.length > 0) {
    const item = d.line_items.find((l: any) => l.warehouse_name || l.location_name);
    const name = item?.warehouse_name || item?.location_name;
    if (name && typeof name === 'string' && name.trim()) {
      return name.trim();
    }
  }

  return null;
}

/**
 * Formats elapsed seconds into operational notation matching Pre-Dispatch:
 * Examples: 32s | 15m 32s | 3h 15m | 1d 23h | 6d 13h
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

/**
 * Authoritative service to query and filter active Pre-Dispatch orders.
 * Matches Pre-Dispatch -> Active tab:
 * status === 'NEW' && getOrderStage(order) !== 'archived'
 */
export async function getPreDispatchActiveOrders(): Promise<ActivePreDispatchOrderItem[]> {
  const rawOrders = await prisma.dispatchIncomingOrder.findMany({
    where: {
      status: 'NEW',
    },
    include: {
      preDispatchWorkflow: true,
      truckUpload: true,
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
  });

  // Authoritative filter: Active = status === 'NEW' && stage !== 'archived'
  const activeOrders = rawOrders.filter((o) => getOrderStage(o as any) !== 'archived');

  // Format into compact dashboard representation
  return activeOrders.map((order) => {
    const baseDate = order.activatedAt ?? order.receivedAt;
    const warehouse = getOrderWarehouse(order as any) || 'Default Warehouse';
    const stage = getOrderStage(order as any);
    const stageBadge = getStageBadge(order as any);

    return {
      id: order.id,
      salesorderNumber: order.salesorderNumber,
      customerName: order.customerName || 'Unknown Customer',
      warehouse,
      stage,
      stageBadge,
      baseTimestamp: baseDate.toISOString(),
      formattedTimestamp: format(new Date(baseDate), 'dd MMM · hh:mm a'),
      total: order.total,
    };
  });
}
