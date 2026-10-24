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

export interface ZohoListingInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  status: string;
  total: number;
  balance?: number;
  due_date?: string;
  location_id?: string;
  location_name?: string;
  branch_name?: string;
  reference_number?: string;
  [key: string]: any;
}

export interface IngestListingResult {
  total: number;
  created: number;
  updated: number;
  skippedVoid: number;
  failed: number;
  errors?: string[];
}

/**
 * Batch-ingests invoices directly from Zoho Books Invoice Listing API payloads.
 * Populates and refreshes the Process Invoices queue without fetching individual invoice details.
 * Full invoice details and line items are fetched on demand when an operator reviews an invoice.
 */
export async function ingestZohoInvoicesFromListing(
  listingInvoices: ZohoListingInvoice[],
  userId: string = 'SYSTEM_SYNC',
  importSource: 'ZOHO_SYNC' | 'MANUAL' = 'ZOHO_SYNC',
  batchSize: number = 100
): Promise<IngestListingResult> {
  const result: IngestListingResult = {
    total: listingInvoices.length,
    created: 0,
    updated: 0,
    skippedVoid: 0,
    failed: 0,
    errors: [],
  };

  if (!listingInvoices || listingInvoices.length === 0) {
    return result;
  }

  // 1. Filter out void/voided invoices
  const validInvoices: ZohoListingInvoice[] = [];
  for (const inv of listingInvoices) {
    if (isVoidInvoice(inv)) {
      result.skippedVoid++;
    } else {
      validInvoices.push(inv);
    }
  }

  if (validInvoices.length === 0) {
    return result;
  }

  // 2. Bulk resolve customers
  const customerMap = new Map<string, { id: string; name: string }>();
  for (const inv of validInvoices) {
    if (inv.customer_id && inv.customer_name) {
      customerMap.set(inv.customer_id, { id: inv.customer_id, name: inv.customer_name });
    }
  }

  if (customerMap.size > 0) {
    try {
      const existingCustomers = await prisma.customer.findMany({
        where: { id: { in: Array.from(customerMap.keys()) } },
        select: { id: true },
      });
      const existingIdSet = new Set(existingCustomers.map(c => c.id));
      const missingCustomers = Array.from(customerMap.values())
        .filter(c => !existingIdSet.has(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          gstNumber: 'NOT_AVAILABLE',
          status: 'active',
        }));

      if (missingCustomers.length > 0) {
        await prisma.customer.createMany({
          data: missingCustomers,
          skipDuplicates: true,
        });
      }
    } catch (err: any) {
      console.warn('[DCR Listing Ingestion] Bulk customer lookup warning:', err.message);
      // Fallback: iterate ensureCustomerExists safely for missing customers
      for (const cust of customerMap.values()) {
        await ensureCustomerExists({
          customerId: cust.id,
          customerName: cust.name,
        }).catch(e => console.error(`Failed to ensure customer ${cust.id}:`, e.message));
      }
    }
  }

  // 3. Process invoices in bounded batches
  for (let i = 0; i < validInvoices.length; i += batchSize) {
    const chunk = validInvoices.slice(i, i + batchSize);
    const chunkZohoIds = chunk.map(inv => inv.invoice_id);

    try {
      // Find existing invoices in this chunk
      const existingInvoices = await prisma.dcrInvoice.findMany({
        where: { zohoInvoiceId: { in: chunkZohoIds } },
        select: {
          id: true,
          zohoInvoiceId: true,
          dcrStatus: true,
          archived: true,
        },
      });

      const existingMap = new Map(existingInvoices.map(inv => [inv.zohoInvoiceId, inv]));

      const transactions: any[] = [];
      const now = new Date();

      let chunkCreated = 0;
      let chunkUpdated = 0;

      for (const inv of chunk) {
        const total = typeof inv.total === 'number' ? inv.total : parseFloat(inv.total || '0') || 0;
        const isLowValue = total < 5000;
        const locationName = inv.location_name || inv.branch_name || null;
        const locationId = inv.location_id || null;
        const balance = typeof inv.balance === 'number' ? inv.balance : (inv.balance ? parseFloat(inv.balance) : null);
        const existing = existingMap.get(inv.invoice_id);

        if (existing) {
          // Existing record: Preserve established workflow status!
          // Only auto-skip if it is still NEW and total is under ₹5,000
          const shouldAutoSkip = existing.dcrStatus === 'NEW' && isLowValue;

          const updateData: any = {
            invoiceStatus: inv.status,
            invoiceTotal: total,
            locationId: locationId ?? undefined,
            locationName: locationName ?? undefined,
            syncedAt: now,
          };

          if (balance !== null && !isNaN(balance)) {
            updateData.outstandingAmount = balance;
            updateData.outstandingUpdatedAt = now;
          }

          if (shouldAutoSkip) {
            updateData.dcrStatus = 'NO_DCR_REQUIRED';
            updateData.archived = true;
            updateData.processedAt = now;
            updateData.processingReason = 'AUTO_LOW_VALUE';
          }

          transactions.push(
            prisma.dcrInvoice.update({
              where: { id: existing.id },
              data: updateData,
            })
          );
          chunkUpdated++;
        } else {
          // New record
          const createData: any = {
            zohoInvoiceId: inv.invoice_id,
            invoiceNumber: inv.invoice_number,
            customerId: inv.customer_id,
            customerName: inv.customer_name,
            invoiceDate: new Date(inv.date),
            invoiceStatus: inv.status,
            invoiceTotal: total,
            locationId: locationId,
            locationName: locationName,
            dcrStatus: isLowValue ? 'NO_DCR_REQUIRED' : 'NEW',
            archived: isLowValue,
            processedAt: isLowValue ? now : null,
            processingReason: isLowValue ? 'AUTO_LOW_VALUE' : null,
            importSource: importSource as any,
            syncedAt: now,
          };

          if (balance !== null && !isNaN(balance)) {
            createData.outstandingAmount = balance;
            createData.outstandingUpdatedAt = now;
          }

          transactions.push(
            prisma.dcrInvoice.create({
              data: createData,
            })
          );
          chunkCreated++;
        }
      }

      if (transactions.length > 0) {
        await prisma.$transaction(transactions);
        result.created += chunkCreated;
        result.updated += chunkUpdated;
      }
    } catch (chunkError: any) {
      console.error(`[DCR Listing Ingestion] Error processing chunk ${i / batchSize + 1}:`, chunkError);
      result.failed += chunk.length;
      result.errors?.push(chunkError.message || 'Chunk processing failed');

      // Attempt sequential recovery for this chunk so one corrupt invoice doesn't abort the entire sync
      for (const inv of chunk) {
        try {
          const total = typeof inv.total === 'number' ? inv.total : parseFloat(inv.total || '0') || 0;
          const isLowValue = total < 5000;
          const locationName = inv.location_name || inv.branch_name || null;
          const locationId = inv.location_id || null;
          const balance = typeof inv.balance === 'number' ? inv.balance : (inv.balance ? parseFloat(inv.balance) : null);

          const existing = await prisma.dcrInvoice.findUnique({
            where: { zohoInvoiceId: inv.invoice_id },
            select: { id: true, dcrStatus: true },
          });

          if (existing) {
            const shouldAutoSkip = existing.dcrStatus === 'NEW' && isLowValue;
            await prisma.dcrInvoice.update({
              where: { id: existing.id },
              data: {
                invoiceStatus: inv.status,
                invoiceTotal: total,
                locationId: locationId ?? undefined,
                locationName: locationName ?? undefined,
                syncedAt: new Date(),
                ...(shouldAutoSkip ? {
                  dcrStatus: 'NO_DCR_REQUIRED',
                  archived: true,
                  processedAt: new Date(),
                  processingReason: 'AUTO_LOW_VALUE',
                } : {}),
                ...(balance !== null && !isNaN(balance) ? {
                  outstandingAmount: balance,
                  outstandingUpdatedAt: new Date(),
                } : {}),
              },
            });
            result.updated++;
            result.failed--;
          } else {
            await prisma.dcrInvoice.create({
              data: {
                zohoInvoiceId: inv.invoice_id,
                invoiceNumber: inv.invoice_number,
                customerId: inv.customer_id,
                customerName: inv.customer_name,
                invoiceDate: new Date(inv.date),
                invoiceStatus: inv.status,
                invoiceTotal: total,
                locationId: locationId,
                locationName: locationName,
                dcrStatus: isLowValue ? 'NO_DCR_REQUIRED' : 'NEW',
                archived: isLowValue,
                processedAt: isLowValue ? new Date() : null,
                processingReason: isLowValue ? 'AUTO_LOW_VALUE' : null,
                importSource: importSource as any,
                syncedAt: new Date(),
                ...(balance !== null && !isNaN(balance) ? {
                  outstandingAmount: balance,
                  outstandingUpdatedAt: new Date(),
                } : {}),
              },
            });
            result.created++;
            result.failed--;
          }
        } catch (individualErr: any) {
          console.error(`[DCR Listing Ingestion] Individual retry failed for ${inv.invoice_id}:`, individualErr.message);
        }
      }
    }
  }

  return result;
}

