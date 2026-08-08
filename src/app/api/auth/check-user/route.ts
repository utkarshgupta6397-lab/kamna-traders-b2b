import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mobile } = body;

    if (!mobile || typeof mobile !== 'string' || mobile.length !== 10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    let user: { active: boolean } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { mobile },
        select: { active: true },
      });
    } catch (dbErr: any) {
      console.warn('[CheckUser] DB query fallback:', dbErr?.message || dbErr);
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT "active" FROM "User" WHERE "mobile" = $1 LIMIT 1`,
        mobile
      );
      if (rows && rows.length > 0) {
        user = { active: Boolean(rows[0].active) };
      }
    }

    if (!user || user.active !== true) {
      return NextResponse.json({ error: 'No active account found with this phone number.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CheckUser] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
