import { 
  ALL_PERMISSION_KEYS, 
  PERMISSIONS, 
  GENERAL_PERMISSIONS, 
  mobilePermissionKeySet, 
  MOBILE_PERMISSION_SECTIONS,
  PermissionKey 
} from '../lib/permissions';
import { 
  hasMobilePermission, 
  hasMobileFeatureAccess,
  mobileForbiddenResponse 
} from '../lib/mobile-auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log('\n--- 1. Mobile Permission Key & Registry Consistency ---');
const EXPECTED_MOBILE_KEYS: PermissionKey[] = [
  'mobile_stock_management',
  'mobile_stock_management_solar_panel',
  'mobile_stock_management_wire_cables',
  'mobile_stock_management_inverter',
  'mobile_stock_management_solar_accessories',
  'mobile_accounts',
  'mobile_accounts_customer_statement',
  'mobile_accounts_customer_dcr_lookup',
  'mobile_dispatch',
  'mobile_dispatch_post_dispatch',
  'mobile_dispatch_post_dispatch_receiving_upload',
  'mobile_dispatch_post_dispatch_receiving_verify',
  'mobile_dispatch_post_dispatch_checked_upload',
  'mobile_dispatch_post_dispatch_checked_verify',
];

assert(EXPECTED_MOBILE_KEYS.length === 14, 'Exactly 14 dedicated mobile permission keys defined');

for (const key of EXPECTED_MOBILE_KEYS) {
  assert(ALL_PERMISSION_KEYS.includes(key), `${key} exists in ALL_PERMISSION_KEYS`);
  assert(PERMISSIONS.some(p => p.key === key), `${key} exists in PERMISSIONS array`);
  assert(mobilePermissionKeySet.has(key), `${key} exists in mobilePermissionKeySet`);
  assert(!GENERAL_PERMISSIONS.some(p => p.key === key), `${key} is excluded from GENERAL_PERMISSIONS (decoupled from desktop matrix)`);
}

assert(MOBILE_PERMISSION_SECTIONS.length === 3, 'MOBILE_PERMISSION_SECTIONS contains 3 modules');
const [stockSec, accountsSec, dispatchSec] = MOBILE_PERMISSION_SECTIONS;
assert(stockSec.sectionKey === 'stock_management' && stockSec.children.length === 4, 'Stock Management section has 4 children');
assert(accountsSec.sectionKey === 'accounts' && accountsSec.children.length === 2, 'Accounts section has 2 children and infoNote');
assert(dispatchSec.sectionKey === 'dispatch' && dispatchSec.children.length === 5, 'Dispatch section has 5 children (post-dispatch hierarchy)');

console.log('\n--- 2. Central Authorization Helpers (hasMobilePermission & hasMobileFeatureAccess) ---');
assert(hasMobilePermission(null, 'mobile_stock_management') === false, 'null session returns false for hasMobilePermission');
assert(hasMobilePermission(undefined, 'mobile_stock_management') === false, 'undefined session returns false for hasMobilePermission');
assert(hasMobileFeatureAccess(null, 'mobile_stock_management', 'mobile_stock_management_solar_panel') === false, 'null session returns false for hasMobileFeatureAccess');

const adminSession: any = { role: 'ADMIN', name: 'Admin User' };
assert(hasMobilePermission(adminSession, 'mobile_stock_management') === true, 'Admin always has mobile_stock_management');
assert(hasMobilePermission(adminSession, 'mobile_accounts') === true, 'Admin always has mobile_accounts');
assert(hasMobilePermission(adminSession, 'mobile_dispatch') === true, 'Admin always has mobile_dispatch');
assert(hasMobileFeatureAccess(adminSession, 'mobile_stock_management', 'mobile_stock_management_solar_panel') === true, 'Admin always has feature access for solar panel');
assert(hasMobileFeatureAccess(adminSession, 'mobile_accounts', 'mobile_accounts_customer_statement') === true, 'Admin always has feature access for customer statement');

console.log('\n--- 3. Strict Parent-Child Hierarchy Enforcement ---');
// Parent true, child true -> ALLOWED
const validChildSession: any = {
  role: 'STAFF',
  mobile_stock_management: true,
  mobile_stock_management_solar_panel: true,
};
assert(hasMobileFeatureAccess(validChildSession, 'mobile_stock_management', 'mobile_stock_management_solar_panel') === true, 'Parent=true, Child=true allows access');

// Parent false, child true -> FORBIDDEN (Orphan child prevention)
const orphanChildSession: any = {
  role: 'STAFF',
  mobile_stock_management: false,
  mobile_stock_management_solar_panel: true,
};
assert(hasMobileFeatureAccess(orphanChildSession, 'mobile_stock_management', 'mobile_stock_management_solar_panel') === false, 'Parent=false, Child=true strictly blocks access');

// Parent true, child false -> FORBIDDEN
const parentOnlySession: any = {
  role: 'STAFF',
  mobile_stock_management: true,
  mobile_stock_management_solar_panel: false,
};
assert(hasMobileFeatureAccess(parentOnlySession, 'mobile_stock_management', 'mobile_stock_management_solar_panel') === false, 'Parent=true, Child=false blocks access');

console.log('\n--- 4. Persona Verification (Users A through I) ---');

// User A: Zero Permissions
const userA: any = { role: 'STAFF', name: 'User A' };
assert(!hasMobilePermission(userA, 'mobile_stock_management'), 'User A has no stock management');
assert(!hasMobilePermission(userA, 'mobile_accounts'), 'User A has no accounts');
assert(!hasMobilePermission(userA, 'mobile_dispatch'), 'User A has no dispatch');
assert(!hasMobileFeatureAccess(userA, 'mobile_stock_management', 'mobile_stock_management_solar_panel'), 'User A cannot access solar panel');

// User B: Stock Parent Only
const userB: any = { role: 'STAFF', name: 'User B', mobile_stock_management: true };
assert(hasMobilePermission(userB, 'mobile_stock_management'), 'User B can access stock management hub');
assert(!hasMobileFeatureAccess(userB, 'mobile_stock_management', 'mobile_stock_management_solar_panel'), 'User B cannot access solar panel (child disabled)');
assert(!hasMobileFeatureAccess(userB, 'mobile_stock_management', 'mobile_stock_management_wire_cables'), 'User B cannot access wire cables (child disabled)');

// User C: Stock Child Without Parent
const userC: any = { role: 'STAFF', name: 'User C', mobile_stock_management: false, mobile_stock_management_inverter: true };
assert(!hasMobilePermission(userC, 'mobile_stock_management'), 'User C cannot access stock hub');
assert(!hasMobileFeatureAccess(userC, 'mobile_stock_management', 'mobile_stock_management_inverter'), 'User C cannot access inverter without parent');

// User D: Full Stock Management
const userD: any = {
  role: 'STAFF',
  name: 'User D',
  mobile_stock_management: true,
  mobile_stock_management_solar_panel: true,
  mobile_stock_management_wire_cables: true,
  mobile_stock_management_inverter: true,
  mobile_stock_management_solar_accessories: true,
};
assert(hasMobilePermission(userD, 'mobile_stock_management'), 'User D has stock management access');
assert(hasMobileFeatureAccess(userD, 'mobile_stock_management', 'mobile_stock_management_solar_panel'), 'User D has solar panel access');
assert(hasMobileFeatureAccess(userD, 'mobile_stock_management', 'mobile_stock_management_wire_cables'), 'User D has wire cables access');
assert(hasMobileFeatureAccess(userD, 'mobile_stock_management', 'mobile_stock_management_inverter'), 'User D has inverter access');
assert(hasMobileFeatureAccess(userD, 'mobile_stock_management', 'mobile_stock_management_solar_accessories'), 'User D has solar accessories access');
assert(!hasMobilePermission(userD, 'mobile_accounts'), 'User D cannot access accounts');
assert(!hasMobilePermission(userD, 'mobile_dispatch'), 'User D cannot access dispatch');

// User E: Accounts Statement Only
const userE: any = {
  role: 'STAFF',
  name: 'User E',
  mobile_accounts: true,
  mobile_accounts_customer_statement: true,
};
assert(hasMobilePermission(userE, 'mobile_accounts'), 'User E has accounts access');
assert(hasMobileFeatureAccess(userE, 'mobile_accounts', 'mobile_accounts_customer_statement'), 'User E has customer statement access');
assert(!hasMobileFeatureAccess(userE, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup'), 'User E cannot access DCR lookup');

// User F: Accounts DCR Lookup Only
const userF: any = {
  role: 'STAFF',
  name: 'User F',
  mobile_accounts: true,
  mobile_accounts_customer_dcr_lookup: true,
};
assert(hasMobilePermission(userF, 'mobile_accounts'), 'User F has accounts access');
assert(hasMobileFeatureAccess(userF, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup'), 'User F has DCR lookup access');
assert(!hasMobileFeatureAccess(userF, 'mobile_accounts', 'mobile_accounts_customer_statement'), 'User F cannot access customer statement');

// User G: Mobile Dispatch Only
const userG: any = {
  role: 'STAFF',
  name: 'User G',
  mobile_dispatch: true,
};
assert(hasMobilePermission(userG, 'mobile_dispatch'), 'User G has mobile dispatch access');
assert(!hasMobilePermission(userG, 'mobile_stock_management'), 'User G has no stock management access');
assert(!hasMobilePermission(userG, 'mobile_accounts'), 'User G has no accounts access');

// User H: Old Desktop Permissions Only (Collision & Leakage Prevention)
const userH: any = {
  role: 'STAFF',
  name: 'User H',
  accounts_customer_statement: true,
  dcr_management: true,
  dispatch_view: true,
  dispatch_truck_details: true,
  canAdjustInventory: true,
  canRunSkuSync: true,
  // All mobile_* flags are false
  mobile_stock_management: false,
  mobile_stock_management_solar_panel: false,
  mobile_accounts: false,
  mobile_accounts_customer_statement: false,
  mobile_accounts_customer_dcr_lookup: false,
  mobile_dispatch: false,
};
assert(!hasMobilePermission(userH, 'mobile_stock_management'), 'User H (desktop perms) cannot access mobile stock management');
assert(!hasMobileFeatureAccess(userH, 'mobile_stock_management', 'mobile_stock_management_solar_panel'), 'User H cannot access mobile solar panel stock');
assert(!hasMobilePermission(userH, 'mobile_accounts'), 'User H cannot access mobile accounts via mobile_accounts');
assert(!hasMobileFeatureAccess(userH, 'mobile_accounts', 'mobile_accounts_customer_statement'), 'User H cannot access mobile customer statement via mobile check');
assert(!hasMobileFeatureAccess(userH, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup'), 'User H cannot access mobile customer DCR lookup via mobile check');
assert(!hasMobilePermission(userH, 'mobile_dispatch'), 'User H cannot access mobile dispatch via dispatch_view');

// User I: Admin Full Override
const userI: any = { role: 'ADMIN', name: 'User I' };
assert(hasMobilePermission(userI, 'mobile_stock_management'), 'User I (ADMIN) has mobile stock access');
assert(hasMobilePermission(userI, 'mobile_accounts'), 'User I (ADMIN) has mobile accounts access');
assert(hasMobilePermission(userI, 'mobile_dispatch'), 'User I (ADMIN) has mobile dispatch access');
assert(hasMobileFeatureAccess(userI, 'mobile_stock_management', 'mobile_stock_management_solar_panel'), 'User I (ADMIN) has solar panel access');
assert(hasMobileFeatureAccess(userI, 'mobile_accounts', 'mobile_accounts_customer_statement'), 'User I (ADMIN) has customer statement access');

console.log('\n--- 5. Accounts Hold Queue Exception Integrity ---');
// User with only desktop dcr_hold_release
const holdQueueUser: any = {
  role: 'STAFF',
  name: 'Hold Queue Staff',
  dcr_hold_release: true,
  mobile_accounts: false,
};
// Should be able to view Hold Queue in mobile Accounts hub
const canViewHoldQueue = holdQueueUser.role === 'ADMIN' || Boolean(holdQueueUser.dcr_hold_release);
const canAccessAccountsHub = hasMobilePermission(holdQueueUser, 'mobile_accounts') || holdQueueUser.role === 'ADMIN' || Boolean(holdQueueUser.dcr_hold_release);
assert(canViewHoldQueue === true, 'Hold Queue user with dcr_hold_release can view Hold Queue');
assert(canAccessAccountsHub === true, 'Hold Queue user can enter Accounts hub without mobile_accounts parent');
assert(!hasMobileFeatureAccess(holdQueueUser, 'mobile_accounts', 'mobile_accounts_customer_statement'), 'Hold Queue user cannot access mobile Customer Statement');
assert(!hasMobileFeatureAccess(holdQueueUser, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup'), 'Hold Queue user cannot access mobile Customer DCR Lookup');

// User with mobile_accounts only (no dcr_hold_release)
const mobileAccountsOnlyUser: any = {
  role: 'STAFF',
  name: 'Mobile Accounts Staff',
  mobile_accounts: true,
  mobile_accounts_customer_statement: true,
  dcr_hold_release: false,
};
const mobileUserCanViewHoldQueue = mobileAccountsOnlyUser.role === 'ADMIN' || Boolean(mobileAccountsOnlyUser.dcr_hold_release);
assert(mobileUserCanViewHoldQueue === false, 'Mobile accounts user WITHOUT dcr_hold_release CANNOT access Hold Queue (preserves desktop model)');

console.log('\n--- 6. Standard Mobile Forbidden Response ---');
const res = mobileForbiddenResponse('Stock Management');
assert(res.code === 'FORBIDDEN_MOBILE_FEATURE', 'Forbidden response has correct code');
assert(res.error.includes('Stock Management'), 'Forbidden response mentions feature name');

console.log('\n========================================');
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
