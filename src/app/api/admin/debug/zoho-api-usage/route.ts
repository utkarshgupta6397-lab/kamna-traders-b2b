import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getZohoApiUsage } from '@/lib/zoho-api-meter';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usage = getZohoApiUsage();

    return NextResponse.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    console.error('[Zoho API Meter] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
