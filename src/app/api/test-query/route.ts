import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const prod = await prisma.product.findFirst({
    where: { name: { contains: 'Product 4000' } },
    include: { variants: true }
  });
  
  const sku = await prisma.sku.findFirst({
    where: { name: { contains: 'Product 4000' } }
  });

  return NextResponse.json({ prod, sku });
}
