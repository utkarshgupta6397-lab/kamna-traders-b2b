import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cert = await prisma.qzCertificate.findUnique({
      where: { userId: session.userId },
      select: { publicCert: true }
    });
    return NextResponse.json({
      publicCert: cert?.publicCert || '',
    });
  } catch (error) {
    console.error('[API] GET /api/staff/qz-certs/certificate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
