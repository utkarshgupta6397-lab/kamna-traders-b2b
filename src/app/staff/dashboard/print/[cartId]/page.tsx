import { prisma } from '@/lib/db';
import PrintSlipClient from '@/components/PrintSlipClient';

export default async function PrintSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ cartId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { cartId } = await params;
  const { autoprint } = await searchParams;

  // Server-side fallback: fetch cart data for direct URL access / bookmarks
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      id: true,
      dispatchSlipNumber: true,
      customerName: true,
      notes: true,
      createdAt: true,
      warehouse: { select: { name: true } },
      staff: { select: { name: true } },
      warehouseId: true,
      items: {
        include: {
          sku: { select: { name: true, unit: true } },
        },
      },
    },
  });

  let serverPayload = null;

  if (cart) {
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
      staffName: cart.staff.name,
      items: enrichedItems,
      zoneGroups,
      qrPayload: JSON.stringify(enrichedItems.map(i => ({ sku: i.skuId, qty: i.qty }))),
    };
  }

  return (
    <PrintSlipClient
      cartId={cartId}
      autoprint={autoprint === 'true'}
      serverPayload={serverPayload}
    />
  );
}
