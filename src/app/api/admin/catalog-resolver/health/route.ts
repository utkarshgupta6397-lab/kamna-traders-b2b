import { NextResponse } from 'next/server';
import { CatalogResolver } from '@/lib/services/CatalogResolver';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const health = await CatalogResolver.getCatalogHealth();
    return NextResponse.json(health);
  } catch (error: any) {
    console.error('Catalog Health API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch catalog health' }, { status: 500 });
  }
}
