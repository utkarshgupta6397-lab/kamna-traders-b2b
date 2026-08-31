import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await prisma.incomingSoRequest.findMany({
      orderBy: { received_at: 'desc' },
      take: 100, // Limit for MVP
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Incoming SO API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
