import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');
    const channel = searchParams.get('channel');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const createdById = searchParams.get('createdById');
    const search = searchParams.get('search');

    // Default to last 7 days if not provided
    const fromDate = fromDateStr ? new Date(fromDateStr) : subDays(new Date(), 7);
    const toDate = toDateStr ? new Date(toDateStr) : new Date();

    const where: Prisma.CommunicationWhereInput = {
      createdAt: {
        gte: startOfDay(fromDate),
        lte: endOfDay(toDate),
      },
    };

    if (channel) where.channel = channel as any;
    if (status) where.status = status as any;
    if (type) where.type = type as any;
    if (createdById) where.createdById = createdById;

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerId: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { templateName: { contains: search, mode: 'insensitive' } },
        { relatedRecord: { contains: search, mode: 'insensitive' } },
        { providerMessageId: { contains: search, mode: 'insensitive' } },
        { toAddress: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 1. Fetch Paginated Logs
    const [totalCount, logs] = await Promise.all([
      prisma.communication.count({ where }),
      prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { name: true } },
        },
      }),
    ]);

    // 2. Fetch KPIs for Today
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const todayStats = await prisma.communication.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _count: {
        id: true,
      },
    });

    let totalToday = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    todayStats.forEach(stat => {
      totalToday += stat._count.id;
      if (stat.status === 'DELIVERED') delivered += stat._count.id;
      if (stat.status === 'READ') read += stat._count.id;
      if (stat.status === 'FAILED') failed += stat._count.id;
    });

    const totalDeliveredOrRead = delivered + read;
    const deliveryRate = totalToday > 0 ? ((totalDeliveredOrRead / totalToday) * 100).toFixed(1) : '0.0';
    const readRate = totalDeliveredOrRead > 0 ? ((read / totalDeliveredOrRead) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      logs,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      kpis: {
        messagesToday: totalToday,
        delivered,
        read,
        failed,
        deliveryRate: parseFloat(deliveryRate),
        readRate: parseFloat(readRate),
      },
    });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_LOGS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
