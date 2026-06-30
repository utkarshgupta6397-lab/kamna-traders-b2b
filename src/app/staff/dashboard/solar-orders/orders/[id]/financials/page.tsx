import { prisma } from '@/lib/db';
import ZohoCustomerMapper from './ZohoCustomerMapper';
import FinancialDashboardClient from './FinancialDashboardClient';
import { getZohoOrgId } from '@/lib/zoho-auth';

export default async function FinancialsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const order = await prisma.solarOrder.findUnique({
    where: { id },
    select: { zohoBooksCustomerId: true }
  });

  if (!order) {
    return null;
  }

  const orgId = getZohoOrgId();

  return (
    <div className="space-y-6">
      {!order.zohoBooksCustomerId ? (
        <ZohoCustomerMapper orderId={id} />
      ) : (
        <FinancialDashboardClient orderId={id} orgId={orgId} />
      )}
    </div>
  );
}
