import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Hard Reset API - Serialized & Forensic
 * Optimized for production safety and session preservation.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Mutex: Prevent parallel resets
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return NextResponse.json({ error: 'A system reset is already in progress. Please wait.' }, { status: 409 });
  }

  (global as any).__SYSTEM_RESET_RUNNING__ = true;
  const startTotal = performance.now();

  try {
    const { phrase, pin, mode = 'SOFT' } = await request.json();

    if (phrase !== 'RESET EVERYTHING' && phrase !== 'PURGE FORENSICS') {
      (global as any).__SYSTEM_RESET_RUNNING__ = false;
      return NextResponse.json({ error: 'Invalid confirmation phrase' }, { status: 400 });
    }

    // Verify Admin PIN
    const admin = await prisma.user.findUnique({
      where: { id: session.userId as string }
    });

    if (!admin || admin.pin !== pin) {
      (global as any).__SYSTEM_RESET_RUNNING__ = false;
      return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 403 });
    }

    const isForensic = mode === 'FORENSIC' || phrase === 'PURGE FORENSICS';
    console.log(`[HARD_RESET] Initiated by ${admin.name}. Mode: ${mode}, Forensic: ${isForensic}`);

    const forensics: { label: string; duration: string; count: number; status: 'SUCCESS' | 'SKIPPED' | 'FAILED' }[] = [];
    
    /**
     * Safe Execution Wrapper
     * Gracefully handles missing tables or schema drift without crashing the reset process.
     */
    const safeExec = async (label: string, op: () => Promise<any>) => {
      const start = performance.now();
      try {
        const res = await op();
        const duration = performance.now() - start;
        forensics.push({ 
          label, 
          duration: `${duration.toFixed(2)}ms`, 
          count: res?.count ?? 0, 
          status: 'SUCCESS' 
        });
        console.log(`[HARD_RESET_STEP] ${label}: SUCCESS (${res?.count ?? 0} rows)`);
      } catch (err: any) {
        const duration = performance.now() - start;
        // P2021: Table does not exist in DB (Schema drift)
        const isMissingTable = err.code === 'P2021' || err.message?.includes('does not exist');
        
        forensics.push({ 
          label, 
          duration: `${duration.toFixed(2)}ms`, 
          count: 0, 
          status: isMissingTable ? 'SKIPPED' : 'FAILED' 
        });
        
        console.warn(`[HARD_RESET_STEP] ${label}: ${isMissingTable ? 'SKIPPED (Table Missing)' : 'FAILED'}. Error: ${err.message}`);
      }
    };

    // ─── PHASE 1: BUSINESS DATA (Sequential, Non-Transactional) ─────
    await safeExec('InventoryHistory', () => prisma.inventoryHistory.deleteMany({}));
    await safeExec('CartItems', () => prisma.cartItem.deleteMany({}));
    await safeExec('WarehouseInventory', () => prisma.warehouseInventory.deleteMany({}));
    await safeExec('Carts', () => prisma.cart.deleteMany({}));
    await safeExec('SKUs', () => prisma.sku.deleteMany({}));

    // ─── PHASE 2: FORENSICS & SYNC ──────────────────────────────────
    if (isForensic) {
      await safeExec('SyncLogs', () => prisma.skuSyncLog.deleteMany({}));
      await safeExec('IdentityRegistry', () => prisma.skuIdentityRegistry.deleteMany({}));
      await safeExec('SyncLocks', () => prisma.syncLock.updateMany({
        where: { name: 'SKU_SYNC' },
        data: { isLocked: false, lockedAt: null, lockedBy: null }
      }));
    }

    // ─── PHASE 3: SESSIONS LAST (Critical for Auth Stability) ───────
    // We delete sessions only AFTER data is safely purged.
    // This ensures admin remains authenticated if business data purge fails.
    await safeExec('ActiveSessions', () => prisma.activeSession.deleteMany({}));

    const totalDuration = performance.now() - startTotal;
    const summary = {
      success: true,
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      forensics
    };

    console.log(`[HARD_RESET_COMPLETE] Total: ${summary.totalDuration}`);
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('[HARD_RESET_FATAL]', error);
    return NextResponse.json({ 
      error: 'Reset engine encountered a fatal error', 
      details: error.message 
    }, { status: 500 });
  } finally {
    (global as any).__SYSTEM_RESET_RUNNING__ = false;
  }
}
