import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateZohoCustomerUniqueness, parseLeadSource } from '@/lib/zoho-solar-validation';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const systemType = searchParams.get('systemType');
    const search = searchParams.get('search');
    const leadSource = searchParams.get('leadSource');
    const systemSizeMin = searchParams.get('systemSizeMin');
    const systemSizeMax = searchParams.get('systemSizeMax');
    const assignedTo = searchParams.get('assignedTo');
    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== 'All') {
      where.status = status;
    }

    if (systemType && systemType !== 'All') {
      where.systemType = systemType;
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
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (assignedTo && assignedTo !== 'All') {
      if (assignedTo === 'Unassigned') {
        where.salesmanId = null;
        where.callingExecutiveId = null;
        where.subVendorId = null;
      } else {
        const assigneeOR = [
          { salesmanId: assignedTo },
          { callingExecutiveId: assignedTo },
          { subVendorId: assignedTo }
        ];
        if (where.OR) {
          where.AND = [ { OR: where.OR }, { OR: assigneeOR } ];
          delete where.OR;
        } else {
          where.OR = assigneeOR;
        }
      }
    }
    
    let orderBy: any = { createdAt: 'desc' };
    if (sortField) {
      switch(sortField) {
        case 'orderAmount': orderBy = { totalOrderAmount: sortDirection }; break;
        case 'pendingAmount': orderBy = { pendingAmount: sortDirection }; break;
        case 'orderDate': orderBy = { orderDate: sortDirection }; break;
        case 'customerName': orderBy = { customerName: sortDirection }; break;
        case 'systemSize': orderBy = { systemSize: sortDirection }; break;
      }
    }

    const [ordersData, totalCount] = await Promise.all([
      prisma.solarOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          salesman: { select: { name: true } },
          callingExecutive: { select: { name: true } },
          subVendor: { select: { name: true } },
          payments: { select: { amount: true } },
          workflowSteps: { select: { id: true, stepKey: true, status: true, updatedAt: true, startedAt: true, completedAt: true } }
        }
      }),
      prisma.solarOrder.count({ where }),
    ]);

    const { resolveWorkflowState } = await import('@/lib/solar-workflow-config');

    const orders = ordersData.map((order: any) => {
      const docState = resolveWorkflowState(order.workflowSteps || [], 'DOCUMENTATION');
      const instState = resolveWorkflowState(order.workflowSteps || [], 'INSTALLATION');
      const totalCompleted = docState.completedSteps + instState.completedSteps;
      const totalSteps = docState.totalSteps + instState.totalSteps;
      
      const workflowPercentage = totalSteps > 0 ? Math.round((totalCompleted / totalSteps) * 100) : 0;
      
      return {
        ...order,
        workflowPercentage,
        workflowSteps: undefined // Avoid sending unnecessary data
      };
    });

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

    if (!body.orderDate) {
      return NextResponse.json({ error: 'Order Date is required' }, { status: 400 });
    }
    const orderDateObj = new Date(body.orderDate);
    if (isNaN(orderDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid Order Date format' }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    // Normalize time to compare only dates
    const dateToCheck = new Date(orderDateObj);
    dateToCheck.setHours(0,0,0,0);

    if (dateToCheck > today) {
      return NextResponse.json({ error: 'Order Date cannot be in the future' }, { status: 400 });
    }
    if (dateToCheck < oneYearAgo) {
      return NextResponse.json({ error: 'Order Date cannot be older than one year' }, { status: 400 });
    }

    if (!body.customerName || typeof body.customerName !== 'string' || body.customerName.trim() === '') {
      return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 });
    }
    if (body.customerName.length > 120) {
      return NextResponse.json({ error: 'Customer Name cannot exceed 120 characters' }, { status: 400 });
    }
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string' || !/^[0-9]{10}$/.test(body.phoneNumber)) {
      return NextResponse.json({ error: 'Phone Number must be exactly 10 digits' }, { status: 400 });
    }
    if (body.remarks && typeof body.remarks === 'string' && body.remarks.length > 1000) {
      return NextResponse.json({ error: 'Remarks cannot exceed 1000 characters' }, { status: 400 });
    }
    if (body.referralName && typeof body.referralName === 'string' && body.referralName.length > 150) {
      return NextResponse.json({ error: 'Referral Name cannot exceed 150 characters' }, { status: 400 });
    }

    const parsedLeadSource = parseLeadSource(body.leadSource);
    if (!parsedLeadSource) {
      return NextResponse.json({ error: `Invalid Lead Source` }, { status: 400 });
    }
    body.leadSource = parsedLeadSource;
    const validSystemTypes = ['ON_GRID', 'OFF_GRID', 'HYBRID'];
    if (!validSystemTypes.includes(body.systemType)) {
      return NextResponse.json({ error: `Invalid System Type. Must be one of ${validSystemTypes.join(', ')}` }, { status: 400 });
    }

    // Number Validations
    const totalAmount = parseFloat(body.totalOrderAmount);
    if (isNaN(totalAmount) || !isFinite(totalAmount) || totalAmount < 0) {
      return NextResponse.json({ error: 'Total Order Amount must be a valid positive number' }, { status: 400 });
    }
    const sysSize = parseFloat(body.systemSize);
    if (isNaN(sysSize) || !isFinite(sysSize) || sysSize <= 0) {
      return NextResponse.json({ error: 'System Size must be a valid positive number' }, { status: 400 });
    }
    if (body.loanCustomer) {
      if (body.loanQuotationAmount) {
        const loanQ = parseFloat(body.loanQuotationAmount);
        if (isNaN(loanQ) || !isFinite(loanQ) || loanQ < 0) return NextResponse.json({ error: 'Loan Quotation Amount must be a valid number' }, { status: 400 });
      }
      if (body.loanAnnualIncome) {
        const loanI = parseFloat(body.loanAnnualIncome);
        if (isNaN(loanI) || !isFinite(loanI) || loanI < 0) return NextResponse.json({ error: 'Loan Annual Income must be a valid number' }, { status: 400 });
      }
    }
    if (body.panels && body.panels.length > 50) {
      return NextResponse.json({ error: 'Cannot add more than 50 panels' }, { status: 400 });
    }
    if (body.inverters && body.inverters.length > 20) {
      return NextResponse.json({ error: 'Cannot add more than 20 inverters' }, { status: 400 });
    }

    const newOrder = await prisma.$transaction(async (tx) => {
      if (body.zohoBooksCustomerId) {
        const validationError = await validateZohoCustomerUniqueness(body.zohoBooksCustomerId, undefined, tx);
        if (validationError) throw validationError; // We will catch this below
      }
      const now = new Date();
      const currentYear = now.getFullYear().toString().slice(2);
      const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const yearMonthStr = `${currentYear}${currentMonth}`;
      const tempSequence = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `TEMP-${yearMonthStr}-${tempSequence}`;

      const newOrder = await tx.solarOrder.create({
        data: {
          orderNumber,
          orderDate: orderDateObj,
          customerName: body.customerName,
          phoneNumber: body.phoneNumber,
          whatsappEnabled: body.whatsappEnabled,
          leadSource: body.leadSource,
          referralCustomerId: body.referralCustomerId || null,
          referralName: body.referralName || null,
          callingExecutiveId: body.callingExecutiveId || null,
          salesmanId: body.salesmanId || null,
          subVendorId: body.subVendorId || null,
          otherLeadSource: body.otherLeadSource || null,
          loanCustomer: body.loanCustomer,
          loanQuotationAmount: body.loanQuotationAmount ? parseFloat(body.loanQuotationAmount) : null,
          loanAnnualIncome: body.loanAnnualIncome ? parseFloat(body.loanAnnualIncome) : null,
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
          floorNumber: body.floorNumber !== '' ? parseInt(body.floorNumber, 10) : null,
          panels: {
            create: body.panels.map((p: any, idx: number) => ({
              description: p.description,
              quantity: parseInt(p.quantity, 10),
              orderIndex: idx
            }))
          },
          inverters: {
            create: body.inverters.map((i: any, idx: number) => ({
              description: i.description,
              quantity: parseInt(i.quantity, 10),
              orderIndex: idx
            }))
          },
          files: body.siteImages && body.siteImages.length > 0 ? {
            create: body.siteImages.map((img: any, idx: number) => ({
              fileUrl: img.url,
              fileName: img.fileName,
              fileType: img.mimeType,
              fileSizeBytes: img.fileSize,
              fileCategory: 'SITE_IMAGE',
              uploadedById: session.userId
            }))
          } : undefined,
        }
      });

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: newOrder.id,
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          eventType: 'ORDER_SUBMITTED',
          description: `Created and submitted new solar order ${orderNumber} for approval`,
        }
      });

      return newOrder;
    });

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error: any) {
    if (error && error.status && error.json) {
      return error; // Return NextResponse thrown from zoho validation
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    if (error.name === 'PrismaClientValidationError') {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }
    console.error('[SolarOrders POST Error]', error);
    return NextResponse.json({ error: 'Failed to create solar order' }, { status: 500 });
  }
}
