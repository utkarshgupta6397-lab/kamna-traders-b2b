import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Hard Reset API - Serialized & Forensic
 * Ensures total system purge without DB lock contention.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Mutex: Prevent parallel resets
  if ((global as any).__HARD_RESET_RUNNING__) {
    return NextResponse.json({ error: 'A hard reset is already in progress. Please wait.' }, { status: 409 });
  }

  (global as any).__HARD_RESET_RUNNING__ = true;
  const startTotal = performance.now();

  try {
    const { phrase, pin, mode = 'SOFT' } = await request.json();

    if (phrase !== 'RESET EVERYTHING' && phrase !== 'PURGE FORENSICS') {
      (global as any).__HARD_RESET_RUNNING__ = false;
      return NextResponse.json({ error: 'Invalid confirmation phrase' }, { status: 400 });
    }

    // Verify Admin PIN
    const admin = await prisma.user.findUnique({
      where: { id: session.userId as string }
    });

    if (!admin || admin.pin !== pin) {
      (global as any).__HARD_RESET_RUNNING__ = false;
      return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 403 });
    }

    const isForensic = mode === 'FORENSIC' || phrase === 'PURGE FORENSICS';
    console.log(`[HARD_RESET] Start by ${admin.name}. Mode: ${mode}, Forensic: ${isForensic}`);

    const forensics: any[] = [];
    
    // UTILITY: Serialized execution with timing
    const exec = async (label: string, op: () => Promise<any>) => {
      const start = performance.now();
      const res = await op();
      const duration = performance.now() - start;
      const data = { label, duration: `${duration.toFixed(2)}ms`, count: res?.count ?? 0 };
      forensics.push(data);
      console.log(`[HARD_RESET_STEP] ${label}: ${data.duration} (Rows: ${data.count})`);
      return res;
    };

    // ─── SEQUENCE 1: SESSIONS FIRST (Unlock User Contention) ──────
    await exec('ActiveSessions', () => prisma.activeSession.deleteMany({}));

    // ─── SEQUENCE 2: CORE DATA (Sequential, No Transaction) ───────
    await exec('InventoryHistory', () => prisma.inventoryHistory.deleteMany({}));
    await exec('CartItems', () => prisma.cartItem.deleteMany({}));
    await exec('WarehouseInventory', () => prisma.warehouseInventory.deleteMany({}));
    await exec('Carts', () => prisma.cart.deleteMany({}));
    await exec('SKUs', () => prisma.sku.deleteMany({}));

    // ─── SEQUENCE 3: FORENSICS (Conditional) ──────────────────────
    if (isForensic) {
      await exec('SyncLogs', () => prisma.skuSyncLog.deleteMany({}));
      await exec('IdentityRegistry', () => prisma.skuIdentityRegistry.deleteMany({}));
      await exec('SyncLocks', () => prisma.syncLock.updateMany({
        where: { name: 'SKU_SYNC' },
        data: { isLocked: false, lockedAt: null, lockedBy: null }
      }));
    }

    const totalDuration = performance.now() - startTotal;
    console.log(`[HARD_RESET_SUCCESS] Total duration: ${totalDuration.toFixed(2)}ms`);

    return NextResponse.json({
      success: true,
      message: isForensic ? 'Forensic reset complete' : 'Soft reset complete',
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      forensics
    });

  } catch (error: any) {
    console.error('[HARD_RESET_FATAL]', error);
    return NextResponse.json({ 
      error: 'Reset failed during execution', 
      details: error.message 
    }, { status: 500 });
  } finally {
    // 5. Release Mutex
    (global as any).__HARD_RESET_RUNNING__ = false;
  }
}
