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
    
    // Multi-select filters come as comma-separated strings
    const quarterParam = searchParams.get('quarter');
    const monthParam = searchParams.get('month');
    const salesmanIdParam = searchParams.get('userId');
    const leadSourceParam = searchParams.get('leadSource');
    const systemTypeParam = searchParams.get('systemType');

    const quarters = quarterParam ? quarterParam.split(',') : [];
    const months = monthParam ? monthParam.split(',') : [];
    const salesmanIds = salesmanIdParam ? salesmanIdParam.split(',') : [];
    const leadSources = leadSourceParam ? leadSourceParam.split(',') : [];
    const systemTypes = systemTypeParam ? systemTypeParam.split(',') : [];

    // Build base where clause
    const where: Prisma.SolarOrderWhereInput = {
      status: { notIn: ['DRAFT', 'CANCELLED'] },
    };

    if (salesmanIds.length > 0) where.salesmanId = { in: salesmanIds };
    if (leadSources.length > 0) where.leadSource = { in: leadSources };
    if (systemTypes.length > 0) where.systemType = { in: systemTypes };

    // Date logic - complex when multiple quarters and months are selected
    // For MVP we will union the date ranges if provided
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
        salesman: true,
      },
      orderBy: { orderDate: 'asc' },
    });

    // 1. Aggregations
    let totalSales = 0;
    let totalOrders = orders.length;
    let totalPendingPayments = 0;
    let activeCustomersSet = new Set();
    let approvedOrdersCount = 0;

    orders.forEach(o => {
      totalSales += o.totalOrderAmount;
      totalPendingPayments += o.pendingAmount;
      if (o.status === 'EXECUTION' || o.status === 'COMPLETED') {
        activeCustomersSet.add(o.customerName);
      }
      if (o.status !== 'PENDING_APPROVAL') {
        approvedOrdersCount++;
      }
    });

    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const conversionRate = totalOrders > 0 ? (approvedOrdersCount / totalOrders) * 100 : 0;
    const collectionPct = totalSales > 0 ? ((totalSales - totalPendingPayments) / totalSales) * 100 : 0;

    // Dynamic KPIs using Google Material Colors
    const kpis = [
      { id: 'total_sales', title: 'Total Sales', value: totalSales, format: 'currency', colorVariant: 'blue', icon: 'IndianRupee' },
      { id: 'total_orders', title: 'Total Orders', value: totalOrders, format: 'number', colorVariant: 'green', icon: 'Hash' },
      { id: 'aov', title: 'Avg Order Value', value: averageOrderValue, format: 'currency', colorVariant: 'purple', icon: 'TrendingUp' },
      { id: 'active_customers', title: 'Active Customers', value: activeCustomersSet.size, format: 'number', colorVariant: 'teal', icon: 'Users' },
      { id: 'pending_payments', title: 'Pending Payments', value: totalPendingPayments, format: 'currency', colorVariant: 'amber', icon: 'CreditCard' },
      { id: 'conversion_rate', title: 'Conversion Rate', value: conversionRate, format: 'percentage', colorVariant: 'teal', icon: 'Zap', subtitle: 'Approved / Total Orders' },
      { id: 'collection_pct', title: 'Collection %', value: collectionPct, format: 'percentage', colorVariant: 'green', icon: 'CheckCircle' },
    ];

    // 2. Lead Source Breakdown
    const sourceMap = new Map<string, { count: number; value: number }>();
    orders.forEach(o => {
      const current = sourceMap.get(o.leadSource) || { count: 0, value: 0 };
      sourceMap.set(o.leadSource, {
        count: current.count + 1,
        value: current.value + o.totalOrderAmount,
      });
    });

    const leadSourceBreakdown = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      value: data.value,
      count: data.count,
    }));

    // 3. Salesman Ranking
    const salesmanMap = new Map<string, any>();
    orders.forEach(o => {
      if (!o.salesmanId) return;
      const sm = salesmanMap.get(o.salesmanId) || {
        id: o.salesmanId,
        name: o.salesman?.name || 'Unknown',
        orders: 0,
        totalSales: 0,
        pendingPayment: 0,
        approvedCount: 0,
      };
      sm.orders++;
      sm.totalSales += o.totalOrderAmount;
      sm.pendingPayment += o.pendingAmount;
      if (o.status !== 'PENDING_APPROVAL') sm.approvedCount++;
      salesmanMap.set(o.salesmanId, sm);
    });

    const salesmanRanking = Array.from(salesmanMap.values()).map(sm => ({
      ...sm,
      avgOrderValue: sm.orders > 0 ? sm.totalSales / sm.orders : 0,
      conversionPct: sm.orders > 0 ? (sm.approvedCount / sm.orders) * 100 : 0,
    })).sort((a, b) => b.totalSales - a.totalSales);

    // 4. Time Trends (Aggregating actual data instead of mock)
    const quarterlySalesMap = new Map<string, { sales: number, orders: number }>();
    const monthlySalesMap = new Map<string, { sales: number, orders: number }>();
    
    orders.forEach(o => {
      const d = new Date(o.orderDate);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const q = Math.floor(month / 3) + 1;
      
      const qKey = `Q${q}-${year}`;
      const mKey = `${year}-${String(month + 1).padStart(2, '0')}`; // YYYY-MM
      
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
      leadSourceBreakdown,
      salesmanRanking,
      quarterTrend,
      monthTrend,
      rawStats: {
        totalOrders,
      }
    };

    if (format === 'csv') {
      const headers = ['Salesman', 'Orders', 'Total Sales', 'Avg Order Value', 'Pending Payment', 'Conversion %'];
      const rows = salesmanRanking.map(s => [
        s.name,
        s.orders,
        formatIndianCurrency(s.totalSales, false).replace(/,/g, ''), // Strip commas for CSV if raw value is preferred, but user said format exactly.
        // Actually, wrap in quotes to preserve Indian commas
        `"${formatIndianCurrency(s.totalSales, false)}"`,
        `"${formatIndianCurrency(s.avgOrderValue, false)}"`,
        `"${formatIndianCurrency(s.pendingPayment, false)}"`,
        `"${formatPercentage(s.conversionPct)}"`,
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="salesman_report.csv"',
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching salesman report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
