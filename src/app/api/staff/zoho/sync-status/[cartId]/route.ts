import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cartId } = await params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        zohoSyncStatus: true,
        zohoSyncStep: true,
        zohoSyncError: true,
        zohoSalesorderId: true,
        zohoSalesorderNumber: true,
        zohoLastSyncAt: true,
        zohoResponseTimeMs: true,
        zohoPayload: true,
        zohoResponse: true
      }
    });

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const orgId = process.env.ZOHO_BOOKS_ORG_ID;
    const booksUrl = (cart.zohoSyncStatus === 'SUCCESS' && cart.zohoSalesorderId && orgId)
      ? `https://books.zoho.in/app/${orgId}#/salesorders/${cart.zohoSalesorderId}`
      : null;

    return NextResponse.json({
      ...cart,
      booksUrl
    });

  } catch (error: any) {
    console.error('[ZohoStatus] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
