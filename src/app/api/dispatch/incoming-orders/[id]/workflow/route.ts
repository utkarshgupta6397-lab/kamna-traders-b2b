import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

function resolveWarehouse(details: any): { id: string | null; name: string | null } {
  if (!details || typeof details !== 'object') return { id: null, name: null };
  
  const locId = details.location_id ? String(details.location_id) : (details.warehouse_id ? String(details.warehouse_id) : null);
  
  if (details.location_name && typeof details.location_name === 'string' && details.location_name.trim()) {
    return { id: locId, name: details.location_name.trim() };
  }
  if (details.warehouse_name && typeof details.warehouse_name === 'string' && details.warehouse_name.trim()) {
    return { id: locId, name: details.warehouse_name.trim() };
  }
  if (details.branch_name && typeof details.branch_name === 'string' && details.branch_name.trim()) {
    return { id: locId, name: details.branch_name.trim() };
  }
  if (details.location_id && Array.isArray(details.locations)) {
    const loc = details.locations.find((l: any) => String(l.location_id) === String(details.location_id));
    if (loc?.location_name) return { id: locId, name: loc.location_name.trim() };
  }
  if (Array.isArray(details.line_items) && details.line_items.length > 0) {
    for (const item of details.line_items) {
      const itemId = item.location_id || item.warehouse_id;
      const itemName = item.location_name || item.warehouse_name;
      if (itemName && typeof itemName === 'string' && itemName.trim()) {
        return { id: itemId ? String(itemId) : locId, name: itemName.trim() };
      }
    }
  }

  return { id: locId, name: null };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const order = await prisma.dispatchIncomingOrder.findUnique({
    where: { id },
    include: {
      preDispatchWorkflow: true,
      truckUpload: true,
    }
  });

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  let workflow = order.preDispatchWorkflow;
  
  // Auto-initialize workflow if not exists
  if (!workflow) {
    workflow = await prisma.preDispatchWorkflow.create({
      data: {
        dispatchOrderId: order.id,
        salesorderId: order.zohoSalesorderId
      }
    });
  }

  // Ensure truckPhotoUrl is populated from truckUpload if not already set in workflow
  const truckPhotoUrl = workflow.truckPhotoUrl || (order.truckUpload ? `/api/dispatch/truck-image/${order.truckUpload.id}` : null);
  const effectiveWorkflow = {
    ...workflow,
    truckPhotoUrl,
  };

  const details = (order.zohoDetailsJson || {}) as Record<string, any>;
  const resolvedWarehouse = resolveWarehouse(details);
  const billingAddressId = details.billing_address_id ? String(details.billing_address_id) : null;
  const shippingAddressId = details.shipping_address_id ? String(details.shipping_address_id) : null;
  const isAddressMismatch = Boolean(billingAddressId && shippingAddressId && billingAddressId !== shippingAddressId);

  return NextResponse.json({
    success: true,
    data: {
      order,
      workflow: effectiveWorkflow,
      resolvedWarehouse,
      billingAddressId,
      shippingAddressId,
      isAddressMismatch,
    }
  });
}
