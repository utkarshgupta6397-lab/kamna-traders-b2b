import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.solar_orders_view && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const { 
      customerEmail, loanAnnualIncome, loanQuotationAmount, isMasterEdit, 
      customerName, phoneNumber, whatsappEnabled, leadSource, referralName, 
      zohoBooksCustomerName, systemSize, systemType, loanCustomer, 
      totalOrderAmount, receivedAmount, pendingAmount, floorNumber, 
      remarks, salesmanId, callingExecutiveId 
    } = body;

    const dataToUpdate: any = {};
    if (customerEmail !== undefined) dataToUpdate.customerEmail = customerEmail;
    if (loanAnnualIncome !== undefined) dataToUpdate.loanAnnualIncome = loanAnnualIncome !== null ? Number(loanAnnualIncome) : null;
    if (loanQuotationAmount !== undefined) dataToUpdate.loanQuotationAmount = loanQuotationAmount !== null ? Number(loanQuotationAmount) : null;

    if (isMasterEdit) {
      if (!session.solar_orders_master_edit && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Master edit permission required' }, { status: 403 });
      }
      
      if (customerName !== undefined) dataToUpdate.customerName = customerName;
      if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
      if (whatsappEnabled !== undefined) dataToUpdate.whatsappEnabled = whatsappEnabled;
      if (leadSource !== undefined) dataToUpdate.leadSource = leadSource;
      if (referralName !== undefined) dataToUpdate.referralName = referralName;
      if (zohoBooksCustomerName !== undefined) dataToUpdate.zohoBooksCustomerName = zohoBooksCustomerName;
      if (systemSize !== undefined) dataToUpdate.systemSize = Number(systemSize);
      if (systemType !== undefined) dataToUpdate.systemType = systemType;
      if (loanCustomer !== undefined) dataToUpdate.loanCustomer = loanCustomer;
      if (totalOrderAmount !== undefined) dataToUpdate.totalOrderAmount = Number(totalOrderAmount);
      if (receivedAmount !== undefined) dataToUpdate.receivedAmount = Number(receivedAmount);
      if (pendingAmount !== undefined) dataToUpdate.pendingAmount = Number(pendingAmount);
      if (floorNumber !== undefined) dataToUpdate.floorNumber = floorNumber === null ? null : Number(floorNumber);
      if (remarks !== undefined) dataToUpdate.remarks = remarks;
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
      const order = await tx.solarOrder.update({
        where: { id },
        data: dataToUpdate
      });

      if (isMasterEdit) {
        await tx.solarActivityLog.create({
          data: {
            solarOrderId: id,
            eventType: 'MASTER_EDIT',
            actorId: session.userId,
            actorName: session.name || 'Admin',
            description: 'Order details modified via Master Edit mode',
            metadata: {
              ...body
            }
          }
        });
      }

      return order;
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
