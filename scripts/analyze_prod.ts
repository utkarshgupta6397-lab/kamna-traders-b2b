import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function analyzeProd() {
  console.log('Connecting to production database...');
  
  // Total Orders
  const totalOrders = await prisma.solarOrder.count();
  
  // Group by status
  const statuses = await prisma.solarOrder.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  // Group by leadSource
  const leadSources = await prisma.solarOrder.groupBy({
    by: ['leadSource'],
    _count: { id: true }
  });

  // Group by systemType
  const systemTypes = await prisma.solarOrder.groupBy({
    by: ['systemType'],
    _count: { id: true }
  });

  // Group by systemSize
  const systemSizes = await prisma.solarOrder.groupBy({
    by: ['systemSize'],
    _count: { id: true }
  });

  // Group by city (from installationAddress)
  const orders = await prisma.solarOrder.findMany({
    select: {
      totalOrderAmount: true,
      pendingAmount: true,
      zohoBooksCustomerId: true,
      subVendor: { select: { name: true } },
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      workflowSteps: {
        select: {
          workflowType: true,
          status: true
        }
      }
    }
  });

  let totalOrderAmount = 0;
  let minOrderAmount = Infinity;
  let maxOrderAmount = -Infinity;
  let linkedToZoho = 0;
  let notLinkedToZoho = 0;
  let fullyPaid = 0;
  let zeroPaid = 0;
  let partiallyPaid = 0;
  let outstandingCount = 0;

  const salesmen: Record<string, number> = {};
  const callingExecs: Record<string, number> = {};
  const subVendors: Record<string, number> = {};
  const docProgress: Record<string, number> = {};
  const instProgress: Record<string, number> = {};

  orders.forEach((o: any) => {
    // Payments
    if (o.totalOrderAmount > 0) {
      totalOrderAmount += o.totalOrderAmount;
      if (o.totalOrderAmount < minOrderAmount) minOrderAmount = o.totalOrderAmount;
      if (o.totalOrderAmount > maxOrderAmount) maxOrderAmount = o.totalOrderAmount;
    }

    if (o.zohoBooksCustomerId) {
      linkedToZoho++;
      if (o.pendingAmount === 0) fullyPaid++;
      else if (o.pendingAmount === o.totalOrderAmount) zeroPaid++;
      else partiallyPaid++;
      
      if (o.pendingAmount > 0) outstandingCount++;
    } else {
      notLinkedToZoho++;
      zeroPaid++;
      outstandingCount++;
    }

    // Team
    if (o.salesman?.name) salesmen[o.salesman.name] = (salesmen[o.salesman.name] || 0) + 1;
    if (o.callingExecutive?.name) callingExecs[o.callingExecutive.name] = (callingExecs[o.callingExecutive.name] || 0) + 1;
    if (o.subVendor?.name) subVendors[o.subVendor.name] = (subVendors[o.subVendor.name] || 0) + 1;

    // Workflow
    let docCompleted = 0, docTotal = 0;
    let instCompleted = 0, instTotal = 0;
    if (o.workflowSteps) {
      o.workflowSteps.forEach((w: any) => {
        if (w.workflowType === 'DOCUMENTATION') {
          docTotal++;
          if (w.status === 'COMPLETED') docCompleted++;
        }
        if (w.workflowType === 'INSTALLATION') {
          instTotal++;
          if (w.status === 'COMPLETED') instCompleted++;
        }
      });
    }

    const dPct = docTotal > 0 ? Math.round((docCompleted / docTotal) * 10) * 10 : 0; // round to nearest 10
    const iPct = instTotal > 0 ? Math.round((instCompleted / instTotal) * 10) * 10 : 0;

    docProgress[`${dPct}%`] = (docProgress[`${dPct}%`] || 0) + 1;
    instProgress[`${iPct}%`] = (instProgress[`${iPct}%`] || 0) + 1;
  });

  const averageOrderValue = totalOrders > 0 ? Math.round(totalOrderAmount / totalOrders) : 0;

  const stats = {
    totalOrders,
    averageOrderValue,
    minOrderAmount: minOrderAmount === Infinity ? 0 : minOrderAmount,
    maxOrderAmount: maxOrderAmount === -Infinity ? 0 : maxOrderAmount,
    zohoLinkage: { linkedToZoho, notLinkedToZoho },
    payments: { fullyPaid, zeroPaid, partiallyPaid, outstandingCount },
    statuses: statuses.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    leadSources: leadSources.reduce((acc, s) => ({ ...acc, [s.leadSource || 'UNKNOWN']: s._count.id }), {}),
    systemTypes: systemTypes.reduce((acc, s) => ({ ...acc, [s.systemType]: s._count.id }), {}),
    systemSizes: systemSizes.reduce((acc, s) => ({ ...acc, [s.systemSize]: s._count.id }), {}),
    salesmen,
    callingExecs,
    subVendors,
    docProgress,
    instProgress
  };

  fs.writeFileSync('prod_stats.json', JSON.stringify(stats, null, 2));
  console.log('Production statistics written to prod_stats.json');
}

analyzeProd().catch(console.error).finally(() => prisma.$disconnect());
