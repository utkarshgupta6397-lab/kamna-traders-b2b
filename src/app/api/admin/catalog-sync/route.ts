import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { catalogSyncService } from '@/lib/services/catalog-sync.service';

// ─── GET: Health Dashboard ────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const health = await catalogSyncService.getHealth();
    return NextResponse.json({ success: true, health });
  } catch (error: any) {
    console.error('[CatalogSync] GET /api/admin/catalog-sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Action Dispatcher ──────────────────────────────────────────────────
//
// Body: { action: string, dryRun?: boolean, confirmed?: boolean }
//
// dryRun (default true)  → always returns preview, never writes
// dryRun: false + confirmed: true → executes

const READ_ONLY_ACTIONS = new Set(['analyze', 'validate', 'previewImport', 'previewVariantRepair', 'previewSkuRepair']);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, dryRun = true, confirmed = false } = body as {
      action?: string;
      dryRun?: boolean;
      confirmed?: boolean;
    };

    if (!action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 });
    }

    const userId = session.userId;

    // ── Read-only actions (always safe, ignore dryRun flag) ───────────────

    if (action === 'analyze') {
      const report = await catalogSyncService.analyzeCatalog();
      return NextResponse.json({ success: true, action, report });
    }

    if (action === 'validate') {
      const report = await catalogSyncService.validateCatalog();
      return NextResponse.json({ success: true, action, report });
    }

    if (action === 'previewImport') {
      const rows = await catalogSyncService.previewImport();
      return NextResponse.json({ success: true, action, rows });
    }

    if (action === 'previewVariantRepair') {
      const rows = await catalogSyncService.previewVariantRepair();
      return NextResponse.json({ success: true, action, rows });
    }

    if (action === 'previewSkuRepair') {
      const rows = await catalogSyncService.previewSkuRepair();
      return NextResponse.json({ success: true, action, rows });
    }

    // ── Mutating actions: dry-run returns preview; confirmed executes ──────

    if (action === 'importProducts') {
      if (dryRun !== false || confirmed !== true) {
        const rows = await catalogSyncService.previewImport();
        return NextResponse.json({ success: true, action, dryRun: true, rows });
      }
      const result = await catalogSyncService.importProducts(userId);
      return NextResponse.json({ success: true, action, result });
    }

    if (action === 'repairVariants') {
      if (dryRun !== false || confirmed !== true) {
        const rows = await catalogSyncService.previewVariantRepair();
        return NextResponse.json({ success: true, action, dryRun: true, rows });
      }
      const result = await catalogSyncService.repairVariants(userId);
      return NextResponse.json({ success: true, action, result });
    }

    if (action === 'repairSkuMappings') {
      // Phase 1: always read-only
      const rows = await catalogSyncService.previewSkuRepair();
      const result = await catalogSyncService.repairSkuMappings(userId);
      return NextResponse.json({ success: true, action, result, rows });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[CatalogSync] POST /api/admin/catalog-sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
