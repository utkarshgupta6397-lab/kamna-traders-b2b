import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const uploads = await prisma.dispatchTruckUpload.findMany({
      include: {
        dispatchOrder: {
          select: {
            salesorderNumber: true,
            customerName: true,
            customerGst: true,
            total: true,
            currencyCode: true,
            status: true,
            receivedAt: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    const data = uploads.map(u => ({
      id: u.id,
      salesOrderId: u.salesOrderId,
      salesOrderNumber: u.salesOrderNumber || u.dispatchOrder?.salesorderNumber || 'SO-N/A',
      customerName: u.dispatchOrder?.customerName || 'Unknown Customer',
      customerGst: u.dispatchOrder?.customerGst || 'N/A',
      total: u.dispatchOrder?.total || 0,
      currencyCode: u.dispatchOrder?.currencyCode || 'INR',
      imageUrl: `/api/dispatch/truck-image/${u.id}`,
      imageFilename: u.imageFilename,
      imageSizeBytes: u.imageSizeBytes,
      imageMimeType: u.imageMimeType,
      uploadedAt: u.uploadedAt,
      uploadedByUserName: u.uploadedByUserName || 'Staff',
      orderStatus: u.dispatchOrder?.status || 'NEW',
    }));

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error: any) {
    console.error('[Truck Details API Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
