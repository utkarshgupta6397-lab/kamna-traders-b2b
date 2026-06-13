import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    
    if (!q || q.trim() === '') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const query = q.trim();
    let customer = null;

    // 1. Exact Customer ID match
    if (/^\d{15,20}$/.test(query)) {
      customer = await prisma.customer.findFirst({ where: { id: query, status: 'active' } });
    }

    // 2. GST Match
    if (!customer) {
      customer = await prisma.customer.findFirst({ where: { gstNumber: query, status: 'active' } });
    }

    // 3. Name match (case-insensitive partial)
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { name: { contains: query, mode: 'insensitive' }, status: 'active' }
      });
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      customer
    });

  } catch (error: any) {
    console.error('[Customer Lookup Search] Error:', error);
    return NextResponse.json({ error: 'Failed to search customer' }, { status: 500 });
  }
}

