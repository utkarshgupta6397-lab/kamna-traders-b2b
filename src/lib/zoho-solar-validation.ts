import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function validateZohoCustomerUniqueness(zohoBooksCustomerId: string, currentOrderId?: string) {
  const excludedStatuses = ['COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'];
  
  const whereClause: any = {
    zohoBooksCustomerId,
    status: { notIn: excludedStatuses }
  };
  
  if (currentOrderId) {
    whereClause.id = { not: currentOrderId };
  }

  const duplicate = await prisma.solarOrder.findFirst({
    where: whereClause,
    select: { id: true, orderNumber: true, status: true }
  });

  if (duplicate) {
    return NextResponse.json({
      success: false,
      code: 'ZOHO_CUSTOMER_ALREADY_LINKED',
      message: 'This Zoho Customer already has an active Solar Order.',
      existingOrderId: duplicate.id,
      existingOrderNumber: duplicate.orderNumber,
      existingStatus: duplicate.status
    }, { status: 409 });
  }

  return null; // validation passed
}
