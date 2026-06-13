import { prisma } from '@/lib/db';

export async function ensureCustomerExists(invoice: { customerId: string, customerName: string, gstNumber?: string | null, status?: string }) {
  if (!invoice.customerId || !invoice.customerName) return;
  
  // Quick local check first to avoid UPSERT overhead where possible
  const exists = await prisma.customer.findUnique({
    where: { id: invoice.customerId },
    select: { id: true, status: true }
  });

  if (!exists) {
    console.warn(`[DCR Customer Sync] Customer ${invoice.customerId} not found locally. Creating customer record from Zoho payload.`);
  }

  await prisma.customer.upsert({
    where: {
      id: invoice.customerId
    },
    update: {
      name: invoice.customerName,
      // Only update GST if it's explicitly provided and valid
      ...(invoice.gstNumber ? { gstNumber: invoice.gstNumber } : {}),
      ...(invoice.status ? { status: invoice.status } : {})
    },
    create: {
      id: invoice.customerId,
      name: invoice.customerName,
      gstNumber: invoice.gstNumber ?? 'NOT_AVAILABLE',
      status: invoice.status ?? 'active'
    }
  });
}
