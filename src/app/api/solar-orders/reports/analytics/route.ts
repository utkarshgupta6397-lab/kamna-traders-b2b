import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getApprovedOrderCondition } from '@/lib/solar-workflow-config';
import type { NormalizedOrder } from '@/lib/report-analytics';

/**
 * GET /api/solar-orders/reports/salesman
 *
 * Returns raw normalized orders for the Salesman analytics module.
 * All filtering and aggregation happens client-side.
 *
 * DESIGN:
 * - Single DB query with eager loads (salesman, callingExecutive, subVendor, payments)
 * - Normalized payment fields computed server-side (effectivePendingAmount, paidAmount, paymentPercentage)
 * - No server-side aggregation — reduces payload and keeps logic in one place (lib/report-analytics.ts)
 * - Only approved orders are returned (APPROVED, EXECUTION, INSTALLATION_IN_PROGRESS, COMPLETED)
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.solar_orders_view && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const rawOrders = await prisma.solarOrder.findMany({
      where: {
        isCancelled: false,
        ...getApprovedOrderCondition(),
      },
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        status: true,
        customerName: true,
        leadSource: true,
        salesmanId: true,
        callingExecutiveId: true,
        subVendorId: true,
        totalOrderAmount: true,
        pendingAmount: true,
        systemSize: true,
        systemType: true,
        zohoBooksCustomerId: true,
        loanCustomer: true,
        approvedAt: true,
        completedAt: true,
        cancelledAt: true,
        salesman: {
          select: { name: true },
        },
        callingExecutive: {
          select: { name: true },
        },
        subVendor: {
          select: { name: true },
        },
        payments: {
          select: {
            amount: true,
            paymentDate: true,
            paymentMode: true,
          },
          orderBy: { paymentDate: 'asc' },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    // Normalize each order — compute derived payment fields once server-side
    const orders: NormalizedOrder[] = rawOrders.map(o => {
      const zohoLinked = !!o.zohoBooksCustomerId;
      // Business rule: unlinked orders have full amount outstanding regardless of pendingAmount field
      const effectivePendingAmount = zohoLinked ? o.pendingAmount : o.totalOrderAmount;
      const paidAmount = o.totalOrderAmount - effectivePendingAmount;
      const paymentPercentage = o.totalOrderAmount > 0
        ? Math.max(0, Math.min(100, (paidAmount / o.totalOrderAmount) * 100))
        : 0;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate.toISOString(),
        status: o.status,
        customerName: o.customerName,
        leadSource: o.leadSource,
        salesmanId: o.salesmanId,
        salesmanName: o.salesman?.name ?? null,
        callingExecutiveId: o.callingExecutiveId,
        callingExecutiveName: o.callingExecutive?.name ?? null,
        subVendorId: o.subVendorId,
        subVendorName: o.subVendor?.name ?? null,
        totalOrderAmount: o.totalOrderAmount,
        systemSize: o.systemSize,
        systemType: o.systemType,
        zohoLinked,
        loanCustomer: o.loanCustomer,
        approvedAt: o.approvedAt?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        cancelledAt: o.cancelledAt?.toISOString() ?? null,
        effectivePendingAmount,
        paidAmount,
        paymentPercentage,
        payments: o.payments.map(p => ({
          amount: p.amount,
          paymentDate: p.paymentDate.toISOString(),
          paymentMode: p.paymentMode,
        })),
      };
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[SalesmanReport API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
