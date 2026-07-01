import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateZohoCustomerUniqueness } from '@/lib/zoho-solar-validation';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.solar_orders_master_edit && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Master edit permission required.' }, { status: 403 });
    }

    const { id } = await context.params;

    const existingOrder = await prisma.solarOrder.findUnique({ where: { id }, select: { id: true } });
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await req.json();

    const { 
      customerEmail, loanAnnualIncome, loanQuotationAmount, isMasterEdit, 
      customerName, phoneNumber, whatsappEnabled, leadSource, referralName, 
      zohoBooksCustomerName, zohoBooksCustomerId, systemSize, systemType, loanCustomer, 
      totalOrderAmount, receivedAmount, pendingAmount, floorNumber, 
      remarks, salesmanId, callingExecutiveId 
    } = body;

    const dataToUpdate: any = {};
    if (customerEmail !== undefined) {
      if (typeof customerEmail === 'string' && customerEmail.length > 255) return NextResponse.json({ error: 'Email too long' }, { status: 400 });
      dataToUpdate.customerEmail = customerEmail;
    }
    if (loanAnnualIncome !== undefined) {
      const parsed = Number(loanAnnualIncome);
      if (loanAnnualIncome !== null && (isNaN(parsed) || !isFinite(parsed) || parsed < 0)) return NextResponse.json({ error: 'Invalid Loan Annual Income' }, { status: 400 });
      dataToUpdate.loanAnnualIncome = loanAnnualIncome !== null ? parsed : null;
    }
    if (loanQuotationAmount !== undefined) {
      const parsed = Number(loanQuotationAmount);
      if (loanQuotationAmount !== null && (isNaN(parsed) || !isFinite(parsed) || parsed < 0)) return NextResponse.json({ error: 'Invalid Loan Quotation Amount' }, { status: 400 });
      dataToUpdate.loanQuotationAmount = loanQuotationAmount !== null ? parsed : null;
    }

    if (isMasterEdit) {
      
      if (customerName !== undefined) {
        if (typeof customerName !== 'string' || customerName.trim() === '') return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 });
        if (customerName.length > 120) return NextResponse.json({ error: 'Customer Name cannot exceed 120 characters' }, { status: 400 });
        dataToUpdate.customerName = customerName;
      }
      if (phoneNumber !== undefined) {
        if (typeof phoneNumber !== 'string' || !/^[0-9]{10}$/.test(phoneNumber)) return NextResponse.json({ error: 'Phone Number must be exactly 10 digits' }, { status: 400 });
        dataToUpdate.phoneNumber = phoneNumber;
      }
      if (whatsappEnabled !== undefined) dataToUpdate.whatsappEnabled = whatsappEnabled;
      if (leadSource !== undefined) {
        const validLeadSources = ['WALK_IN', 'REFERRAL', 'ONLINE', 'EXHIBITION', 'OTHER'];
        if (!validLeadSources.includes(leadSource)) return NextResponse.json({ error: `Invalid Lead Source` }, { status: 400 });
        dataToUpdate.leadSource = leadSource;
      }
      if (referralName !== undefined) {
        if (typeof referralName === 'string' && referralName.length > 150) return NextResponse.json({ error: 'Referral Name too long' }, { status: 400 });
        dataToUpdate.referralName = referralName;
      }
      if (zohoBooksCustomerName !== undefined) dataToUpdate.zohoBooksCustomerName = zohoBooksCustomerName;
      if (zohoBooksCustomerId !== undefined) dataToUpdate.zohoBooksCustomerId = zohoBooksCustomerId;
      if (systemSize !== undefined) {
        const parsed = Number(systemSize);
        if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) return NextResponse.json({ error: 'Invalid System Size' }, { status: 400 });
        dataToUpdate.systemSize = parsed;
      }
      if (systemType !== undefined) {
        const validSystemTypes = ['ON_GRID', 'OFF_GRID', 'HYBRID'];
        if (!validSystemTypes.includes(systemType)) return NextResponse.json({ error: `Invalid System Type` }, { status: 400 });
        dataToUpdate.systemType = systemType;
      }
      if (loanCustomer !== undefined) dataToUpdate.loanCustomer = loanCustomer;
      if (totalOrderAmount !== undefined) {
        const parsed = Number(totalOrderAmount);
        if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return NextResponse.json({ error: 'Invalid Total Amount' }, { status: 400 });
        dataToUpdate.totalOrderAmount = parsed;
      }
      if (receivedAmount !== undefined) {
        const parsed = Number(receivedAmount);
        if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return NextResponse.json({ error: 'Invalid Received Amount' }, { status: 400 });
        dataToUpdate.receivedAmount = parsed;
      }
      if (pendingAmount !== undefined) {
        const parsed = Number(pendingAmount);
        if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return NextResponse.json({ error: 'Invalid Pending Amount' }, { status: 400 });
        dataToUpdate.pendingAmount = parsed;
      }
      if (floorNumber !== undefined) {
        const parsed = Number(floorNumber);
        if (floorNumber !== null && (isNaN(parsed) || parsed < 0)) return NextResponse.json({ error: 'Invalid Floor Number' }, { status: 400 });
        dataToUpdate.floorNumber = floorNumber === null ? null : parsed;
      }
      if (remarks !== undefined) {
        if (typeof remarks === 'string' && remarks.length > 1000) return NextResponse.json({ error: 'Remarks too long' }, { status: 400 });
        dataToUpdate.remarks = remarks;
      }
      if (salesmanId !== undefined) dataToUpdate.salesmanId = salesmanId;
      if (callingExecutiveId !== undefined) dataToUpdate.callingExecutiveId = callingExecutiveId;
      
      dataToUpdate.editCount = { increment: 1 };
      dataToUpdate.lastEditedAt = new Date();
      dataToUpdate.lastEditedBy = session.name;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (dataToUpdate.zohoBooksCustomerId) {
        const validationError = await validateZohoCustomerUniqueness(dataToUpdate.zohoBooksCustomerId, id, tx);
        if (validationError) throw validationError;
      }
      const order = await tx.solarOrder.update({
        where: { id },
        data: dataToUpdate
      });

      if (isMasterEdit) {
        const safeMetadata: any = {};
        for (const [key, value] of Object.entries(dataToUpdate)) {
          if (key !== 'editCount' && key !== 'lastEditedAt' && key !== 'lastEditedBy') {
            safeMetadata[key] = value;
          }
        }

        await tx.solarActivityLog.create({
          data: {
            solarOrderId: id,
            eventType: 'MASTER_EDIT',
            actorId: session.userId,
            actorName: session.name || 'Admin',
            description: 'Order details modified via Master Edit mode',
            metadata: safeMetadata
          }
        });
      }

      return order;
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    if (error && error.status && error.json) {
      return error;
    }
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
