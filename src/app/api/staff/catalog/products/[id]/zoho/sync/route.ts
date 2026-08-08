import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ZohoProductService } from '@/lib/services/zoho-books';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    let { variantId } = body;

    if (!variantId) {
      const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
      if (!defaultVariant) {
        return NextResponse.json({ error: 'No default variant found for product' }, { status: 404 });
      }
      variantId = defaultVariant.id;
    }

    const result = await ZohoProductService.syncVariant(variantId, 'MANUAL_SYNC');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/zoho/sync error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
