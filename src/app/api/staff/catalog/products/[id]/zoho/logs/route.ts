import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const variantId = searchParams.get('variantId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;

  try {
    let targetVariantId = variantId;
    if (!targetVariantId) {
      const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
      if (!defaultVariant) {
        return NextResponse.json({ error: 'No default variant found for product' }, { status: 404 });
      }
      targetVariantId = defaultVariant.id;
    }

    const [logs, total] = await Promise.all([
      prisma.zohoProductSyncLog.findMany({
        where: { variantId: targetVariantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.zohoProductSyncLog.count({
        where: { variantId: targetVariantId }
      })
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/${id}/zoho/logs error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
