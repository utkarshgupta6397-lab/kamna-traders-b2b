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

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';
    const vendorDcrStatus = searchParams.get('vendorDcrStatus') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const isExport = searchParams.get('export') === 'true';
    
    const whereClause: any = { isDeleted: false };
    
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    
    if (vendorDcrStatus && vendorDcrStatus !== 'ALL') {
      whereClause.vendorDcrStatus = vendorDcrStatus;
    }

    if (q.trim().length >= 3) {
      whereClause.OR = [
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        {
          allocations: {
            some: {
              invoice: {
                OR: [
                  { invoiceNumber: { contains: q, mode: 'insensitive' } },
                  { customerName: { contains: q, mode: 'insensitive' } },
                ]
              }
            }
          }
        },
        {
          allocations: {
            some: {
              invoiceItem: {
                OR: [
                  { itemName: { contains: q, mode: 'insensitive' } },
                  { sku: { contains: q, mode: 'insensitive' } },
                ]
              }
            }
          }
        },
        {
          tag: {
            tag: { contains: q, mode: 'insensitive' }
          }
        }
      ];
    }

    const queryArgs: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        allocations: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                customerName: true,
                zohoInvoiceId: true,
                dcrStatus: true
              }
            },
            invoiceItem: {
              select: {
                itemName: true,
                sku: true
              }
            }
          },
          orderBy: { allocatedAt: 'desc' },
          take: 1
        },
        tag: true
      }
    };

    if (!isExport) {
      queryArgs.skip = (page - 1) * limit;
      queryArgs.take = limit;
    }

    const [serials, total] = await Promise.all([
      prisma.dcrSerial.findMany(queryArgs),
      isExport ? Promise.resolve(0) : prisma.dcrSerial.count({ where: whereClause })
    ]);

    const skuIdsToFetch = Array.from(new Set(serials.map((s: any) => s.skuId).filter(Boolean)));
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIdsToFetch as string[] } },
      select: { id: true, name: true }
    });
    const skuMap = new Map(skus.map((s: any) => [s.id, s.name]));

    const enrichedSerials = serials.map((s: any) => {
      let computedProduct = null;
      let computedSku = null;

      const alloc = s.allocations?.[0];
      if (alloc?.invoiceItem) {
        computedProduct = alloc.invoiceItem.itemName;
        computedSku = alloc.invoiceItem.sku;
      }

      if (!computedProduct && s.skuId && skuMap.has(s.skuId)) {
        computedProduct = skuMap.get(s.skuId);
        computedSku = s.skuId;
      }

      if (!computedProduct) {
        computedProduct = 'Unknown Product';
      }
      if (!computedSku) {
        computedSku = s.skuId || 'Unknown SKU';
      }

      return {
        ...s,
        computedProduct,
        computedSku
      };
    });

    if (isExport) {
      // Build CSV
      const rows = [];
      rows.push(['Serial Number', 'Product Name', 'SKU', 'Vendor', 'Vendor DCR', 'Status', 'Serial Tag', 'Invoice Number', 'Customer', 'Allocated Date', 'Issued Date', 'Age (Days)'].join(','));
      
      const now = new Date().getTime();
      enrichedSerials.forEach((s: any) => {
        const alloc = s.allocations?.[0];
        const ageDays = Math.floor((now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const row = [
          s.serialNumber,
          `"${s.computedProduct.replace(/"/g, '""')}"`,
          s.computedSku,
          s.vendorName ? `"${s.vendorName.replace(/"/g, '""')}"` : '',
          s.vendorDcrStatus,
          s.status,
          s.tag?.tag ? `"${s.tag.tag.replace(/"/g, '""')}"` : '',
          alloc?.invoice?.invoiceNumber || '',
          alloc?.invoice?.customerName ? `"${alloc.invoice.customerName.replace(/"/g, '""')}"` : '',
          alloc?.allocatedAt ? new Date(alloc.allocatedAt).toLocaleDateString('en-IN') : '',
          '', // Issued Date - not explicitly tracked in basic model unless through history or another field
          ageDays
        ];
        rows.push(row.join(','));
      });
      
      const csv = rows.join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="serial-registry-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      serials: enrichedSerials,
      total,
      page,
      limit
    });
  } catch (error: any) {
    console.error('[DCR Serial Registry GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serials' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { serials: requestedSerials = [], page = 1, limit = 50, status = '', vendorDcrStatus = '' } = body;

    if (!Array.isArray(requestedSerials) || requestedSerials.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty serials array' }, { status: 400 });
    }

    const whereClause: any = { 
      isDeleted: false,
      serialNumber: { in: requestedSerials }
    };
    
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    
    if (vendorDcrStatus && vendorDcrStatus !== 'ALL') {
      whereClause.vendorDcrStatus = vendorDcrStatus;
    }

    const queryArgs: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        allocations: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                customerName: true,
                zohoInvoiceId: true,
                dcrStatus: true
              }
            },
            invoiceItem: {
              select: {
                itemName: true,
                sku: true
              }
            }
          },
          orderBy: { allocatedAt: 'desc' },
          take: 1
        },
        tag: true
      }
    };

    const [serials, total] = await Promise.all([
      prisma.dcrSerial.findMany(queryArgs),
      prisma.dcrSerial.count({ where: whereClause })
    ]);

    const skuIdsToFetch = Array.from(new Set(serials.map((s: any) => s.skuId).filter(Boolean)));
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIdsToFetch as string[] } },
      select: { id: true, name: true }
    });
    const skuMap = new Map(skus.map((s: any) => [s.id, s.name]));

    const enrichedSerials = serials.map((s: any) => {
      let computedProduct = null;
      let computedSku = null;

      const alloc = s.allocations?.[0];
      if (alloc?.invoiceItem) {
        computedProduct = alloc.invoiceItem.itemName;
        computedSku = alloc.invoiceItem.sku;
      }

      if (!computedProduct && s.skuId && skuMap.has(s.skuId)) {
        computedProduct = skuMap.get(s.skuId);
        computedSku = s.skuId;
      }

      if (!computedProduct) {
        computedProduct = 'Unknown Product';
      }
      if (!computedSku) {
        computedSku = s.skuId || 'Unknown SKU';
      }

      return {
        ...s,
        computedProduct,
        computedSku
      };
    });

    // Find missing serials
    // Since we apply status filters, "missing" might mean "not in this status" or "doesn't exist".
    // We will query all existing serials among requested regardless of status to give accurate missing count?
    // Wait, the user wants "Missing Serials (N) with list of unmatched serial numbers."
    // If they filter by STATUS=AVAILABLE, they might want to know which requested aren't available.
    // So missing = requested - found (using the whereClause).
    // To do this efficiently, we query just the serial numbers matching the where clause.
    const allFound = await prisma.dcrSerial.findMany({
      where: whereClause,
      select: { serialNumber: true }
    });
    
    const foundSet = new Set(allFound.map(s => s.serialNumber));
    const missingSerials = requestedSerials.filter(s => !foundSet.has(s));

    return NextResponse.json({
      success: true,
      serials: enrichedSerials,
      total,
      page,
      limit,
      missingSerials
    });
  } catch (error: any) {
    console.error('[DCR Serial Registry POST] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serials' }, { status: 500 });
  }
}

