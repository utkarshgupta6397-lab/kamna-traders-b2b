import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cert = await prisma.qzCertificate.findUnique({
      where: { userId: session.userId },
    });
    return NextResponse.json({
      publicCert: cert?.publicCert || '',
      privateKey: cert?.privateKey || '',
      updatedAt: cert?.updatedAt || null,
    });
  } catch (error) {
    console.error('[API] GET /api/staff/qz-certs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { publicCert, privateKey } = await request.json();
    if (typeof publicCert !== 'string' || typeof privateKey !== 'string') {
      return NextResponse.json({ error: 'Invalid input fields' }, { status: 400 });
    }

    const cert = await prisma.qzCertificate.upsert({
      where: { userId: session.userId },
      update: { publicCert, privateKey },
      create: { userId: session.userId, publicCert, privateKey },
    });

    return NextResponse.json({
      success: true,
      publicCert: cert.publicCert,
      updatedAt: cert.updatedAt,
    });
  } catch (error) {
    console.error('[API] POST /api/staff/qz-certs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
