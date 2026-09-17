import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canCreate =
      hasMobilePermission(session, 'manage_payments_create') ||
      session.role === 'ADMIN';

    if (!canCreate) {
      return NextResponse.json(
        { error: 'You do not have permission to record payments.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q) {
      return NextResponse.json({ success: true, customers: [] });
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { id: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        gstNumber: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('[Manage Payments Customer Search API Error]', error);
    return NextResponse.json(
      { error: 'Failed to search customers' },
      { status: 500 }
    );
  }
}
