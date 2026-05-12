import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  const where = q
    ? {
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { zohoBooksId2: { contains: q, mode: 'insensitive' } },
          ...(isNaN(Number(q)) ? [] : [{ zohoBookItemId: BigInt(q) }]),
        ],
      }
    : {};

  try {
    const skus = await prisma.sku.findMany({
      where: where as any,
      include: { category: true, brand: true },
      orderBy: { id: 'asc' },
    });

    // Convert BigInt to string for JSON serialization
    const serializedSkus = skus.map(sku => ({
      ...sku,
      zohoBookItemId: sku.zohoBookItemId ? String(sku.zohoBookItemId) : null,
    }));

    return NextResponse.json(serializedSkus);
  } catch (error) {
    console.error('Export fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
