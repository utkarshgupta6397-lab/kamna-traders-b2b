import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatAddress(addr: any): string {
  if (!addr) return 'N/A';
  if (typeof addr === 'string') return addr.trim() || 'N/A';
  
  const parts = [
    addr.address,
    addr.street2,
    addr.city,
    addr.state,
    addr.zip,
    addr.phone ? `Ph: ${addr.phone}` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

function calculatePendingQuantity(order: any): number {
  const details = order.zohoDetailsJson as any;
  if (details && Array.isArray(details.line_items) && details.line_items.length > 0) {
    let pending = 0;
    for (const item of details.line_items) {
      const qty = Number(item.quantity) || 0;
      const invoiced = Number(item.quantity_invoiced) || 0;
      pending += Math.max(0, qty - invoiced);
    }
    return pending;
  }
  return order.totalItems || 0;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await prisma.dispatchIncomingOrder.findMany({
      where: {
        status: 'NEW',
        total: { gt: 50000 },
        truckUpload: null,
      },
      include: {
        preDispatchWorkflow: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });

    const eligibleOrders = orders
      .filter(o => !o.preDispatchWorkflow?.truckPhotoUrl) // Extra safeguard
      .map(o => {
        const details = (o.zohoDetailsJson || {}) as Record<string, any>;
        const orderDate = details.date || (o.receivedAt ? o.receivedAt.toISOString().split('T')[0] : 'N/A');
        const deliveryAddress = formatAddress(details.delivery_address || details.shipping_address);
        const customerGst = o.customerGst || details.gst_no || 'N/A';
        const salesPerson = details.salesperson_name || 'N/A';
        const itemCount = o.totalItems || (Array.isArray(details.line_items) ? details.line_items.length : 0);
        const pendingQuantity = calculatePendingQuantity(o);

        return {
          id: o.id,
          zohoSalesorderId: o.zohoSalesorderId,
          salesorderNumber: o.salesorderNumber || o.zohoSalesorderId,
          customerName: o.customerName || 'Unknown Customer',
          total: o.total || 0,
          currencyCode: o.currencyCode || 'INR',
          orderDate,
          deliveryAddress,
          customerGst,
          salesPerson,
          itemCount,
          pendingQuantity,
          receivedAt: o.receivedAt,
        };
      });

    return NextResponse.json({ success: true, count: eligibleOrders.length, data: eligibleOrders });
  } catch (error: any) {
    console.error('[Eligible Dispatch Orders API]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
