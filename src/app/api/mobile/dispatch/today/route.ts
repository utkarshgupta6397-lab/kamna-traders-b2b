import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getIstDayBounds(referenceDate = new Date()): { startUtc: Date; endUtc: Date; istDateString: string } {
  // IST is UTC + 5:30 (330 minutes)
  const utcMs = referenceDate.getTime();
  const istMs = utcMs + (5.5 * 3600000);
  const istDate = new Date(istMs);

  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  const d = istDate.getUTCDate();

  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - (5.5 * 3600000));
  const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - (5.5 * 3600000));
  const istDateString = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return { startUtc, endUtc, istDateString };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { startUtc, endUtc, istDateString } = getIstDayBounds();

    const uploads = await prisma.dispatchTruckUpload.findMany({
      where: {
        uploadedAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      include: {
        dispatchOrder: {
          select: {
            salesorderNumber: true,
            customerName: true,
            total: true,
            currencyCode: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
    });

    const data = uploads.map(u => ({
      id: u.id,
      salesOrderId: u.salesOrderId,
      salesOrderNumber: u.salesOrderNumber || u.dispatchOrder?.salesorderNumber || 'SO-N/A',
      customerName: u.dispatchOrder?.customerName || 'Unknown Customer',
      total: u.dispatchOrder?.total || 0,
      currencyCode: u.dispatchOrder?.currencyCode || 'INR',
      imageUrl: `/api/dispatch/truck-image/${u.id}`,
      imageSizeBytes: u.imageSizeBytes,
      imageMimeType: u.imageMimeType,
      uploadedAt: u.uploadedAt,
      uploadedByUserName: u.uploadedByUserName || 'Staff',
    }));

    return NextResponse.json({
      success: true,
      istDate: istDateString,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('[Today Dispatch Uploads API]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
