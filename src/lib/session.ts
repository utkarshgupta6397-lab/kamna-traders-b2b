import { prisma } from './db';
import { UAParser } from 'ua-parser-js';

export type DeviceType = 'desktop' | 'mobile';

/**
 * LIGHTWEIGHT IN-MEMORY SESSION CACHE (Shared across lib)
 */
const validationCache = new Map<string, { result: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearUserSessionCache(userId?: string) {
  if (userId) {
    for (const [token, cached] of validationCache.entries()) {
      if (cached.result?.userId === userId) {
        validationCache.delete(token);
      }
    }
  } else {
    validationCache.clear();
  }
}

/**
 * Detects device type from User Agent string.
 */
export function detectDeviceType(uaString: string | null): DeviceType {
  if (!uaString) return 'desktop';
  const parser = new UAParser(uaString);
  const device = parser.getDevice();
  const os = parser.getOS();

  if (device.type === 'mobile' || device.type === 'tablet') return 'mobile';
  const mobileOS = ['iOS', 'Android', 'Windows Phone', 'BlackBerry'];
  if (os.name && mobileOS.includes(os.name)) return 'mobile';

  return 'desktop';
}

/**
 * Registers a new session in the database.
 */
export async function registerSession(params: {
  userId: string;
  sessionToken: string;
  deviceType: DeviceType;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const { userId, sessionToken, deviceType, userAgent, ipAddress } = params;
  const start = performance.now();

  try {
    // 1. Invalidate existing sessions of the same type
    await prisma.activeSession.deleteMany({
      where: { userId, deviceType },
    });

    // 2. Create new session
    const session = await prisma.activeSession.create({
      data: {
        userId,
        sessionToken,
        deviceType,
        userAgent,
        ipAddress,
        lastSeenAt: new Date(),
      },
    });

    console.log(`[Perf] registerSession: ${(performance.now() - start).toFixed(2)}ms`);
    return session;
  } catch (err) {
    console.error('[Session] Registration failed:', err);
    throw err;
  }
}

/**
 * Validates session token existence.
 * OPTIMIZATION: Uses 5-min in-memory cache to skip DB roundtrips.
 */
export async function validateSession(sessionToken: string): Promise<{ 
  isValid: boolean; 
  userId?: string; 
  deviceType?: DeviceType;
  name?: string;
  permissions?: any; 
}> {
  // Bypass during system reset
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return { isValid: true };
  }

  // 1. Check Cache
  const cached = validationCache.get(sessionToken);
  if (cached && cached.expires > Date.now()) {
    // console.log(`[Perf] validateSession: CACHE HIT`);
    return cached.result;
  }

  const startTotal = performance.now();
  
  // 2. DB Lookup (Strict indexed lookup)
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { 
      userId: true, 
      deviceType: true,
      user: {
        select: {
          name: true,
          role: true,
          canManageCarts: true,
          canAdjustInventory: true,
          canRunSkuSync: true,
          canManageZoneMappings: true,
          canManageUnlimitedSkus: true,
          canManageTransfers: true,
          canDeleteTransfers: true,
          accountsAccess: true,
          accounts_customer_statement: true,
          accounts_invoice_processor: true,
          accounts_transactions: true,
          accounts_summary_view: true,
          accounts_reports_salesman: true,
          stock_alerts_manage: true,
          accounts_recovery_manage: true,
          release_statement_queue: true,
          dcr_management: true,
          dcr_serial_mapping_override: true,
          dcr_hold_release: true,
          solar_orders_view: true,
          solar_orders_create: true,
          solar_orders_approval: true,
          solar_orders_docs_progress: true,
          solar_orders_master_edit: true,
          workflow_edits: true,
          dispatch_view: true,
          communications_view: true,
          communications_templates: true,
          whatsapp_integration: true,
          holdQueueReviewEnabled: true,
          holdQueueReviewLimit: true,
          catalog_brands_create: true,
          catalog_brands_modify: true,
          catalog_brands_approve: true,
          catalog_manufacturers_create: true,
          catalog_manufacturers_modify: true,
          catalog_manufacturers_approve: true,
          catalog_categories_create: true,
          catalog_categories_modify: true,
          catalog_categories_approve: true,
          catalog_product_attributes_create: true,
          catalog_product_attributes_modify: true,
          catalog_product_attributes_archive: true,
          catalog_taxrates_create: true,
          catalog_taxrates_modify: true,
          catalog_taxrates_approve: true,
          catalog_units_create: true,
          catalog_units_modify: true,
          catalog_units_approve: true,
          catalog_hsncodes_create: true,
          catalog_hsncodes_modify: true,
          catalog_hsncodes_approve: true,
          catalog_products_create: true,
          catalog_products_modify: true,
          catalog_products_approve: true,
          catalog_products_archive: true,
          system_productMigration: true,
        }
      }
    }
  });

  if (session?.user) {
    const isUserAdmin = session.user.role === 'ADMIN';
    const userObj = session.user as any;

    if (isUserAdmin) {
      userObj.canManageCarts = true;
      userObj.canAdjustInventory = true;
      userObj.canRunSkuSync = true;
      userObj.canManageZoneMappings = true;
      userObj.canManageUnlimitedSkus = true;
      userObj.canManageTransfers = true;
      userObj.canDeleteTransfers = true;
      userObj.accounts_customer_statement = true;
      userObj.accounts_invoice_processor = true;
      userObj.accounts_transactions = true;
      userObj.accounts_summary_view = true;
      userObj.accounts_reports_salesman = true;
      userObj.stock_alerts_manage = true;
      userObj.accounts_recovery_manage = true;
      userObj.release_statement_queue = true;
      userObj.dcr_management = true;
      userObj.dcr_serial_mapping_override = true;
      userObj.dcr_hold_release = true;
      userObj.solar_orders_view = true;
      userObj.solar_orders_create = true;
      userObj.solar_orders_approval = true;
      userObj.solar_orders_docs_progress = true;
      userObj.solar_orders_master_edit = true;
      userObj.workflow_edits = true;
      userObj.dispatch_view = true;
      userObj.communications_view = true;
      userObj.communications_templates = true;
      userObj.whatsapp_integration = true;
      userObj.holdQueueReviewEnabled = true;
      userObj.holdQueueReviewLimit = null;
      userObj.catalog_products_create = true;
      userObj.catalog_products_modify = true;
      userObj.catalog_products_approve = true;
      userObj.catalog_products_archive = true;
      userObj.system_productMigration = true;
    }

    const masterPerms = [
      'catalog_brands_create', 'catalog_brands_modify', 'catalog_brands_approve',
      'catalog_manufacturers_create', 'catalog_manufacturers_modify', 'catalog_manufacturers_approve',
      'catalog_categories_create', 'catalog_categories_modify', 'catalog_categories_approve',
      'catalog_product_attributes_create', 'catalog_product_attributes_modify', 'catalog_product_attributes_archive',
      'catalog_taxrates_create', 'catalog_taxrates_modify', 'catalog_taxrates_approve',
      'catalog_units_create', 'catalog_units_modify', 'catalog_units_approve',
      'catalog_hsncodes_create', 'catalog_hsncodes_modify', 'catalog_hsncodes_approve',
      'catalog_products_create', 'catalog_products_modify', 'catalog_products_approve', 'catalog_products_archive',
    ];

    if (isUserAdmin) {
      for (const p of masterPerms) {
        userObj[p] = true;
      }
    } else {
      try {
        const fullUser = await prisma.user.findUnique({
          where: { id: session.userId },
        });
        if (fullUser) {
          for (const p of masterPerms) {
            userObj[p] = Boolean((fullUser as any)[p]);
          }
        }
      } catch (err) {
        for (const p of masterPerms) {
          userObj[p] = false;
        }
      }
    }
  }

  const result = session 
    ? { 
        isValid: true, 
        userId: session.userId, 
        deviceType: session.deviceType as DeviceType,
        name: session.user?.name,
        permissions: session.user 
      }
    : { isValid: false };

  // 3. Update Cache
  validationCache.set(sessionToken, {
    result,
    expires: Date.now() + CACHE_TTL
  });

  const totalDuration = performance.now() - startTotal;
  console.log(`[Perf] validateSession (DB): ${totalDuration.toFixed(2)}ms`);

  return result;
}

/**
 * Removes a specific session (Logout).
 */
export async function invalidateSession(sessionToken: string) {
  validationCache.delete(sessionToken);
  return await prisma.activeSession.delete({
    where: { sessionToken },
  }).catch(() => null); 
}

/**
 * Lightweight cleanup: Only deletes rows older than 7 days.
 */
export async function cleanupStaleSessions() {
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    await prisma.activeSession.deleteMany({
      where: { lastSeenAt: { lt: threshold } },
    });
  } catch (err) {
    console.error('[Session] Cleanup failed:', err);
  }
}

export async function updateSessionLastSeen(sessionToken: string) {
  try {
    await prisma.activeSession.update({
      where: { sessionToken },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error('[Session] Update lastSeenAt failed:', err);
  }
}
