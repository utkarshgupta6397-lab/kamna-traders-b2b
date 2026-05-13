import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phrase, pin, mode = 'SOFT' } = await request.json();

    if (phrase !== 'RESET EVERYTHING' && phrase !== 'PURGE FORENSICS') {
      return NextResponse.json({ error: 'Invalid confirmation phrase' }, { status: 400 });
    }

    // Verify Admin PIN
    const admin = await prisma.user.findUnique({
      where: { id: session.userId as string }
    });

    if (!admin || admin.pin !== pin) {
      return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 403 });
    }

    const isForensic = mode === 'FORENSIC' || phrase === 'PURGE FORENSICS';
    console.log(`[PURGE_${mode}] Started by admin ${admin.name} (Forensic: ${isForensic})`);

    const results = await prisma.$transaction(async (tx) => {
      // 1. Core Data Deletion (Always in both modes)
      const hist = await tx.inventoryHistory.deleteMany();
      const cartItems = await tx.cartItem.deleteMany();
      const inv = await tx.warehouseInventory.deleteMany();
      const carts = await tx.cart.deleteMany();
      const skus = await tx.sku.deleteMany();

      let logsCount = 0;
      let identityCount = 0;

      if (isForensic) {
        // 2. Forensic/Memory Deletion (Sync History + Identity Registry)
        const logs = await tx.skuSyncLog.deleteMany();
        logsCount = logs.count;

        const identities = await tx.skuIdentityRegistry.deleteMany();
        identityCount = identities.count;

        // Reset Sync Lock
        await tx.syncLock.updateMany({
          where: { name: 'SKU_SYNC' },
          data: { isLocked: false, lockedAt: null, lockedBy: null }
        });
      }

      return {
        skus: skus.count,
        inventory: inv.count,
        history: hist.count,
        carts: carts.count,
        cartItems: cartItems.count,
        syncLogs: logsCount,
        identities: identityCount,
        mode: isForensic ? 'FORENSIC' : 'SOFT'
      };
    });

    console.log(`[PURGE_COMPLETE]`, results);

    return NextResponse.json({
      success: true,
      message: isForensic ? 'Forensic reset complete' : 'Soft reset complete',
      results
    });

  } catch (error: any) {
    console.error('[PURGE_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Reset failed' }, { status: 500 });
  }
}
