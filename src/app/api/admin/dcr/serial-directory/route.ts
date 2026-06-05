import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_serial_search && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 2) {
      return NextResponse.json({ serials: [] });
    }

    // Search by serial number (direct match or prefix)
    const bySerial = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { contains: q.toUpperCase() }
      },
      include: {
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, customerName: true, customerId: true, dcrStatus: true } },
            invoiceItem: { select: { id: true, itemName: true, sku: true } }
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      take: 50
    });

    // Also search by invoice number
    const byInvoice = await prisma.dcrSerial.findMany({
      where: {
        allocations: {
          some: {
            invoice: {
              invoiceNumber: { contains: q, mode: 'insensitive' }
            }
          }
        }
      },
      include: {
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, customerName: true, customerId: true, dcrStatus: true } },
            invoiceItem: { select: { id: true, itemName: true, sku: true } }
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      take: 50
    });

    // Also search by customer name
    const byCustomer = await prisma.dcrSerial.findMany({
      where: {
        allocations: {
          some: {
            invoice: {
              customerName: { contains: q, mode: 'insensitive' }
            }
          }
        }
      },
      include: {
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, customerName: true, customerId: true, dcrStatus: true } },
            invoiceItem: { select: { id: true, itemName: true, sku: true } }
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      take: 50
    });

    // Merge and deduplicate
    const allResults = [...bySerial, ...byInvoice, ...byCustomer];
    const seen = new Set<string>();
    const unique = allResults.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return NextResponse.json({ serials: unique.slice(0, 100) });
  } catch (error: any) {
    console.error('[Serial Search GET] Error:', error);
    return NextResponse.json({ error: 'Failed to search serials' }, { status: 500 });
  }
}
