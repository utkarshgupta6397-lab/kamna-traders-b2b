import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCustomerById } from '@/lib/zoho/customer-statement';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_management required' }, { status: 403 });
    }

    const { customerId, invoiceId } = await request.json();

    if (!customerId || !invoiceId) {
      return NextResponse.json({ error: 'customerId and invoiceId are required' }, { status: 400 });
    }

    const cleanId = customerId.trim();

    // 1. Read local customer
    const localCustomer = await prisma.customer.findUnique({
      where: { id: cleanId }
    });

    if (!localCustomer) {
      return NextResponse.json({ error: 'Customer not found locally' }, { status: 404 });
    }

    const oldGst = localCustomer.gstNumber;

    if (oldGst && oldGst !== 'NOT_AVAILABLE' && oldGst.trim() !== '') {
      return NextResponse.json({ success: true, gst: oldGst });
    }

    // 2. Fetch from Zoho
    const result = await getCustomerById(cleanId);
    if (!result.success) {
      console.error('[Fetch GST] Zoho API Error:', result.error, result.raw);
      return NextResponse.json({ error: 'Unable to fetch GST from Zoho.' }, { status: 400 });
    }

    const newGst = result.data?.gstNo?.trim() || '';
    const name = result.data?.contactName || localCustomer.name || 'Unknown Customer';

    // 3. Update DB and Log
    if (newGst !== '') {
      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: cleanId },
          data: { name, gstNumber: newGst }
        });

        await tx.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: invoiceId,
            action: 'GST_FETCHED_FROM_ZOHO',
            userId: session.userId,
            metadata: {
              customerId: cleanId,
              customerName: name,
              oldGst: oldGst || null,
              newGst
            }
          }
        });
      });
      return NextResponse.json({ success: true, gst: newGst });
    } else {
      // Still update name but no GST found
      await prisma.customer.update({
        where: { id: cleanId },
        data: { name, gstNumber: null }
      });
      return NextResponse.json({ success: true, gst: 'NOT_AVAILABLE_IN_ZOHO' });
    }
  } catch (error: any) {
    console.error('[Fetch GST POST] Error:', error);
    return NextResponse.json({ error: 'Unable to fetch GST from Zoho.' }, { status: 500 });
  }
}
