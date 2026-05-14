import { prisma } from '@/lib/db';
import PrintSlipClient from '@/components/PrintSlipClient';
import { getZohoOrgId } from '@/lib/zoho-auth';

export default async function PrintSlipPage({
  params,
}: {
  params: Promise<{ cartId: string }>;
}) {
  const { cartId } = await params;

  // Server-side fallback: fetch cart data for direct URL access / bookmarks
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      id: true,
      dispatchSlipNumber: true,
      customerName: true,
      notes: true,
      createdAt: true,
      warehouse: { select: { name: true, printZonalSlips: true } },
      staff: { select: { name: true } },
      warehouseId: true,
      zohoSyncStatus: true,
      zohoSyncStep: true,
      zohoSyncError: true,
      zohoSalesorderId: true,
      zohoSalesorderNumber: true,
      zohoPayload: true,
      zohoResponse: true,
      zohoResponseTimeMs: true,
      zohoExecutionTrace: true,
      items: {
        include: {
          sku: { select: { name: true, unit: true } },
        },
      },
    },
  });

  let serverPayload = null;

  if (cart) {
    const orgId = getZohoOrgId();
    const booksUrl = (cart.zohoSyncStatus === 'SUCCESS' && cart.zohoSalesorderId && orgId)
      ? `https://books.zoho.in/app/${orgId}#/salesorders/${cart.zohoSalesorderId}`
      : null;

    // Fetch zone info in a single query
    const warehouseInventory = await prisma.warehouseInventory.findMany({
      where: {
        warehouseId: cart.warehouseId,
        skuId: { in: cart.items.map((i) => i.skuId) },
      },
      select: { skuId: true, zone: true },
    });

    const zoneMap = new Map(warehouseInventory.map((i) => [i.skuId, i.zone]));

    const enrichedItems = cart.items.map((item) => ({
      skuId: item.skuId,
      name: item.sku.name,
      qty: item.qty,
      unit: item.sku.unit || 'PCS',
      zone: zoneMap.get(item.skuId) ?? 'Unassigned',
    }));

    const zoneGroups: Record<string, typeof enrichedItems> = {};
    for (const item of enrichedItems) {
      (zoneGroups[item.zone] ??= []).push(item);
    }

    serverPayload = {
      id: cart.id,
      dispatchSlipNumber: cart.dispatchSlipNumber || cart.id,
      customerName: cart.customerName,
      notes: cart.notes,
      createdAt: cart.createdAt.toISOString(),
      warehouseName: cart.warehouse.name,
      printZonalSlips: cart.warehouse.printZonalSlips,
      staffName: cart.staff.name,
      items: enrichedItems,
      zoneGroups,
      qrPayload: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/r/${cart.id}`,
      // Zoho Status
      zohoSyncStatus: cart.zohoSyncStatus,
      zohoSyncStep: cart.zohoSyncStep,
      zohoSyncError: cart.zohoSyncError,
      zohoSalesorderId: cart.zohoSalesorderId,
      zohoSalesorderNumber: cart.zohoSalesorderNumber,
      zohoPayload: cart.zohoPayload,
      zohoResponse: cart.zohoResponse,
      zohoResponseTimeMs: cart.zohoResponseTimeMs,
      zohoExecutionTrace: cart.zohoExecutionTrace,
      booksUrl
    };
  }

  return (
    <PrintSlipClient
      cartId={cartId}
      serverPayload={serverPayload}
    />
  );
}
