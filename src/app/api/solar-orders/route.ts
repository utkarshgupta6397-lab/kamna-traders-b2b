import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const systemType = searchParams.get('systemType');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== 'All') {
      where.status = status;
    }

    if (systemType && systemType !== 'All') {
      where.systemType = systemType;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, totalCount] = await Promise.all([
      prisma.solarOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          salesman: { select: { name: true } },
          callingExecutive: { select: { name: true } }
        }
      }),
      prisma.solarOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('[SolarOrders GET Error]', error);
    return NextResponse.json({ error: 'Failed to fetch solar orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_create) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    const newOrder = await prisma.$transaction(async (tx) => {
      // 1. Check if we need a new year format based on current fiscal year
      const now = new Date();
      const currentYear = now.getFullYear();
      const fiscalYearStr = now.getMonth() >= 3 
        ? `${currentYear}-${(currentYear + 1).toString().slice(2)}` 
        : `${currentYear - 1}-${currentYear.toString().slice(2)}`;
      
      const seqRecord = await tx.solarOrderSequence.upsert({
        where: { year: fiscalYearStr },
        update: { sequence: { increment: 1 } },
        create: { year: fiscalYearStr, sequence: 1 },
      });

      const orderNumber = `SOL-${fiscalYearStr}-${seqRecord.sequence.toString().padStart(3, '0')}`;

      const newOrder = await tx.solarOrder.create({
        data: {
          orderNumber,
          customerName: body.customerName,
          phoneNumber: body.phoneNumber,
          whatsappEnabled: body.whatsappEnabled,
          leadSource: body.leadSource,
          referralCustomerId: body.referralCustomerId,
          referralName: body.referralName || null,
          callingExecutiveId: body.callingExecutiveId || null,
          salesmanId: body.salesmanId || null,
          subVendorId: body.subVendorId || null,
          loanCustomer: body.loanCustomer,
          totalOrderAmount: parseFloat(body.totalOrderAmount),
          systemSize: parseFloat(body.systemSize),
          systemType: body.systemType,
          remarks: body.remarks,
          zohoBooksCustomerId: body.zohoBooksCustomerId,
          zohoBooksCustomerName: body.zohoBooksCustomerName,
          createdById: session.userId,
          status: 'PENDING_APPROVAL',
          submittedById: session.userId,
          submittedAt: new Date(),
        }
      });

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: newOrder.id,
          actorId: session.userId,
          actorName: session.name || 'Staff',
          eventType: 'ORDER_SUBMITTED',
          description: `Created and submitted new solar order ${orderNumber} for approval`,
        }
      });

      return newOrder;
    });

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error) {
    console.error('[SolarOrders POST Error]', error);
    return NextResponse.json({ error: 'Failed to create solar order' }, { status: 500 });
  }
}
