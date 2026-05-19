import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: cartId } = await params;

    const history = await prisma.cartHistory.findMany({
      where: { cartId },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('[CART_HISTORY_GET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: cartId } = await params;
    const body = await request.json();
    const { action, remarks } = body as { action: string, remarks?: string };

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Validate the cart exists
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    // Insert history record
    await prisma.cartHistory.create({
      data: {
        cartId,
        userId: session.userId as string,
        action: action.toUpperCase(),
        remarks: remarks || null
      }
    });


    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CART_HISTORY_POST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
