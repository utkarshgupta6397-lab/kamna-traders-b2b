import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchInvoiceById } from '@/lib/zoho/invoices';

function isOperationallyOpen(row: { paymentStatus: string; amountPending: number; invoiceValue: number }): boolean {
  if (row.paymentStatus === 'paid' || row.paymentStatus === 'void') return false;
  if (row.amountPending <= 0) return false;
  
  const absPending = Math.abs(row.amountPending);
  
  // Rule 1: <= ₹10 variance is always ignored
  if (absPending <= 10) return false;
  
  // Rule 2: Large invoices can have <= ₹100 variance
  if (row.invoiceValue > 100000 && absPending <= 100) return false;

  return true;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view && !session.accounts_recovery_manage)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceIds } = await request.json();
    if (!invoiceIds || !Array.isArray(invoiceIds)) {
      return NextResponse.json({ success: false, error: 'invoiceIds must be an array' }, { status: 400 });
    }

    if (invoiceIds.length > 20) {
      return NextResponse.json({ success: false, error: 'Cannot refresh more than 20 invoices at a time' }, { status: 400 });
    }

    const updatedTasks: any[] = [];

    // Fetch from Zoho and run auto-resolve logic for each invoiceId
    const refreshPromises = invoiceIds.map(async (invoiceId) => {
      try {
        const { invoice: zohoInv } = await fetchInvoiceById(invoiceId);
        if (!zohoInv) return;

        const balance = Number(zohoInv.balance !== undefined ? zohoInv.balance : (zohoInv.balance_amount || 0));
        const total = Number(zohoInv.total || 0);
        const status = zohoInv.status || 'unpaid';

        const isOpen = isOperationallyOpen({
          paymentStatus: status,
          amountPending: balance,
          invoiceValue: total
        });

        // Find the active task for this invoice
        const activeTask = await prisma.recoveryInvoiceTask.findFirst({
          where: { invoiceId, status: 'ACTIVE' }
        });

        if (!activeTask) return;

        if (!isOpen) {
          // Auto-resolve task
          const updated = await prisma.recoveryInvoiceTask.update({
            where: { id: activeTask.id },
            data: {
              status: 'RESOLVED',
              resolvedByUserId: 'SYSTEM',
              resolvedByName: 'System Auto-Resolve',
              resolvedAt: new Date(),
              resolvedReason: 'AUTO_RESOLVED',
              lastKnownPendingAmount: balance,
              lastKnownInvoiceStatus: status,
              lastSyncedAt: new Date()
            }
          });
          updatedTasks.push(updated);
        } else {
          // Update last known details
          const updated = await prisma.recoveryInvoiceTask.update({
            where: { id: activeTask.id },
            data: {
              lastKnownPendingAmount: balance,
              lastKnownInvoiceStatus: status,
              lastSyncedAt: new Date()
            }
          });
          updatedTasks.push(updated);
        }
      } catch (err: any) {
        console.error(`Error refreshing invoice ${invoiceId}:`, err.message);
        // Continue to other invoices
      }
    });

    await Promise.all(refreshPromises);

    // Fetch the final set of ACTIVE recovery tasks to return to UI
    const activeTasks = await prisma.recoveryInvoiceTask.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { flaggedAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: activeTasks });
  } catch (error: any) {
    console.error('[POST /api/accounts/recovery/refresh]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
