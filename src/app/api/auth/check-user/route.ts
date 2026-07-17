import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { mobile } = await request.json();

    if (!mobile || typeof mobile !== 'string' || mobile.length !== 10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { mobile },
      select: { active: true },
    });

    if (!user || user.active !== true) {
      return NextResponse.json({ error: 'No active account found with this phone number.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CheckUser] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
