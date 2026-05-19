import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintTransferReceiveSlipClient from '@/components/PrintTransferReceiveSlipClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PrintTransferReceiveSlipPage({
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
      receivedBy: { select: { name: true } },
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
    receivedAt: transfer.receivedAt ? transfer.receivedAt.toISOString() : null,
    staffName: transfer.createdBy.name,
    receivedByName: transfer.receivedBy?.name || null,
    items: transfer.items.map(item => ({
      skuId: item.skuId,
      name: item.sku.name,
      dispatchedQty: item.dispatchedQty,
      receivedQty: item.receivedQty || 0,
      shortQty: item.shortQty || 0,
      unit: item.sku.unit || 'PCS'
    }))
  };

  return (
    <PrintTransferReceiveSlipClient
      payload={printPayload}
    />
  );
}
