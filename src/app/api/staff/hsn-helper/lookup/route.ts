import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession();
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  console.log('[DEBUG] Lookup API hit:', { code, session: session ? 'exists' : 'null' });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!code || code.length < 2) {
    return NextResponse.json({ hierarchy: [] });
  }

  try {
    const prefixes = [];
    const len = code.length;
    if (len >= 2) prefixes.push(code.substring(0, 2));
    if (len >= 4) prefixes.push(code.substring(0, 4));
    if (len >= 6) prefixes.push(code.substring(0, 6));
    if (len >= 8) prefixes.push(code.substring(0, 8));

    const records = await prisma.governmentHsnHelper.findMany({
      where: {
        code: { in: prefixes },
      },
      select: {
        code: true,
        description: true,
        level: true,
      },
      orderBy: {
        code: 'asc'
      }
    });

    const hierarchy = prefixes.map(prefix => {
      const found = records.find((r: any) => r.code === prefix);
      return {
        level: found?.level || (prefix.length === 2 ? 'Chapter' : prefix.length === 4 ? 'Heading' : prefix.length === 6 ? 'Sub-heading' : 'Tariff Item'),
        code: prefix,
        name: found ? found.description : 'Not Available',
      };
    });

    return NextResponse.json({ hierarchy });
  } catch (error: any) {
    console.error('[API] GET /api/staff/catalog/hsn-codes/lookup error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
