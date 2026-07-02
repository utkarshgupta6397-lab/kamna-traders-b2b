import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function validateZohoCustomerUniqueness(zohoBooksCustomerId: string, currentOrderId?: string, tx?: any) {
  const excludedStatuses = ['COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'];
  
  const whereClause: any = {
    zohoBooksCustomerId,
    status: { notIn: excludedStatuses }
  };
  
  if (currentOrderId) {
    whereClause.id = { not: currentOrderId };
  }

  const db = tx || prisma;

  const duplicate = await db.solarOrder.findFirst({
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

export function parseLeadSource(rawSource: string): string | null {
  if (!rawSource) return null;
  
  const validLeadSources = ['WALK_IN', 'REFERRAL', 'ONLINE', 'EXHIBITION', 'OTHER', 'FRIENDS_AND_FAMILY'];
  if (validLeadSources.includes(rawSource)) return rawSource;

  const leadSourceMap: Record<string, string> = {
    'Walk-in': 'WALK_IN',
    'Referral': 'REFERRAL',
    'WhatsApp': 'ONLINE',
    'Friends & Family': 'FRIENDS_AND_FAMILY',
    'Calling Activity': 'OTHER',
    'Sub-Vendor': 'OTHER',
    'Other': 'OTHER'
  };
  
  return leadSourceMap[rawSource] || null;
}
