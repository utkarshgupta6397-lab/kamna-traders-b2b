import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintTransferSlipClient from '@/components/PrintTransferSlipClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PrintTransferSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Ftransfers');
  }

  const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
  if (!hasPermission) {
    redirect('/staff/dashboard');
  }

  const { id } = await params;

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      sourceWarehouse: { select: { name: true } },
      destinationWarehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      dispatchedBy: { select: { name: true } },
      items: {
        include: {
          sku: { select: { name: true, unit: true } }
        }
      }
    }
  });

  if (!transfer) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Transfer not found
      </div>
    );
  }

  const printPayload = {
    transferNumber: transfer.transferNumber,
    sourceWarehouseName: transfer.sourceWarehouse.name,
    destinationWarehouseName: transfer.destinationWarehouse.name,
    responsiblePerson: transfer.responsiblePerson,
    remarks: transfer.remarks,
    createdAt: transfer.createdAt.toISOString(),
    dispatchedAt: transfer.dispatchedAt ? transfer.dispatchedAt.toISOString() : null,
    staffName: transfer.createdBy.name,
    dispatchedByName: transfer.dispatchedBy?.name || null,
    items: transfer.items.map(item => ({
      skuId: item.skuId,
      name: item.sku.name,
      requestedQty: item.requestedQty,
      dispatchedQty: item.dispatchedQty,
      unit: item.sku.unit || 'PCS'
    }))
  };

  return (
    <PrintTransferSlipClient
      payload={printPayload}
    />
  );
}
