import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasDesktopPostDispatchReviewAccess } from '@/lib/post-dispatch-auth';
import { resolveZohoWarehouse, resolveZohoSku } from '@/lib/stock-deduction-service';
import { resolveProductImage } from '@/lib/utils';
import { getOrFetchInvoiceDetail } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

// In-flight deduplication to prevent duplicate concurrent Zoho API requests for the same invoice
const inFlightInvoiceFetches = new Map<string, Promise<any>>();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDesktopPostDispatchReviewAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { invoiceId } = await params;

  try {
    // Fetch invoice with lines and existing allocations
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        stockDeductionAllocations: true,
        workflows: {
          where: { workflowType: 'INVENTORY_DEDUCTION' },
          select: { id: true, status: true },
        },
      },
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // Automatic Zoho Books Fetch if DB lines are not yet available
    if (invoice.lines.length === 0) {
      const details = invoice.zohoDetailsJson as any;
      const rawLines = Array.isArray(details?.line_items) ? details.line_items : [];

      if (rawLines.length > 0) {
        await prisma.postDispatchInvoiceLine.createMany({
          data: rawLines.map((li: any) => ({
            invoiceId: invoice.id,
            zohoLineItemId: li.line_item_id ? String(li.line_item_id) : null,
            itemId: li.item_id ? String(li.item_id) : null,
            itemName: li.name || li.item_name || 'Item',
            description: li.description || null,
            quantity: Number(li.quantity || 0),
            rate: Number(li.rate || 0),
            amount: Number(li.item_total || li.amount || 0),
            hsnCode: li.hsn_or_sac ? String(li.hsn_or_sac) : null,
            taxPercent: Number(li.tax_percentage || 0),
          })),
        });

        // Re-fetch populated lines
        invoice.lines = await prisma.postDispatchInvoiceLine.findMany({
          where: { invoiceId },
          orderBy: { createdAt: 'asc' },
        });
      } else if (invoice.zohoInvoiceId) {
        // Automatically fetch detail & line items from Zoho Books with in-flight deduplication
        let fetchPromise = inFlightInvoiceFetches.get(invoice.id);
        if (!fetchPromise) {
          fetchPromise = getOrFetchInvoiceDetail({
            invoiceId: invoice.id,
            userId: session.userId,
            userName: (session as any).name,
          }).finally(() => {
            inFlightInvoiceFetches.delete(invoice.id);
          });
          inFlightInvoiceFetches.set(invoice.id, fetchPromise);
        }

        const syncResult = await fetchPromise;
        if (!syncResult.success && syncResult.error) {
          console.error('[StockDeduction ZohoAutoFetchError]', syncResult.error);
          return NextResponse.json(
            { error: `Failed to load invoice items from Zoho Books: ${syncResult.error}` },
            { status: 502 }
          );
        }

        // Re-fetch populated lines and refreshed invoice details
        invoice.lines = await prisma.postDispatchInvoiceLine.findMany({
          where: { invoiceId },
          orderBy: { createdAt: 'asc' },
        });

        const refreshedInv = await prisma.postDispatchInvoice.findUnique({
          where: { id: invoiceId },
          select: { zohoDetailsJson: true, total: true, customerName: true, zohoStatus: true, erpStatus: true },
        });
        if (refreshedInv) {
          invoice.zohoDetailsJson = refreshedInv.zohoDetailsJson;
          invoice.total = refreshedInv.total;
          invoice.customerName = refreshedInv.customerName;
          invoice.zohoStatus = refreshedInv.zohoStatus;
          invoice.erpStatus = refreshedInv.erpStatus;
        }
      }
    }

    // Ensure INVENTORY_DEDUCTION workflow exists (Step 12)
    if (invoice.workflows.length === 0) {
      await prisma.postDispatchWorkflow.upsert({
        where: { invoiceId_workflowType: { invoiceId, workflowType: 'INVENTORY_DEDUCTION' } },
        create: { invoiceId, workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        update: {},
      });
      // push to invoice.workflows so logic below knows
      invoice.workflows.push({ id: 'new', status: 'PENDING' } as any);
    }

    // Active warehouses
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true, isSystemWarehouse: false },
      select: { id: true, name: true, zohoLocationId: true },
      orderBy: { name: 'asc' },
    });

    // Parse Zoho details for location
    const zohoDetails = invoice.zohoDetailsJson as any;
    const zohoLocationId = zohoDetails?.location_id ? String(zohoDetails.location_id) : null;
    const zohoLocationName = zohoDetails?.location_name ? String(zohoDetails.location_name) : null;

    // Resolve expected warehouse from Zoho location
    const expectedWarehouse = zohoLocationId
      ? warehouses.find(w => w.zohoLocationId === zohoLocationId) || null
      : null;

    // Build allocation map for quick lookup
    const allocationMap = new Map<string, any>();
    for (const alloc of invoice.stockDeductionAllocations) {
      allocationMap.set(alloc.invoiceLineId, alloc);
    }

    // For each line: resolve SKU, get available stock
    const lineData = await Promise.all(
      invoice.lines.map(async (line) => {
        const existingAlloc = allocationMap.get(line.id) || null;

        // Resolve local SKU
        const resolvedSku = await resolveZohoSku(prisma, line.itemId);
        const localSkuId = existingAlloc?.expectedSkuId || resolvedSku?.id || null;

        // Get available stock per warehouse for this SKU
        let warehouseStocks: Array<{ warehouseId: string; warehouseName: string; availableQty: number; uom: string | null }> = [];
        if (localSkuId) {
          const invRecords = await prisma.warehouseInventory.findMany({
            where: { skuId: localSkuId },
            include: { warehouse: { select: { name: true, active: true } } },
          });
          warehouseStocks = invRecords
            .filter(r => r.warehouse.active)
            .map(r => ({
              warehouseId: r.warehouseId,
              warehouseName: r.warehouse.name,
              availableQty: parseFloat(r.qty.toString()),
              uom: resolvedSku?.unit || null,
            }));
        }

        // Find raw Zoho line for unit fallback
        const rawZohoLine = Array.isArray(zohoDetails?.line_items)
          ? zohoDetails.line_items.find((li: any) => String(li.line_item_id) === line.zohoLineItemId || String(li.item_id) === line.itemId)
          : null;
        const lineUom = rawZohoLine?.unit || resolvedSku?.unit || 'Units';

        // Resolve product image for SKU if mapped
        let image: string | null = null;
        if (localSkuId) {
          const variant = await prisma.productVariant.findFirst({
            where: { sku: localSkuId },
            include: {
              product: {
                select: {
                  thumbnailBase64: true,
                  parentProduct: { select: { thumbnailBase64: true } },
                },
              },
            },
          });
          if (variant?.product) {
            image = resolveProductImage(variant.product);
          }
        }

        return {
          line: {
            id: line.id,
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
            uom: lineUom,
            hsnCode: line.hsnCode,
          },
          image,
          resolvedSku: resolvedSku ? {
            id: resolvedSku.id,
            name: resolvedSku.name,
            unit: resolvedSku.unit,
            isDecimal: resolvedSku.isDecimal,
          } : null,
          mappingRequired: !resolvedSku,
          expectedWarehouse: expectedWarehouse ? {
            id: expectedWarehouse.id,
            name: expectedWarehouse.name,
            zohoLocationId: expectedWarehouse.zohoLocationId,
          } : null,
          zohoLocationId,
          zohoLocationName,
          warehouseMappingRequired: zohoLocationId ? !expectedWarehouse : false,
          warehouseStocks,
          allocation: existingAlloc ? {
            ...existingAlloc,
            expectedQty: parseFloat(existingAlloc.expectedQty.toString()),
          } : null,
        };
      })
    );

    const inventoryWorkflow = invoice.workflows.find(w => (w as any).workflowType === 'INVENTORY_DEDUCTION') || invoice.workflows[0] || null;

    return NextResponse.json({
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName || zohoDetails?.customer_name || 'Customer',
      total: invoice.total != null ? Number(invoice.total) : (zohoDetails?.total != null ? Number(zohoDetails.total) : 0),
      currencyCode: invoice.currencyCode || 'INR',
      zohoStatus: invoice.zohoStatus || zohoDetails?.status || 'Active',
      erpStatus: invoice.erpStatus || 'UNKNOWN',
      inventoryWorkflowStatus: inventoryWorkflow?.status || 'PENDING',
      lines: lineData,
      warehouses,
      expectedWarehouse: expectedWarehouse ? {
        id: expectedWarehouse.id,
        name: expectedWarehouse.name,
        zohoLocationId: expectedWarehouse.zohoLocationId,
      } : null,
      zohoLocationId,
      zohoLocationName,
    });
  } catch (err: any) {
    console.error('[StockDeduction GET]', err);
    return NextResponse.json({ error: 'Failed to load deduction data' }, { status: 500 });
  }
}
