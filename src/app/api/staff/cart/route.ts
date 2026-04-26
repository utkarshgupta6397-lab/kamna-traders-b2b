import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

type CartItemInput = {
  skuId: string;
  qty: number;
};

export async function POST(request: Request) {
  try {
    const { warehouseId, customerName, notes, staffId, items } = await request.json();

    if (!warehouseId || !customerName || !staffId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a Cart ID like KT1001
    const count = await prisma.cart.count();
    const cartId = `KT${1000 + count + 1}`;

    const cart = await prisma.cart.create({
      data: {
        id: cartId,
        warehouseId,
        customerName,
        notes,
        staffId,
        items: {
          create: (items as CartItemInput[]).map((i) => ({
            skuId: i.skuId,
            qty: i.qty,
          }))
        }
      }
    });

    return NextResponse.json({ success: true, cartId: cart.id }, { status: 200 });
  } catch (error) {
    console.error('Error creating cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
