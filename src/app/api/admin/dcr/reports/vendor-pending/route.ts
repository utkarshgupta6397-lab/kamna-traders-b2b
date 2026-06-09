import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serials = await prisma.dcrSerial.findMany({
      where: {
        vendorDcrStatus: 'NOT_RECEIVED',
        isDeleted: false
      },
      select: {
        serialNumber: true,
        vendorName: true,
        billNumber: true,
        skuId: true,
        createdAt: true,
        tag: {
          select: {
            tag: true
          }
        },
        allocations: {
          include: {
            invoiceItem: {
              select: {
                itemName: true,
                sku: true
              }
            }
          },
          orderBy: { allocatedAt: 'desc' },
          take: 1
        }
      }
    });

    const skuIdsToFetch = Array.from(new Set(serials.map((s: any) => s.skuId).filter(Boolean))) as string[];
    
    // Fetch from Sku master
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIdsToFetch } },
      select: { id: true, name: true, zohoBooksId2: true }
    });
    const skuMap = new Map(skus.map((s: any) => [s.id, { name: s.name, skuCode: s.zohoBooksId2 || s.id }]));

    const missingMappingSerials: string[] = [];
    const now = new Date().getTime();

    const result = serials.map((s: any) => {
      let computedProduct = null;
      let computedSku = null;

      const alloc = s.allocations?.[0];
      if (alloc?.invoiceItem) {
        computedProduct = alloc.invoiceItem.itemName;
        computedSku = alloc.invoiceItem.sku;
      }

      if (!computedProduct && s.skuId && skuMap.has(s.skuId)) {
        computedProduct = skuMap.get(s.skuId)!.name;
        computedSku = skuMap.get(s.skuId)!.skuCode;
      }

      if (!computedProduct) {
        computedProduct = '⚠ Product Mapping Missing';
        missingMappingSerials.push(s.serialNumber);
      }

      if (!computedSku) {
        computedSku = s.skuId || 'Unknown SKU';
      }

      const daysPending = Math.floor((now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        serialNumber: s.serialNumber,
        vendorName: s.vendorName || 'Unknown Vendor',
        billNumber: s.billNumber || null,
        productName: computedProduct,
        skuCode: computedSku,
        tag: s.tag?.tag || 'Untagged',
        daysPending
      };
    });

    if (missingMappingSerials.length > 0) {
      console.warn('[Vendor DCR Pending Report API] CRITICAL DATA ISSUE: Missing product mappings for serials:', missingMappingSerials);
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Vendor DCR Pending Report API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
