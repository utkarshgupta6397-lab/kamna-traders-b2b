import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { formatIndianCurrency, formatPercentage } from '@/lib/formatters';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (!session.solar_orders_view && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');
    
    const quarterParam = searchParams.get('quarter');
    const monthParam = searchParams.get('month');
    const callingExecutiveIdParam = searchParams.get('userId');
    const systemTypeParam = searchParams.get('systemType');

    const quarters = quarterParam ? quarterParam.split(',') : [];
    const months = monthParam ? monthParam.split(',') : [];
    const callingExecutiveIds = callingExecutiveIdParam ? callingExecutiveIdParam.split(',') : [];
    const systemTypes = systemTypeParam ? systemTypeParam.split(',') : [];

    // Build base where clause
    // STRICT BUSINESS RULE: Only include CALLING_ACTIVITY leads
    const where: Prisma.SolarOrderWhereInput = {
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      leadSource: 'CALLING_ACTIVITY',
    };

    if (callingExecutiveIds.length > 0) where.callingExecutiveId = { in: callingExecutiveIds };
    if (systemTypes.length > 0) where.systemType = { in: systemTypes };

    if (months.length > 0 || quarters.length > 0) {
      const OR: Prisma.SolarOrderWhereInput[] = [];
      
      months.forEach(m => {
        const startDate = new Date(`${m}-01T00:00:00.000Z`);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        OR.push({ orderDate: { gte: startDate, lt: endDate } });
      });

      quarters.forEach(qtr => {
        const [q, y] = qtr.split('-');
        const year = parseInt(y);
        let startMonth = 0;
        if (q === 'Q2') startMonth = 3;
        if (q === 'Q3') startMonth = 6;
        if (q === 'Q4') startMonth = 9;
        
        const startDate = new Date(Date.UTC(year, startMonth, 1));
        const endDate = new Date(Date.UTC(year, startMonth + 3, 1));
        OR.push({ orderDate: { gte: startDate, lt: endDate } });
      });

      if (OR.length > 0) {
        where.OR = OR;
      }
    }

    const orders = await prisma.solarOrder.findMany({
      where,
      include: {
        callingExecutive: true,
      },
      orderBy: { orderDate: 'asc' },
    });

    // 1. Aggregations for Calling Agents
    let salesGenerated = 0;
    let ordersConverted = orders.length;
    let pendingCollection = 0;
    let approvedOrdersCount = 0;

    orders.forEach(o => {
      salesGenerated += o.totalOrderAmount;
      pendingCollection += o.pendingAmount;
      if (o.status !== 'PENDING_APPROVAL') {
        approvedOrdersCount++;
      }
    });

    const averageTicketSize = ordersConverted > 0 ? salesGenerated / ordersConverted : 0;
    const conversionPct = ordersConverted > 0 ? (approvedOrdersCount / ordersConverted) * 100 : 0;

    // Dynamic KPIs using Google Material Colors
    const kpis = [
      { id: 'orders_converted', title: 'Orders Converted', value: ordersConverted, format: 'number', colorVariant: 'green', icon: 'Hash' },
      { id: 'sales_generated', title: 'Sales Generated', value: salesGenerated, format: 'currency', colorVariant: 'blue', icon: 'IndianRupee' },
      { id: 'avg_ticket_size', title: 'Avg Ticket Size', value: averageTicketSize, format: 'currency', colorVariant: 'purple', icon: 'TrendingUp' },
      { id: 'pending_collection', title: 'Pending Collection', value: pendingCollection, format: 'currency', colorVariant: 'amber', icon: 'CreditCard' },
      { id: 'conversion_pct', title: 'Conversion Rate', value: conversionPct, format: 'percentage', colorVariant: 'teal', icon: 'Zap', subtitle: 'Approved / Total Orders' },
    ];

    // 3. Calling Agent Ranking
    const agentMap = new Map<string, any>();
    orders.forEach(o => {
      // Group strictly by calling executive
      const executiveId = o.callingExecutiveId || 'unassigned';
      const ag = agentMap.get(executiveId) || {
        id: executiveId,
        name: o.callingExecutive?.name || 'Unknown Executive',
        orders: 0,
        totalSales: 0,
        pendingPayment: 0,
        approvedCount: 0,
      };
      ag.orders++;
      ag.totalSales += o.totalOrderAmount;
      ag.pendingPayment += o.pendingAmount;
      if (o.status !== 'PENDING_APPROVAL') ag.approvedCount++;
      agentMap.set(executiveId, ag);
    });

    const agentRanking = Array.from(agentMap.values()).map(ag => ({
      ...ag,
      conversionPct: ag.orders > 0 ? (ag.approvedCount / ag.orders) * 100 : 0,
    })).sort((a, b) => b.totalSales - a.totalSales);

    // 4. Time Trends
    const quarterlySalesMap = new Map<string, { sales: number, orders: number }>();
    const monthlySalesMap = new Map<string, { sales: number, orders: number }>();
    
    orders.forEach(o => {
      const d = new Date(o.orderDate);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const q = Math.floor(month / 3) + 1;
      
      const qKey = `Q${q}-${year}`;
      const mKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      const qData = quarterlySalesMap.get(qKey) || { sales: 0, orders: 0 };
      qData.sales += o.totalOrderAmount;
      qData.orders++;
      quarterlySalesMap.set(qKey, qData);
      
      const mData = monthlySalesMap.get(mKey) || { sales: 0, orders: 0 };
      mData.sales += o.totalOrderAmount;
      mData.orders++;
      monthlySalesMap.set(mKey, mData);
    });

    const quarterTrend = Array.from(quarterlySalesMap.entries())
      .map(([quarter, data]) => ({ quarter, sales: data.sales, orders: data.orders }))
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
      
    const monthTrend = Array.from(monthlySalesMap.entries())
      .map(([month, data]) => ({ month, sales: data.sales, orders: data.orders }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const responseData = {
      kpis,
      agentRanking,
      quarterTrend,
      monthTrend,
      rawStats: {
        ordersConverted,
      }
    };

    if (format === 'csv') {
      const headers = ['Calling Executive', 'Orders', 'Sales', 'Pending Payment', 'Conversion %'];
      const rows = agentRanking.map(a => [
        a.name,
        a.orders,
        `"${formatIndianCurrency(a.totalSales, false)}"`,
        `"${formatIndianCurrency(a.pendingPayment, false)}"`,
        `"${formatPercentage(a.conversionPct)}"`,
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="calling_agent_report.csv"',
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching calling agent report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
