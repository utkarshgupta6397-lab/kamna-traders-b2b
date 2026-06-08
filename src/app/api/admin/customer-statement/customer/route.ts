import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerById } from '@/lib/zoho/customer-statement';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accounts_customer_statement && !session.dcr_management && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId || !/^\d{19}$/.test(customerId.trim())) {
    return NextResponse.json({ error: 'Invalid or missing customerId. Expected 19 digits.' }, { status: 400 });
  }

  const cleanId = customerId.trim();

  // 1. Read from local DB first
  const localCustomer = await prisma.customer.findUnique({
    where: { id: cleanId }
  });

  if (localCustomer && localCustomer.gstNumber && localCustomer.gstNumber !== 'NOT_AVAILABLE') {
    return NextResponse.json({
      success: true,
      data: {
        contactId: cleanId,
        contactName: localCustomer.name,
        gstNo: localCustomer.gstNumber
      }
    });
  }

  // 2. Fetch from Zoho if cache miss or NOT_AVAILABLE
  const result = await getCustomerById(cleanId);
  if (!result.success) {
     return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
  }

  // 3. Save to local DB
  const gstNo = result.data?.gstNo || '';
  const name = result.data?.contactName || 'Unknown Customer';

  const updateData: any = { name };
  if (gstNo.trim() !== '') {
    updateData.gstNumber = gstNo.trim();
  } else {
    // If Zoho returns empty, we clear any 'NOT_AVAILABLE' lock
    updateData.gstNumber = null;
  }

  await prisma.customer.upsert({
    where: { id: cleanId },
    update: updateData,
    create: { 
      id: cleanId, 
      name, 
      gstNumber: gstNo.trim() !== '' ? gstNo.trim() : null 
    }
  });

  return NextResponse.json(result);
}
