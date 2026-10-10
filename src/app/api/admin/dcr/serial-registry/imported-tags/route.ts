import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const parsedPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    const parsedLimit = parseInt(searchParams.get('limit') || '25', 10);
    const rawLimit = isNaN(parsedLimit) || parsedLimit < 1 ? 25 : parsedLimit;
    const limit = Math.min(rawLimit, 1000);

    const whereClause: any = {};
    if (q.trim()) {
      whereClause.OR = [
        { serialNumber: { contains: q.trim(), mode: 'insensitive' } },
        { tag: { contains: q.trim(), mode: 'insensitive' } },
        { errorRemarks: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.dcrImportedSerialTag.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dcrImportedSerialTag.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[DCR Imported Tags GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch imported tag records' }, { status: 500 });
  }
}
