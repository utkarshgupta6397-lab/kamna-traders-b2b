import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phrase, pin } = await request.json();

    if (phrase !== 'RESET EVERYTHING') {
      return NextResponse.json({ error: 'Invalid confirmation phrase' }, { status: 400 });
    }

    // Verify Admin PIN
    const admin = await prisma.user.findUnique({
      where: { id: session.userId as string }
    });

    if (!admin || admin.pin !== pin) {
      return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 403 });
    }

    console.log(`[HARD_RESET] Started by admin ${admin.name} (${admin.id})`);

    // Use a transaction for the deletion sequence to handle FK constraints and atomicity
    const results = await prisma.$transaction(async (tx) => {
      // 1. Delete History
      const hist = await tx.inventoryHistory.deleteMany();
      
      // 2. Delete Cart Items
      const cartItems = await tx.cartItem.deleteMany();
      
      // 3. Delete Warehouse Inventory
      const inv = await tx.warehouseInventory.deleteMany();
      
      // 4. Delete Carts
      const carts = await tx.cart.deleteMany();
      
      // 5. Delete SKUs
      const skus = await tx.sku.deleteMany();
      
      // 6. Delete Brands
      const brands = await tx.brand.deleteMany();
      
      // 7. Delete Categories
      const cats = await tx.category.deleteMany();

      // 8. Delete SKU Sync Logs
      const logs = await tx.skuSyncLog.deleteMany();

      return {
        hist: hist.count,
        cartItems: cartItems.count,
        inv: inv.count,
        carts: carts.count,
        skus: skus.count,
        brands: brands.count,
        cats: cats.count,
        logs: logs.count
      };
    });

    console.log(`[HARD_RESET] Completed. Deleted:`, results);

    return NextResponse.json({
      success: true,
      message: 'System reset successfully',
      deleted: results
    });

  } catch (error: any) {
    console.error('[HARD_RESET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Reset failed' }, { status: 500 });
  }
}
