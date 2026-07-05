import { SOLAR_ORDER_STATUS_GROUPS } from './solar-workflow-config';

export function buildSolarOrdersWhereClause(searchParams: URLSearchParams) {
  const status = searchParams.get('status');
  const systemType = searchParams.get('systemType');
  const search = searchParams.get('search');
  const leadSource = searchParams.get('leadSource');
  const systemSizeMin = searchParams.get('systemSizeMin');
  const systemSizeMax = searchParams.get('systemSizeMax');
  const assignedTo = searchParams.get('assignedTo');
  const quarters = searchParams.get('quarters');
  const hasOutstandingPayment = searchParams.get('hasOutstandingPayment') === 'true';

  const where: any = {};

  if (status && status !== 'All') {
    where.status = { in: SOLAR_ORDER_STATUS_GROUPS[status] || [status] };
  }

  if (systemType && systemType !== 'All') {
    where.systemType = { in: systemType.split(',') };
  }
  
  if (leadSource) {
    where.leadSource = { in: leadSource.split(',') };
  }
  
  if (systemSizeMin || systemSizeMax) {
    where.systemSize = {};
    if (systemSizeMin) {
      const minVal = parseFloat(systemSizeMin);
      if (!isNaN(minVal)) where.systemSize.gte = minVal;
    }
    if (systemSizeMax) {
      const maxVal = parseFloat(systemSizeMax);
      if (!isNaN(maxVal)) where.systemSize.lte = maxVal;
    }
  }

  if (search) {
    const searchNum = parseFloat(search);
    const searchIsNum = !isNaN(searchNum);

    const searchORs: any[] = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { applicationNumber: { contains: search, mode: 'insensitive' } },
      { zohoBooksCustomerName: { contains: search, mode: 'insensitive' } },
    ];

    if (searchIsNum) {
      searchORs.push({ systemSize: { equals: searchNum } });
      searchORs.push({ pendingAmount: { equals: searchNum } });
      searchORs.push({ totalOrderAmount: { equals: searchNum } });
    }

    if (where.OR) {
      if (!where.AND) where.AND = [];
      where.AND.push({ OR: where.OR }, { OR: searchORs });
      delete where.OR;
    } else {
      where.OR = searchORs;
    }
  }
  
  if (quarters) {
    const qList = quarters.split(',');
    const quarterORs: any[] = [];
    
    qList.forEach(q => {
      const [quarter, yearStr] = q.split(' ');
      const year = parseInt(yearStr);
      let startMonth = 0, endMonth = 2;
      if (quarter === 'Q2') { startMonth = 3; endMonth = 5; }
      else if (quarter === 'Q3') { startMonth = 6; endMonth = 8; }
      else if (quarter === 'Q4') { startMonth = 9; endMonth = 11; }
      
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
      
      quarterORs.push({
        orderDate: { gte: startDate, lte: endDate }
      });
    });
    
    if (quarterORs.length > 0) {
      if (where.AND) {
        where.AND.push({ OR: quarterORs });
      } else {
        where.AND = [{ OR: quarterORs }];
      }
    }
  }
  
  if (assignedTo && assignedTo !== 'All') {
    const assigneesList = assignedTo.split(',');
    const hasUnassigned = assigneesList.includes('Unassigned');
    const otherAssignees = assigneesList.filter(a => a !== 'Unassigned');

    const assigneeOR: any[] = [];
    if (hasUnassigned) {
      assigneeOR.push(
        { salesmanId: null, callingExecutiveId: null, subVendorId: null }
      );
    }
    if (otherAssignees.length > 0) {
      assigneeOR.push(
        { salesman: { name: { in: otherAssignees } } },
        { callingExecutive: { name: { in: otherAssignees } } },
        { subVendor: { name: { in: otherAssignees } } }
      );
    }

    if (where.OR) {
      if (!where.AND) where.AND = [];
      where.AND.push({ OR: where.OR }, { OR: assigneeOR });
      delete where.OR;
    } else {
      where.OR = assigneeOR;
    }
  }
  
  if (hasOutstandingPayment) {
    const paymentCondition = {
      OR: [
        {
          zohoBooksCustomerId: { not: null },
          pendingAmount: { gt: 0 }
        },
        {
          zohoBooksCustomerId: null,
          totalOrderAmount: { gt: 0 }
        }
      ]
    };
    
    if (!where.AND) {
      where.AND = [];
    }
    where.AND.push(paymentCondition);
  }

  return where;
}
