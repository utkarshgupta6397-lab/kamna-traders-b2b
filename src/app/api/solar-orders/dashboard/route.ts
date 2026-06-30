import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const [totalOrders, pendingApproval, activeInstallations, completedOrders] = await Promise.all([
      prisma.solarOrder.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.solarOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.solarOrder.count({ where: { status: 'EXECUTION' } }),
      prisma.solarOrder.count({ where: { status: 'COMPLETED' } }),
    ]);

    const recentActivity = await prisma.solarActivityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { 
        solarOrder: { select: { orderNumber: true, customerName: true } },
        actor: { select: { name: true } }
      }
    });

    return NextResponse.json({
      kpis: {
        totalOrders,
        pendingApproval,
        activeInstallations,
        completedOrders,
      },
      recentActivity,
    });
  } catch (error) {
    console.error('[SolarOrders Dashboard API Error]', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
