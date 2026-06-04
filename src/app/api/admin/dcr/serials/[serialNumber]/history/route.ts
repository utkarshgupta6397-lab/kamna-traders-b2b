import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ serialNumber: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serialNumber } = await params;

    const serial = await prisma.dcrSerial.findUnique({
      where: { serialNumber },
      include: {
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!serial) {
      return NextResponse.json({ error: 'Serial number not found' }, { status: 404 });
    }

    return NextResponse.json({ serial });
  } catch (error: any) {
    console.error('[DCR Serial History GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serial history' }, { status: 500 });
  }
}
