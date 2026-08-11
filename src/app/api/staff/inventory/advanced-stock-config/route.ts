import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const config = await prisma.inventoryConfig.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { leadTimeDays: 3, safetyFactor: 1.5 }
    });

    return NextResponse.json({
      leadTimeDays: config.leadTimeDays,
      safetyFactor: config.safetyFactor
    });
  } catch (error) {
    console.error('[ADV_STOCK_CONFIG_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { leadTimeDays, safetyFactor } = body;

    const config = await prisma.inventoryConfig.upsert({
      where: { id: 'singleton' },
      update: {
        ...(typeof leadTimeDays === 'number' && { leadTimeDays }),
        ...(typeof safetyFactor === 'number' && { safetyFactor })
      },
      create: {
        leadTimeDays: typeof leadTimeDays === 'number' ? leadTimeDays : 3,
        safetyFactor: typeof safetyFactor === 'number' ? safetyFactor : 1.5
      }
    });

    return NextResponse.json({
      leadTimeDays: config.leadTimeDays,
      safetyFactor: config.safetyFactor
    });
  } catch (error) {
    console.error('[ADV_STOCK_CONFIG_PUT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
