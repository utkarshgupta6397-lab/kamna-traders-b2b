import { NextResponse } from 'next/server';
import { getZohoAuthStatus, getZohoOrgId } from '@/lib/zoho-auth';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = await getZohoAuthStatus();
    const orgId = getZohoOrgId();

    return NextResponse.json({
      ...status,
      orgId
    });
  } catch (error: any) {
    console.error('Error fetching Zoho auth status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
