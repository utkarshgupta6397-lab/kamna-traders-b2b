import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';

export async function POST(req: Request) {
  try {
    console.log('[DCR Backfill Customers] Starting backfill...');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const customerMap = new Map<string, { id: string, name: string }>();

    // 1. Gather from DcrInvoice
    const dcrInvoices = await prisma.dcrInvoice.findMany({
      select: { customerId: true, customerName: true }
    });
    for (const inv of dcrInvoices) {
      if (inv.customerId && !customerMap.has(inv.customerId)) {
        customerMap.set(inv.customerId, { id: inv.customerId, name: inv.customerName });
      }
    }

    // 2. Gather from RecoveryInvoiceTask
    const recoveryTasks = await prisma.recoveryInvoiceTask.findMany({
      select: { customerId: true, customerName: true }
    });
    for (const task of recoveryTasks) {
      if (task.customerId && !customerMap.has(task.customerId)) {
        customerMap.set(task.customerId, { id: task.customerId, name: task.customerName });
      }
    }

    // 3. Gather from CustomerStatementTask
    const statementTasks = await prisma.customerStatementTask.findMany({
      select: { customerId: true, customerName: true }
    });
    for (const task of statementTasks) {
      if (task.customerId && !customerMap.has(task.customerId)) {
        customerMap.set(task.customerId, { id: task.customerId, name: task.customerName });
      }
    }

    console.log(`[DCR Backfill Customers] Found ${customerMap.size} unique customers across historical tables.`);

    // 4. Process all gathered customers
    for (const [id, customer] of customerMap) {
      const exists = await prisma.customer.findUnique({ where: { id: customer.id } });
      
      await ensureCustomerExists({
        customerId: customer.id,
        customerName: customer.name
      });

      if (!exists) {
        created++;
      } else {
        updated++; // Upsert updates if necessary, though name might be the same
      }
    }

    console.log(`[DCR Backfill Customers] Complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped
    });

  } catch (error: any) {
    console.error('[DCR Backfill Customers] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to backfill customers' }, { status: 500 });
  }
}
