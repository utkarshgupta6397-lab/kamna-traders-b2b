import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    let name = session.userId || 'Staff';
    if (session.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true }
      });
      if (user?.name) {
        name = user.name;
      }
    }
    return NextResponse.json({ authenticated: true, session: { ...session, name } });
  } catch (error) {
    console.error('[Session GET API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
