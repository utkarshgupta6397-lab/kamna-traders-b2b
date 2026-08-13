import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await prisma.zohoCreatorConfig.findUnique({
      where: { id: 'singleton' },
    });

    const envUrl = process.env.ERP_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

    return NextResponse.json({
      config,
      baseUrl: envUrl,
    });
  } catch (error: any) {
    console.error('[ZOHO-CREATOR-API] Error fetching config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body.action === 'regenerate') {
      const newToken = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      const config = await prisma.zohoCreatorConfig.upsert({
        where: { id: 'singleton' },
        update: {
          bearerToken: newToken,
          lastTokenGeneratedAt: now,
        },
        create: {
          id: 'singleton',
          bearerToken: newToken,
          lastTokenGeneratedAt: now,
        },
      });

      return NextResponse.json({ config });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[ZOHO-CREATOR-API] Error regenerating token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
