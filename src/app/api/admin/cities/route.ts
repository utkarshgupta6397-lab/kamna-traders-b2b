import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cities = await prisma.city.findMany({
      orderBy: { name: 'asc' },
    });

    const citiesWithCount = await Promise.all(cities.map(async (city) => {
      const count = await prisma.solarOrder.count({
        where: { remarks: { contains: `City: ${city.name}` } }
      });
      return {
        ...city,
        _count: {
          solarOrders: count
        }
      };
    }));

    return NextResponse.json(citiesWithCount);
  } catch (err: any) {
    console.error('Error fetching cities:', err);
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
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

    const existing = await prisma.city.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } }
    });

    if (existing) {
      return NextResponse.json({ message: 'City already exists.' }, { status: 409 });
    }

    const newCity = await prisma.city.create({
      data: {
        name: trimmedName,
        active: active ?? true,
      }
    });

    return NextResponse.json(newCity, { status: 201 });
  } catch (err: any) {
    console.error('Error creating city:', err);
    return NextResponse.json({ message: 'Failed to create city' }, { status: 500 });
  }
}
