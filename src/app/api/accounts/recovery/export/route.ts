import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';
import {
  isOperationallyOpen,
  getInvoiceOverdueDays,
  getAgingBucket,
  AgingBucketKey,
  RawInvoiceRow,
  computeCustomerNetOutstanding,
} from '@/lib/recovery/recovery-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const hasAccess =
      session &&
      (session.role === 'ADMIN' ||
        session.accounts_summary_view ||
        session.accounts_recovery_manage);

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const salespersonFilter = (searchParams.get('salesperson') || '').trim();
    const agingFilter = (searchParams.get('aging') || '').trim() as AgingBucketKey | '';
    const rawMin = searchParams.get('minAmount');
    const rawMax = searchParams.get('maxAmount');
    const minAmount = rawMin !== null && rawMin.trim() !== '' ? Math.max(0, parseFloat(rawMin)) : null;
    const maxAmount = rawMax !== null && rawMax.trim() !== '' ? Math.max(0, parseFloat(rawMax)) : null;
    const dueFrom = searchParams.get('dueFrom') || null;
    const dueTo = searchParams.get('dueTo') || null;

    // Load data
    const cache = await prisma.invoiceSummaryCache.findUnique({
      where: { id: 'singleton' },
    });

    if (!cache || !cache.rows || !Array.isArray(cache.rows)) {
      return NextResponse.json({ success: false, error: 'No cached invoice data available' }, { status: 400 });
    }

    const rows = (cache.rows as unknown) as RawInvoiceRow[];
    const now = new Date();

    const [recoveryRecords, dbCustomers, activeTasks] = await Promise.all([
      prisma.customerRecoveryRecord.findMany(),
      prisma.customer.findMany({
        select: { id: true, name: true, gstNumber: true, netOutstandingBalance: true },
      }),
      prisma.recoveryInvoiceTask.findMany({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const recoveryRecordMap = new Map(recoveryRecords.map((r) => [r.customerId, r]));
    const dbCustomerMap = new Map(dbCustomers.map((c) => [c.id, c]));
    const activeCustomerIds = new Set(activeTasks.map((t) => t.customerId));

    const openInvoices = rows.filter((r) => isOperationallyOpen(r));

    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        customerGst: string;
        invoices: any[];
        salespersonNames: Set<string>;
      }
    >();

    for (const inv of openInvoices) {
      if (!inv.customerId) continue;

      const custId = inv.customerId;
      const custName = inv.customerName || 'Unknown Customer';
      const custGst = inv.customerGst || dbCustomerMap.get(custId)?.gstNumber || '';

      const { isOverdue, overdueDays } = getInvoiceOverdueDays(inv, now);
      const agingBucket = getAgingBucket(overdueDays);

      let entry = customerMap.get(custId);
      if (!entry) {
        entry = {
          customerId: custId,
          customerName: custName,
          customerGst: custGst,
          invoices: [],
          salespersonNames: new Set(),
        };
        customerMap.set(custId, entry);
      }

      entry.invoices.push({
        ...inv,
        isOverdue,
        overdueDays,
        agingBucket,
      });

      if (inv.salespersonName) {
        entry.salespersonNames.add(inv.salespersonName.trim());
      }
    }

    let customers = Array.from(customerMap.values()).map((c) => {
      const rec = recoveryRecordMap.get(c.customerId);
      const dbCust = dbCustomerMap.get(c.customerId);
      const invoicePendingSum = c.invoices.reduce((sum, i) => sum + i.amountPending, 0);

      const balanceMetrics = computeCustomerNetOutstanding(
        dbCust?.netOutstandingBalance,
        invoicePendingSum
      );

      const totalOutstanding = balanceMetrics.netOutstanding;
      const isAdvance = balanceMetrics.isAdvance;
      const netPayableBalance = balanceMetrics.netPayableBalance;

      const overdueInvoices = c.invoices.filter((i) => i.isOverdue);
      const rawOverdueAmount = overdueInvoices.reduce((sum, i) => sum + i.amountPending, 0);
      const overdueAmount = isAdvance ? 0 : Math.min(totalOutstanding, rawOverdueAmount);

      const oldestOverdueDays = c.invoices.length > 0 ? Math.max(...c.invoices.map((i) => i.overdueDays)) : 0;
      const oldestDueDate =
        c.invoices
          .filter((i) => i.dueDate)
          .map((i) => i.dueDate!)
          .sort()[0] || null;

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        customerGst: c.customerGst,
        totalOutstanding,
        isAdvance,
        netPayableBalance,
        overdueAmount,
        invoiceCount: c.invoices.length,
        oldestOverdueDays,
        oldestDueDate,
        overallAgingBucket: getAgingBucket(oldestOverdueDays),
        salesperson: Array.from(c.salespersonNames)[0] || '',
        allSalespersons: Array.from(c.salespersonNames),
        recoveryStatus: rec?.status || 'PENDING_FOLLOW_UP',
        nextFollowUpDate: rec?.nextFollowUpDate ? rec.nextFollowUpDate.toISOString().split('T')[0] : '',
        internalNotes: rec?.internalNotes || '',
        invoices: c.invoices,
      };
    });

    // Only include customers with active recovery tasks in the Recovery Queue export
    customers = customers.filter((c) => activeCustomerIds.has(c.customerId));

    // Apply active filters
    if (q) {
      customers = customers.filter((c) => {
        const nameMatch = c.customerName.toLowerCase().includes(q);
        const idMatch = c.customerId.toLowerCase().includes(q);
        const gstMatch = c.customerGst.toLowerCase().includes(q);
        const invMatch = c.invoices.some((i: any) => i.invoiceNumber.toLowerCase().includes(q));
        return nameMatch || idMatch || gstMatch || invMatch;
      });
    }

    if (salespersonFilter) {
      customers = customers.filter(
        (c) => c.allSalespersons.includes(salespersonFilter) || c.salesperson === salespersonFilter
      );
    }

    if (agingFilter) {
      customers = customers.filter((c) => c.overallAgingBucket === agingFilter);
    }

    if (minAmount !== null && !isNaN(minAmount)) {
      customers = customers.filter((c) => c.totalOutstanding >= minAmount);
    }

    if (maxAmount !== null && !isNaN(maxAmount)) {
      customers = customers.filter((c) => c.totalOutstanding <= maxAmount);
    }

    if (dueFrom) {
      customers = customers.filter((c) => c.oldestDueDate && c.oldestDueDate >= dueFrom);
    }

    if (dueTo) {
      customers = customers.filter((c) => c.oldestDueDate && c.oldestDueDate <= dueTo);
    }

    // Sort by outstanding high-to-low
    customers.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    // Build Excel rows
    const exportRows = customers.map((c, idx) => ({
      '#': idx + 1,
      'Customer Name': c.customerName,
      'GSTIN': c.customerGst || '-',
      'Total Outstanding (₹)': c.totalOutstanding,
      'Advance Balance (₹)': c.isAdvance ? c.netPayableBalance : 0,
      'Overdue Amount (₹)': c.overdueAmount,
      'Open Invoices': c.invoiceCount,
      'Oldest Overdue (Days)': c.oldestOverdueDays,
      'Oldest Due Date': c.oldestDueDate || '',
      'Aging Bucket': c.overallAgingBucket,
      'Salesperson': c.salesperson,
      'Internal Notes': c.internalNotes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recovery Queue');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `Kamna_Recovery_Queue_${todayStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Recovery Export Error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Export error' }, { status: 500 });
  }
}
