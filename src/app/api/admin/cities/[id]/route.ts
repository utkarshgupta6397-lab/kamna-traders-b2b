import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { name, active } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check for duplicates
    const existing = await prisma.city.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } }
    });

    if (existing && existing.id !== id) {
      return NextResponse.json({ message: 'City already exists.' }, { status: 409 });
    }

    const updated = await prisma.city.update({
      where: { id },
      data: {
        name: trimmedName,
        active,
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Error updating city:', err);
    return NextResponse.json({ error: 'Failed to update city' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const city = await prisma.city.findUnique({ where: { id } });
    if (!city) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 });
    }

    // Check if used in any solar orders (via remarks hack)
    const count = await prisma.solarOrder.count({
      where: { remarks: { contains: `City: ${city.name}` } }
    });

    if (count > 0) {
      return NextResponse.json({ error: 'Cannot delete City because it is used in orders. Please mark it as Inactive instead.' }, { status: 400 });
    }

    await prisma.city.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting city:', err);
    return NextResponse.json({ error: 'Failed to delete city' }, { status: 500 });
  }
}
