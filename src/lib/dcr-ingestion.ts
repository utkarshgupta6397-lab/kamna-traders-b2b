import { prisma } from '@/lib/db';
import { fetchInvoiceById } from '@/lib/zoho/invoices';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';
import { isVoidInvoice } from '@/lib/dcr-utils';

export async function ingestZohoInvoice(
  zohoInvoiceId: string,
  userId: string,
  importSource: 'ZOHO_SYNC' | 'MANUAL'
) {
  const { invoice: fullInvoice, apiCallsUsed } = await fetchInvoiceById(zohoInvoiceId);

  if (apiCallsUsed > 0) {
    await prisma.zohoApiLog.create({
      data: {
        endpoint: 'FETCH_INVOICE_DETAILS',
        module: 'DCR',
        userId: userId,
      }
    });
  }

  if (fullInvoice.status === 'void' || isVoidInvoice(fullInvoice)) {
    return { action: 'SKIPPED_VOID', invoice: null };
  }

  const existing = await prisma.dcrInvoice.findUnique({
    where: { zohoInvoiceId: fullInvoice.invoice_id },
  });

  // Ensure customer exists before ANY invoice insert/update
  await ensureCustomerExists({
    customerId: fullInvoice.customer_id,
    customerName: fullInvoice.customer_name,
  });

  if (existing) {
    // Update existing record
    const isLowValue = fullInvoice.total < 5000;
    
    // If it's a manual import over an existing record, we update the audit fields
    const manualAuditFields = importSource === 'MANUAL' ? {
      importSource: 'MANUAL' as const,
      importedBy: userId,
      importedAt: new Date(),
    } : {};

    const updatedInvoice = await prisma.dcrInvoice.update({
      where: { id: existing.id },
      data: {
        invoiceStatus: fullInvoice.status,
        invoiceTotal: fullInvoice.total,
        locationId: fullInvoice.location_id || null,
        locationName: fullInvoice.location_name || null,
        syncedAt: new Date(),
        ...manualAuditFields,
        ...(isLowValue ? {
          dcrStatus: 'NO_DCR_REQUIRED',
          archived: true,
          processedAt: new Date(),
          processingReason: 'AUTO_LOW_VALUE'
        } : {})
      },
    });

    await prisma.dcrAuditLog.create({
      data: {
        entityType: 'INVOICE',
        entityId: existing.id,
        action: importSource === 'MANUAL' ? 'MANUAL_UPDATE' : 'SYNC_UPDATE_FROM_ZOHO',
        userId: userId,
      },
    });

    return { action: 'UPDATED', invoice: updatedInvoice };
  } else {
    // Create new record
    const isLowValue = fullInvoice.total < 5000;
    
    const manualAuditFields = importSource === 'MANUAL' ? {
      importSource: 'MANUAL' as const,
      importedBy: userId,
      importedAt: new Date(),
    } : {
      importSource: 'ZOHO_SYNC' as const,
    };

    const newInvoice = await prisma.dcrInvoice.create({
      data: {
        zohoInvoiceId: fullInvoice.invoice_id,
        invoiceNumber: fullInvoice.invoice_number,
        customerId: fullInvoice.customer_id,
        customerName: fullInvoice.customer_name,
        invoiceDate: new Date(fullInvoice.date),
        invoiceStatus: fullInvoice.status,
        invoiceTotal: fullInvoice.total,
        locationId: fullInvoice.location_id || null,
        locationName: fullInvoice.location_name || null,
        dcrStatus: isLowValue ? 'NO_DCR_REQUIRED' : 'NEW',
        archived: isLowValue,
        processedAt: isLowValue ? new Date() : null,
        processingReason: isLowValue ? 'AUTO_LOW_VALUE' : null,
        ...manualAuditFields,
        items: {
          create: fullInvoice.line_items.map((item: any) => {
            const rate = item.rate ?? item.bcy_rate ?? 0;
            const amount = item.item_total ?? (rate * item.quantity);
            const description = item.description ?? item.item_description ?? item.sales_description ?? null;
            return {
              itemId: item.item_id,
              itemName: item.name,
              sku: item.sku || null,
              quantity: item.quantity,
              rate,
              amount,
              description,
              source: 'ZOHO',
            };
          }),
        },
      },
    });

    await prisma.dcrAuditLog.create({
      data: {
        entityType: 'INVOICE',
        entityId: newInvoice.id,
        action: importSource === 'MANUAL' 
          ? (isLowValue ? 'MANUAL_CREATE_AUTO_SKIPPED' : 'MANUAL_CREATE')
          : (isLowValue ? 'SYNC_CREATE_AUTO_SKIPPED' : 'SYNC_CREATE_FROM_ZOHO'),
        userId: userId,
      },
    });

    return { action: 'CREATED', invoice: newInvoice };
  }
}
