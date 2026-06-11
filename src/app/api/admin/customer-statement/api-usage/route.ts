import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_customer_statement)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';

    const now = new Date();
    let startDate = new Date();
    
    // Set to start of today in local time (assume IST or server local time)
    startDate.setHours(0, 0, 0, 0);

    if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setDate(1);
    }

    // 1. Group by module for breakdown
    const logs = await prisma.zohoApiLog.groupBy({
      by: ['module'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: {
        id: true
      }
    });

    // 2. Count distinct users
    const userGroups = await prisma.zohoApiLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: { gte: startDate },
        userId: { not: null }
      }
    });

    const activeUsers = userGroups.length || 1; // prevent division by zero

    let totalCalls = 0;
    const breakdown: Record<string, number> = {
      'Statement': 0,
      'Recovery Queue': 0,
      'Customer Lookup': 0,
      'Other': 0
    };

    logs.forEach(log => {
      const count = log._count.id;
      totalCalls += count;
      
      if (log.module === 'Statement') breakdown['Statement'] += count;
      else if (log.module === 'Recovery Queue') breakdown['Recovery Queue'] += count;
      else if (log.module === 'Customer Lookup' || log.module === 'DCR') breakdown['Customer Lookup'] += count;
      else breakdown['Other'] += count;
    });

    const avgPerUser = totalCalls > 0 ? Math.round((totalCalls / activeUsers) * 10) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalCalls,
        breakdown,
        activeUsers,
        avgPerUser
      }
    });

  } catch (error: any) {
    console.error('[API Usage Telemetry] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch telemetry' }, { status: 500 });
  }
}
