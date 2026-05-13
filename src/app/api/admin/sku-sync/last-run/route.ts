import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await prisma.skuSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    return NextResponse.json({
      success: true,
      lastLog: logs[0] || null,
      history: logs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch status' }, { status: 500 });
  }
}
