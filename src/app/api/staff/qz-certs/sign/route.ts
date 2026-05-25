import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { toSign } = await request.json();
    if (typeof toSign !== 'string') {
      return NextResponse.json({ error: 'toSign must be a string' }, { status: 400 });
    }

    const cert = await prisma.qzCertificate.findUnique({
      where: { userId: session.userId },
      select: { privateKey: true },
    });

    if (!cert?.privateKey) {
      return NextResponse.json({ error: 'QZ Certificate not configured on server' }, { status: 500 });
    }

    // Sign the data using SHA-512
    const sign = crypto.createSign('RSA-SHA512');
    sign.update(toSign);
    const signature = sign.sign(cert.privateKey, 'base64');

    return NextResponse.json({ signature });
  } catch (error) {
    console.error('[API] POST /api/staff/qz-certs/sign error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
