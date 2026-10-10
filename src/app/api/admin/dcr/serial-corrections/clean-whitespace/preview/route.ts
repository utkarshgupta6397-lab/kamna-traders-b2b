import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { analyzeSerialCandidates, hasWhitespace } from '@/lib/dcr/serial-cleaner';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_serial_mapping_override && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_serial_mapping_override or ADMIN required' }, { status: 403 });
    }

    // Scan all active DCR serials across the entire database
    const allSerials = await prisma.dcrSerial.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        skuId: true,
        vendorDcrStatus: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeList = allSerials.map(s => ({ id: s.id, serialNumber: s.serialNumber }));
    const { rows, summary } = analyzeSerialCandidates(allSerials, activeList);

    // Filter to rows that either contain whitespace or were skipped because of issues
    // We only display rows that have whitespace in the preview table so the user sees relevant rows
    const displayRows = rows.filter(r => r.hasWhitespace);

    return NextResponse.json({
      success: true,
      hasWork: summary.recordsEligible > 0,
      summary,
      rows: displayRows,
    });
  } catch (error: any) {
    console.error('[Clean Whitespace Preview GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to preview serial cleaning' }, { status: 500 });
  }
}
