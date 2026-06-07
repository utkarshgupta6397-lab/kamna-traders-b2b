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

    const [
      total,
      vendorDcrPending,
      available,
      allocated,
      hold,
      readyToIssue,
      issued
    ] = await Promise.all([
      prisma.dcrSerial.count(),
      prisma.dcrSerial.count({ where: { vendorDcrStatus: 'PENDING' } }),
      prisma.dcrSerial.count({ where: { status: 'AVAILABLE' } }),
      prisma.dcrSerial.count({ where: { status: 'ALLOCATED' } }),
      prisma.dcrSerial.count({ where: { status: 'HOLD' } }),
      prisma.dcrSerial.count({ where: { status: 'READY_TO_ISSUE' } }),
      prisma.dcrSerial.count({ where: { status: 'ISSUED' } }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        vendorDcrPending,
        available,
        allocated,
        hold,
        readyToIssue,
        issued
      }
    });
  } catch (error: any) {
    console.error('[DCR Serial Registry Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serial stats' }, { status: 500 });
  }
}
