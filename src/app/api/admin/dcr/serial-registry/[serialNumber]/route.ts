import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ serialNumber: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serialNumber } = await params;
    
    // Decode if needed (in case it's URL encoded)
    const decodedSerialNumber = decodeURIComponent(serialNumber);

    const serial = await prisma.dcrSerial.findFirst({
      where: { serialNumber: decodedSerialNumber, isDeleted: false },
      include: {
        allocations: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                zohoInvoiceId: true,
                customerName: true,
                customerId: true,
                invoiceDate: true,
                invoiceTotal: true,
                invoiceStatus: true,
              }
            },
            invoiceItem: {
              select: {
                itemName: true,
                sku: true,
                quantity: true,
              }
            }
          },
          orderBy: { allocatedAt: 'desc' }
        },
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!serial) {
      return NextResponse.json({ error: 'Serial number not found' }, { status: 404 });
    }

    // Attempt to determine 'Issued By' from history if status is ISSUED
    let issuedInfo = null;
    if (serial.status === 'ISSUED') {
      const issueEvent = serial.history.find((h: any) => h.eventType === 'STATUS_CHANGED' && h.eventDescription.includes('ISSUED'));
      if (issueEvent) {
        // Fetch user info for the userId
        const user = await prisma.user.findUnique({ where: { id: issueEvent.userId }, select: { name: true } });
        issuedInfo = {
          issuedBy: user ? user.name : issueEvent.userId,
          issuedAt: issueEvent.createdAt
        };
      }
    }

    // Fetch user names for the history timeline
    const userIds = Array.from(new Set(serial.history.map((h: any) => h.userId).filter(Boolean)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const historyWithUsers = serial.history.map((h: any) => ({
      ...h,
      userName: userMap.get(h.userId) || null
    }));

    // Compute Product / SKU
    let computedProduct = null;
    let computedSku = null;

    if (serial.allocations?.[0]?.invoiceItem) {
      computedProduct = serial.allocations[0].invoiceItem.itemName;
      computedSku = serial.allocations[0].invoiceItem.sku;
    }

    if (!computedProduct && serial.skuId) {
      const sku = await prisma.sku.findUnique({ where: { id: serial.skuId }, select: { name: true } });
      if (sku) {
        computedProduct = sku.name;
        computedSku = serial.skuId;
      }
    }

    if (!computedProduct) {
      computedProduct = 'Unknown Product';
    }
    if (!computedSku) {
      computedSku = serial.skuId || 'Unknown SKU';
    }

    // Format the payload for the frontend
    const payload = {
      serialNumber: serial.serialNumber,
      status: serial.status,
      vendorDcrStatus: serial.vendorDcrStatus,
      createdAt: serial.createdAt,
      computedProduct,
      computedSku,
      vendorInfo: {
        vendorName: serial.vendorName,
        billNumber: serial.billNumber,
        vendorDcrReceivedAt: serial.vendorDcrReceivedAt,
        vendorDcrReceivedBy: serial.vendorDcrReceivedBy
      },
      currentAllocation: serial.allocations[0] || null,
      allocations: serial.allocations,
      history: historyWithUsers,
      issuedInfo
    };

    return NextResponse.json({
      success: true,
      serial: payload
    });
  } catch (error: any) {
    console.error('[DCR Serial Registry Detail GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serial details' }, { status: 500 });
  }
}
