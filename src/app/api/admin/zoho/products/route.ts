import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  
  const skip = (page - 1) * limit;

  try {
    const where: any = {};

    if (status && status !== 'ALL') {
      where.zohoSyncStatus = status;
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { zohoBookItemId: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { code: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [variants, total] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, code: true, type: true } }
        },
        orderBy: [
          { zohoLastSyncAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
      }),
      prisma.productVariant.count({ where })
    ]);

    // Also get summary stats
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN "zohoSyncStatus" = 'SYNCED' THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN "zohoSyncStatus" = 'NEVER_SYNCED' THEN 1 ELSE 0 END) as never_synced,
        SUM(CASE WHEN "zohoSyncStatus" = 'SYNC_FAILED' THEN 1 ELSE 0 END) as failed
      FROM "ProductVariant"
    `;

    return NextResponse.json({
      variants,
      stats: stats[0],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[API] GET /api/admin/zoho/products error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
