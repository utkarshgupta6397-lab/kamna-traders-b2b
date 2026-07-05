import { prisma } from '@/lib/db';
import { getLogicalStatusGroup } from './solar-workflow-config';

export const getQuarter = (dateString: string | Date): string => {
  const d = new Date(dateString);
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m < 3) return `Q1 ${y}`;
  if (m < 6) return `Q2 ${y}`;
  if (m < 9) return `Q3 ${y}`;
  return `Q4 ${y}`;
};

export const formatSystemType = (type: string) => {
  if (!type) return '';
  return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join('-');
};

export const getLeadSourceBadgeLabel = (source: string) => {
  switch(source?.toUpperCase()) {
    case 'WALK_IN': 
    case 'WALK-IN': return 'Walk-in';
    case 'WHATSAPP': 
    case 'ONLINE': return 'Online';
    case 'REFERRAL': return 'Referral';
    case 'FRIENDS & FAMILY':
    case 'FRIENDS_AND_FAMILY': return 'Friends & Family';
    case 'CALLING_ACTIVITY': 
    case 'CALLING ACTIVITY': return 'Calling Activity';
    case 'SUB_VENDOR': 
    case 'SUB-VENDOR': return 'Sub-Vendor';
    default: return 'Other';
  }
};

export async function computeFacets(whereClause: any) {
  const facetOrders = await prisma.solarOrder.findMany({
    where: whereClause,
    select: {
      systemType: true,
      orderDate: true,
      leadSource: true,
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      subVendor: { select: { name: true } }
    }
  });

  const opts = {
    systemTypes: {} as Record<string, number>,
    quarters: {} as Record<string, number>,
    leadSources: {} as Record<string, number>,
    assignees: {} as Record<string, number>
  };

  for (const o of facetOrders) {
    const st = formatSystemType(o.systemType);
    opts.systemTypes[st] = (opts.systemTypes[st] || 0) + 1;
    
    const q = getQuarter(o.orderDate);
    opts.quarters[q] = (opts.quarters[q] || 0) + 1;
    
    const ls = o.leadSource || 'OTHER';
    opts.leadSources[ls] = (opts.leadSources[ls] || 0) + 1;
    
    const assignee = o.salesman?.name || o.callingExecutive?.name || o.subVendor?.name || 'Unassigned';
    opts.assignees[assignee] = (opts.assignees[assignee] || 0) + 1;
  }

  return {
    systemTypes: Object.entries(opts.systemTypes).map(([k, v]) => ({ label: k, value: k.toUpperCase().replace('-', '_'), count: v })).sort((a,b) => b.count - a.count),
    quarters: Object.entries(opts.quarters).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => {
      const [qA, yA] = a.label.split(' ');
      const [qB, yB] = b.label.split(' ');
      if (yA !== yB) return parseInt(yB) - parseInt(yA);
      return qA.localeCompare(qB);
    }),
    leadSources: Object.entries(opts.leadSources).map(([k, v]) => ({ label: getLeadSourceBadgeLabel(k), value: k, count: v })).sort((a,b) => b.count - a.count),
    assignees: Object.entries(opts.assignees).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => b.count - a.count)
  };
}

export async function computeStatusCounts(search: string | null, activeWorkflowStatuses?: string[]) {
  const searchWhere: any = {};
  if (search) {
    searchWhere.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { applicationNumber: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (activeWorkflowStatuses) {
    searchWhere.status = { in: activeWorkflowStatuses };
  }

  const grouped = await prisma.solarOrder.groupBy({
    by: ['status'],
    where: searchWhere,
    _count: true
  });

  const counts = {
    all: 0,
    pendingApproval: 0,
    execution: 0,
    completed: 0,
    rejected: 0,
  };

  for (const g of grouped) {
    counts.all += g._count;
    const s = g.status;
    if (s === 'PENDING_APPROVAL') counts.pendingApproval += g._count;
    else if (['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'].includes(s)) counts.execution += g._count;
    else if (s === 'COMPLETED') counts.completed += g._count;
    else if (['REJECTED', 'CANCELLED'].includes(s)) counts.rejected += g._count;
  }

  return counts;
}
