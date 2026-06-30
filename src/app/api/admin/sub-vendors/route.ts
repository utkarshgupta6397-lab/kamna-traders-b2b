import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subVendors = await prisma.subVendor.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { solarOrders: true }
        }
      }
    });

    return NextResponse.json(subVendors);
  } catch (err: any) {
    console.error('Error fetching sub-vendors:', err);
    return NextResponse.json({ error: 'Failed to fetch sub-vendors' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, active } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await prisma.subVendor.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } }
    });

    if (existing) {
      return NextResponse.json({ message: 'Sub-Vendor already exists.' }, { status: 409 });
    }

    const newSubVendor = await prisma.subVendor.create({
      data: {
        name: trimmedName,
        active: active ?? true,
      }
    });

    return NextResponse.json(newSubVendor, { status: 201 });
  } catch (err: any) {
    console.error('Error creating sub-vendor:', err);
    return NextResponse.json({ message: 'Failed to create sub-vendor' }, { status: 500 });
  }
}
