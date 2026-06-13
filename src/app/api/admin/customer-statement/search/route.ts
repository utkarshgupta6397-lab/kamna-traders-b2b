import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_customer_statement)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    
    if (!q || q.trim().length < 3) {
      return NextResponse.json({ error: 'Query requires at least 3 characters' }, { status: 400 });
    }

    const query = q.trim();
    const isDigitId = /^\d{15,20}$/.test(query);

    const customers = await prisma.customer.findMany({
      where: {
        status: 'active',
        OR: [
          ...(isDigitId ? [{ id: query }] : []),
          { gstNumber: query },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      select: { id: true, name: true, gstNumber: true }
    });

    return NextResponse.json({
      success: true,
      customers
    });

  } catch (error: any) {
    console.error('[Customer Statement Search] Error:', error);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}

