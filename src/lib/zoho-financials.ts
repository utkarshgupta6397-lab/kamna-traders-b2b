import { prisma } from '@/lib/db';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function syncOrderPayments(
  orderId: string, 
  zohoBooksCustomerId: string, 
  totalOrderAmount: number, 
  accessToken: string, 
  orgId: string
) {
  const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${zohoBooksCustomerId}&sort_column=date&sort_order=D`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Zoho Fetch Payments Error]', errText);
    try {
      const errJson = JSON.parse(errText);
      if (errJson.code === 57) {
        throw new Error('Missing OAuth scopes or Payments module disabled');
      }
      throw new Error(errJson.message || 'Failed to fetch payments');
    } catch (e: any) {
      throw new Error(e.message || 'Failed to fetch payments from Zoho');
    }
  }

  const data = await res.json();
  const payments = data.customerpayments || [];
  
  let receivedAmount = 0;
  for (const p of payments) {
    if (p.cf_is_verified) {
      receivedAmount += p.amount;
    }
  }

  const pendingAmount = Math.max(0, totalOrderAmount - receivedAmount);
  
  const updatedOrder = await prisma.solarOrder.update({
    where: { id: orderId },
    data: {
      receivedAmount,
      pendingAmount,
      lastPaymentSyncAt: new Date()
    }
  });

  return { 
    payments, 
    receivedAmount, 
    pendingAmount, 
    lastPaymentSyncAt: updatedOrder.lastPaymentSyncAt 
  };
}
