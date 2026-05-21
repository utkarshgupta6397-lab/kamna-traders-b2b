import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/printers
 * Returns the list of enabled printers from the DB.
 * Used by print components to fetch IP/port without hardcoding.
 * Accessible to authenticated staff (not admin-only — staff needs to print).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const printers = await prisma.printer.findMany({
      where: { enabled: true },
      select: { id: true, name: true, ipAddress: true, port: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ printers });
  } catch (err) {
    console.error('[API] GET /api/printers error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
