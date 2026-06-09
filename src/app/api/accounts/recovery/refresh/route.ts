import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchInvoiceById } from '@/lib/zoho/invoices';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

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

    const { invoiceIds, dryRun } = await request.json();
    if (!invoiceIds || !Array.isArray(invoiceIds)) {
      return NextResponse.json({ success: false, error: 'invoiceIds must be an array' }, { status: 400 });
    }

    if (invoiceIds.length > 100) {
      return NextResponse.json({ success: false, error: 'Cannot refresh more than 100 invoices at a time' }, { status: 400 });
    }

    const isDryRun = !!dryRun;
    const proposedRemovals: any[] = [];
    let processedCount = 0;
    let removedCount = 0;
    let releasedCount = 0;

    const batchSize = 10;
    for (let i = 0; i < invoiceIds.length; i += batchSize) {
      const batch = invoiceIds.slice(i, i + batchSize);
      await Promise.all(batch.map(async (invoiceId) => {
        try {
          const activeTask = await prisma.recoveryInvoiceTask.findFirst({
            where: { invoiceId, status: 'ACTIVE' }
          });
          if (!activeTask) return;

          let balance = 0;
          let total = 0;
          let status = 'unpaid';
          let invoiceDateStr = '';
          let found = true;

          try {
            const { invoice: zohoInv } = await fetchInvoiceById(invoiceId);
            if (!zohoInv) {
              found = false;
            } else {
              balance = Number(zohoInv.balance_due !== undefined ? zohoInv.balance_due : (zohoInv.balance !== undefined ? zohoInv.balance : (zohoInv.balance_amount || 0)));
              total = Number(zohoInv.total || 0);
              status = zohoInv.status || 'unpaid';
              invoiceDateStr = zohoInv.date || '';
            }
          } catch (err: any) {
            if (err.message?.toLowerCase().includes('not found') || err.message?.toLowerCase().includes('404')) {
              found = false;
            } else {
              throw err;
            }
          }

          processedCount++;

          if (!found) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: 0,
              removalReason: 'NO_LONGER_ELIGIBLE',
              reasonLabel: 'No Longer Eligible'
            });
            removedCount++;

            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  status: 'RESOLVED',
                  resolvedByUserId: 'SYSTEM',
                  resolvedByName: 'System Auto-Resolve',
                  resolvedAt: new Date(),
                  resolvedReason: 'NO_LONGER_ELIGIBLE',
                  lastSyncedAt: new Date()
                }
              });
            }
            return;
          }

          const ageDays = invoiceDateStr 
            ? Math.max(0, Math.ceil((Date.now() - new Date(invoiceDateStr).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          const isOpen = isOperationallyOpen({
            paymentStatus: status,
            amountPending: balance,
            invoiceValue: total
          });

          if (!isOpen) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: balance,
              removalReason: 'FULLY_PAID',
              reasonLabel: 'Fully Paid'
            });
            removedCount++;

            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
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
            }
          } else if (balance <= 200 && ageDays > 7) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: balance,
              removalReason: 'AUTO_RELEASED',
              reasonLabel: 'Auto Released (< threshold)'
            });
            releasedCount++;

            if (!isDryRun) {
              // Set status to AUTO_RELEASED
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  status: 'AUTO_RELEASED',
                  releasedByUserId: 'SYSTEM',
                  releasedByName: 'System Auto-Release',
                  releasedAt: new Date(),
                  resolvedReason: 'AUTO_RELEASED',
                  lastKnownPendingAmount: balance,
                  lastKnownInvoiceStatus: status,
                  lastSyncedAt: new Date()
                }
              });

              // Create Audit Log
              await prisma.auditLog.create({
                data: {
                  userId: session.userId || 'SYSTEM',
                  action: 'AUTO_RELEASE',
                  details: JSON.stringify({
                    invoice_number: activeTask.invoiceNumber,
                    previous_balance: activeTask.lastKnownPendingAmount || 0,
                    release_reason: 'Outstanding Balance <= ₹200 and Invoice Age > 7 days',
                    timestamp: new Date()
                  })
                }
              });
            }
          } else {
            // Remains active
            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  lastKnownPendingAmount: balance,
                  lastKnownInvoiceStatus: status,
                  lastSyncedAt: new Date()
                }
              });
            }
          }

        } catch (err: any) {
          console.error(`Error refreshing invoiceId ${invoiceId}:`, err.message);
        }
      }));
    }

    // Fetch unique customer credits if dryRun is enabled
    const customerCredits: any[] = [];
    if (isDryRun && invoiceIds.length > 0) {
      const activeTasksForSync = await prisma.recoveryInvoiceTask.findMany({
        where: { invoiceId: { in: invoiceIds }, status: 'ACTIVE' },
        select: { customerId: true, customerName: true }
      });
      
      const uniqueCustMap = new Map<string, string>();
      for (const t of activeTasksForSync) {
        uniqueCustMap.set(t.customerId, t.customerName);
      }
      
      const uniqueCustomerIds = Array.from(uniqueCustMap.keys());
      const orgId = getZohoOrgId();
      const accessToken = await getZohoTokens();
      
      if (orgId && accessToken && uniqueCustomerIds.length > 0) {
        await Promise.all(uniqueCustomerIds.map(async (customerId) => {
          try {
            const url = `${API_BASE_URL}/books/v3/contacts/${customerId}?organization_id=${orgId}`;
            const response = await fetch(url, {
              headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            });
            if (response.ok) {
              const contactData = await response.json();
              const contact = contactData.contact;
              if (contact) {
                const rawCredits = contact.unused_credits_receivable_amount ??
                  contact.unused_credits_amount ??
                  contact.unused_credits ??
                  contact.credits ??
                  contact.excess_payments ??
                  contact.unapplied_amount ??
                  0;
                const unusedCredits = Math.max(0, Number(rawCredits) || 0);
                
                if (unusedCredits >= 200) {
                  let lastActivity = contact.last_modified_time || contact.updated_time || 'N/A';
                  if (lastActivity !== 'N/A') {
                    try {
                      lastActivity = new Date(lastActivity).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                    } catch {
                      // ignore
                    }
                  }
                  
                  customerCredits.push({
                    customerId,
                    customerName: uniqueCustMap.get(customerId) || contact.contact_name || contact.display_name || 'Unknown',
                    availableCredit: unusedCredits,
                    lastActivityDate: lastActivity
                  });
                }
              }
            }
          } catch (err: any) {
            console.error(`Error fetching credits for customer ${customerId}:`, err.message);
          }
        }));
        
        customerCredits.sort((a, b) => b.availableCredit - a.availableCredit);
      }
    }

    // Fetch the final set of ACTIVE recovery tasks to return to UI
    const activeTasks = await prisma.recoveryInvoiceTask.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { flaggedAt: 'desc' }
    });

    const remainingCount = activeTasks.length;

    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      proposedRemovals,
      customerCredits,
      data: activeTasks,
      stats: {
        processed: processedCount,
        removed: removedCount,
        released: releasedCount,
        remaining: remainingCount
      }
    });

  } catch (error: any) {
    console.error('[POST /api/accounts/recovery/refresh]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
