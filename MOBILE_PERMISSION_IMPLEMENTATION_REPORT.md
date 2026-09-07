# KAMNA ERP — Dedicated Mobile Permissions Layer Implementation Report

## 1. Executive Summary

This report documents the design, architecture, and implementation of the **Dedicated Mobile Permissions Layer** for the KAMNA ERP mobile application (`/mobile/**`). 

Previously, mobile routes and UI cards partially relied on desktop general permissions (such as `accounts_customer_statement`, `dcr_management`, `dispatch_view`, or `canRunSkuSync`), while some mobile pages had no granular permission gating at all. 

Under the new architecture:
- Mobile access is governed by **9 dedicated, decoupled mobile permissions** in the `mobile_*` namespace.
- A strict **Parent-Child hierarchy** is enforced: a user must possess both the parent module permission AND the specific child permission to access a mobile feature (unless the user is an `ADMIN`).
- User-facing terminology for the operations module was updated from **"Operations"** to **"Stock Management"** across mobile.
- **Critical Architecture Exception**: The Accounts → **Hold Queue** flow (`/mobile/accounts/hold-queue`) is intentionally preserved under its existing desktop permission model (`dcr_hold_release`, `holdQueueReviewEnabled`, `holdQueueReviewLimit`, and `ADMIN`).
- All mobile route guards, component renders, and backing API routes have been updated to enforce this new security model without regressions to desktop workflows.

---

## 2. Dedicated Mobile Permission Schema & Hierarchy

### 2.1 Database & Prisma Schema (`prisma/schema.prisma`)
Nine new boolean fields were added to the `User` model, all defaulting to `false`:

```prisma
  // Mobile Dedicated Permissions Layer
  mobile_stock_management            Boolean   @default(false)
  mobile_stock_management_solar_panel Boolean   @default(false)
  mobile_stock_management_wire_cables Boolean   @default(false)
  mobile_stock_management_inverter    Boolean   @default(false)
  mobile_stock_management_solar_accessories Boolean @default(false)
  mobile_accounts                    Boolean   @default(false)
  mobile_accounts_customer_statement Boolean   @default(false)
  mobile_accounts_customer_dcr_lookup Boolean   @default(false)
  mobile_dispatch                    Boolean   @default(false)
```

The database was synchronized using `npx prisma db push`, and the Prisma Client was regenerated (`v6.19.3`).

### 2.2 Hierarchy & Section Structure (`src/lib/permissions.ts`)
The 9 keys are grouped into three distinct mobile modules via `MOBILE_PERMISSION_SECTIONS`:

| Module Section | Section Title | Parent Key (`mobile_*`) | Child Keys (`mobile_*`) | Notes / Exception |
| :--- | :--- | :--- | :--- | :--- |
| **`stock_management`** | Stock Management | `mobile_stock_management` | `mobile_stock_management_solar_panel`<br>`mobile_stock_management_wire_cables`<br>`mobile_stock_management_inverter`<br>`mobile_stock_management_solar_accessories` | Renamed from "Operations". Both parent and child required for child screens. |
| **`accounts`** | Accounts | `mobile_accounts` | `mobile_accounts_customer_statement`<br>`mobile_accounts_customer_dcr_lookup` | Gated by parent + child. **Hold Queue** is excluded from mobile child permissions. |
| **`dispatch`** | Dispatch | `mobile_dispatch` | *(None - module-level parent)* | Controls truck photo upload and today's upload log on mobile. |

### 2.3 General Permissions Matrix Decoupling
To ensure the desktop permissions matrix in `/admin/user-permissions` is not cluttered with mobile settings, `GENERAL_PERMISSIONS` in `src/lib/permissions.ts` filters out all keys in `mobilePermissionKeySet`.

---

## 3. Authorization Engine & Session Hydration

### 3.1 Central Helper: `src/lib/mobile-auth.ts`
All mobile authorization checks are centralized in `src/lib/mobile-auth.ts`:

- **`hasMobilePermission(session, permissionKey)`**:
  - Validates active session.
  - Returns `true` if `session.role === 'ADMIN'`.
  - Otherwise returns `!!session[permissionKey]`.
  - **Does not fall back to old desktop permissions.**

- **`hasMobileFeatureAccess(session, parentKey, childKey)`**:
  - Enforces parent-child hierarchy.
  - Returns `true` if `session.role === 'ADMIN'`.
  - Requires `session[parentKey] === true`. If `childKey` is supplied, also requires `session[childKey] === true`.
  - Prevents orphan child permission grants from functioning if the parent is disabled.

- **`mobileForbiddenResponse(featureName)`**:
  - Generates standardized 403 Forbidden payload `{ error: string, code: 'FORBIDDEN_MOBILE_FEATURE' }`.

### 3.2 Session Hydration (`src/lib/session.ts` & `src/lib/auth.ts`)
- `validateSession` in `src/lib/session.ts` explicitly selects all 9 `mobile_*` fields when loading the user session from PostgreSQL.
- For users with `role === 'ADMIN'`, the session builder sets all 9 `mobile_*` permissions to `true`.
- In `src/lib/auth.ts`, `getSession()` ensures admin sessions are populated with all mobile permission flags.
- In `src/app/api/admin/users/route.ts`, `findMany` selects all 9 mobile fields so the Admin permissions workspace has live visibility into mobile access flags.

---

## 4. Accounts → Hold Queue Architecture Exception

As mandated by system requirements, the **Accounts → Hold Queue** flow (`/mobile/accounts/hold-queue`) is intentionally **NOT** migrated to the mobile permissions layer:

1. **Desktop Governance Preserved**:
   - Access to `/mobile/accounts/hold-queue` strictly requires:
     `session.role === 'ADMIN' || session.dcr_hold_release`
   - Approval and release limits continue using:
     `session.holdQueueReviewEnabled` and `session.holdQueueReviewLimit`
   - Hold Queue backend APIs (`/api/admin/dcr/hold-queue/**`) remain untouched.

2. **Parent Lockout Prevention**:
   - The Accounts landing page (`/mobile/accounts/page.tsx`) permits access if:
     `hasMobilePermission(session, 'mobile_accounts') || session.role === 'ADMIN' || session.dcr_hold_release`
   - This ensures users who only have Hold Queue desktop review rights can reach their queue from the mobile Accounts navigation without requiring a mobile account parent grant or granting them unentitled access to Customer Statements or DCR Lookup.

---

## 5. UI Route & Component Guarding

### 5.1 Mobile Home Hub (`src/app/mobile/(app)/page.tsx`)
- Renamed "Operations" module tile to **"Stock Management"**.
- Module cards gated independently:
  - Stock Management: `hasMobilePermission(session, 'mobile_stock_management')`
  - Accounts: `hasMobilePermission(session, 'mobile_accounts') || session.role === 'ADMIN' || session.dcr_hold_release`
  - Dispatch: `hasMobilePermission(session, 'mobile_dispatch')`
- Empty state fallback displayed if a user has no mobile modules assigned.

### 5.2 Stock Management Screens (`/mobile/operations/**`)
- Hub Header renamed to **"Stock Management"**.
- Hub route check: redirects to `/mobile` if `!hasMobilePermission(session, 'mobile_stock_management')`.
- Child screen links and route guards:
  - **Solar Panel Stock**: `hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_panel')`
    - Removed desktop `canSync={!!session.canRunSkuSync}` prop leakage.
  - **Wire & Cables Stock**: `hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_wire_cables')`
  - **Inverter Stock**: `hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_inverter')`
  - **Solar Accessories**: `hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_accessories')`

### 5.3 Accounts Module Screens (`/mobile/accounts/**`)
- Hub route check: redirects to `/mobile` if not allowed.
- Card & route guards:
  - **Customer Statement**: `hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_statement')`
  - **Customer DCR Lookup**: `hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup')`
  - **Hold Queue**: `session.role === 'ADMIN' || session.dcr_hold_release`

### 5.4 Dispatch Screen (`/mobile/dispatch/**`)
- Route check: redirects to `/mobile` if `!hasMobilePermission(session, 'mobile_dispatch')`.

---

## 6. Backing API Routes Enforcement

| Endpoint | Method | Previous Authorization | New Authorization Model |
| :--- | :--- | :--- | :--- |
| `/api/mobile/dispatch/eligible-orders` | `GET` | Session check only | `hasMobilePermission(session, 'mobile_dispatch')` |
| `/api/mobile/dispatch/today` | `GET` | Session check only | `hasMobilePermission(session, 'mobile_dispatch')` |
| `/api/mobile/dispatch/[id]/truck-image` | `POST` | Session check only | `hasMobilePermission(session, 'mobile_dispatch')` |
| `/api/dispatch/truck-image/[uploadId]` | `GET` | Session check only | `session.role === 'ADMIN' \|\| session.mobile_dispatch \|\| session.dispatch_view \|\| session.dispatch_truck_details` |
| `/api/admin/customer-statement/search` | `GET` | `accounts_customer_statement` only | Desktop: `accounts_customer_statement`<br>Mobile: `mobile_accounts_customer_statement` |
| `/api/admin/customer-statement/statement` | `GET` | `accounts_customer_statement` only | Desktop: `accounts_customer_statement`<br>Mobile: `mobile_accounts_customer_statement` |
| `/api/admin/dcr/customer-lookup/search` | `GET` | `dcr_management` only | Desktop: `dcr_management`<br>Mobile: `mobile_accounts_customer_dcr_lookup` |
| `/api/admin/dcr/customer/[customerId]` | `GET` | `dcr_management` only | Desktop: `dcr_management`<br>Mobile: `mobile_accounts_customer_dcr_lookup` |
| `/api/admin/dcr/customer/.../invoice/...` | `GET` | `dcr_management` only | Desktop: `dcr_management`<br>Mobile: `mobile_accounts_customer_dcr_lookup` |
| `/api/admin/dcr/serial-registry` | `GET` | `dcr_management` only | Desktop: `dcr_management`<br>Mobile: `mobile_accounts_customer_dcr_lookup` |
| `/api/admin/dcr/hold-queue/**` | `ALL` | `dcr_hold_release` | **UNTOUCHED** (Desktop model preserved) |

---

## 7. Admin User Permissions Workspace (`src/app/admin/user-permissions/page.tsx`)

A new dedicated tab **"Mobile Permissions"** was added to the permissions workspace:
- **Tab Placement**: Positioned immediately next to Dispatch (`General Permissions` | `Catalog & Pricing` | `Dispatch` | `Mobile Permissions`).
- **Summary Cards**: Added `Mobile Enabled` metric displaying the total number of users with mobile access.
- **Informational Banner**: Prominently highlights the Hold Queue desktop model exception for Accounts.
- **Hierarchical Table Layout**:
  - Two-tier grouped headers corresponding to `MOBILE_PERMISSION_SECTIONS`.
  - Parent permissions are designated with `● Module Access` and primary branding.
  - Child permissions are designated with `↳` sub-branch indicators.
  - If a parent checkbox is disabled for a user, all child checkboxes under that module are automatically visually dimmed (`opacity-30`) and disabled (`disabled={!hasParent}`), with a tooltip explaining that parent access must be granted first.
  - Admin users are clearly rendered with `Full Access` badges across all columns.
  - Changes persist instantly via `PATCH /api/admin/users/[id]/permissions` and invalidate the user session cache.

---

## 8. Verification & Test Results

A dedicated automated test suite (`src/__tests__/mobile-permissions.test.ts`) was executed:
- **Registry & Key Consistency**: Verified all 9 keys across `ALL_PERMISSION_KEYS`, `PERMISSIONS`, `mobilePermissionKeySet`, and exclusion from `GENERAL_PERMISSIONS`.
- **Authorization Engine**: Verified `hasMobilePermission` and `hasMobileFeatureAccess` against null sessions, staff, and admin overrides.
- **Hierarchy Enforcement**: Verified that orphan child permissions cannot grant access when parent is false.
- **Personas A through I**: Verified complete permission matrix isolation for 9 distinct user profiles.
- **Hold Queue Integrity**: Verified that Hold Queue access respects `dcr_hold_release` independently from mobile accounts.
- **Desktop Non-Regression**: Verified `dispatch-permissions.test.ts` (45/45 passing).

```
==================================================
Automated Test Run: src/__tests__/mobile-permissions.test.ts
Total tests: 95 | Passed: 95 | Failed: 0
==================================================
Automated Test Run: src/__tests__/dispatch-permissions.test.ts
Total tests: 45 | Passed: 45 | Failed: 0
==================================================
```
