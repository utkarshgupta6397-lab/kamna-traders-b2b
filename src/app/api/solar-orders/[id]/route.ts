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

    const { customerEmail, loanAnnualIncome, loanQuotationAmount } = body;

    const dataToUpdate: any = {};
    if (customerEmail !== undefined) dataToUpdate.customerEmail = customerEmail;
    if (loanAnnualIncome !== undefined) dataToUpdate.loanAnnualIncome = loanAnnualIncome !== null ? Number(loanAnnualIncome) : null;
    if (loanQuotationAmount !== undefined) dataToUpdate.loanQuotationAmount = loanQuotationAmount !== null ? Number(loanQuotationAmount) : null;

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const updatedOrder = await prisma.solarOrder.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
