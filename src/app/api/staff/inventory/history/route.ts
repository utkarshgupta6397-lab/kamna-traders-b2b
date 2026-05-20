import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const warehouseId = searchParams.get('warehouseId') || '';
  const remark = searchParams.get('remark') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);

  const where: any = {
    AND: []
  };

  if (q) {
    where.AND.push({
      OR: [
        { skuId: { contains: q, mode: 'insensitive' } },
        { productName: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
        { referenceId: { contains: q, mode: 'insensitive' } }
      ]
    });
  }

  if (warehouseId) {
    where.AND.push({ warehouseId });
  }

  if (remark) {
    where.AND.push({ remarks: { contains: remark, mode: 'insensitive' } });
  }

  if (from || to) {
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    where.AND.push({ createdAt: dateFilter });
  }

  const [total, logs] = await Promise.all([
    prisma.inventoryHistory.count({ where }),
    prisma.inventoryHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        warehouse: { select: { name: true } },
        user: { select: { name: true } }
      }
    })
  ]);

  return NextResponse.json({ total, logs });
}
