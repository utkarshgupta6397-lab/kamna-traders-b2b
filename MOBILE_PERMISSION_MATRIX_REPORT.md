# Mobile UI Permission Matrix — Current State Audit

## 1. Executive Summary

This report documents the **current, actual implementation** of the permission matrix and authorization enforcement architecture for the **Mobile UI** of KAMNA ERP (`/mobile/**`).

Every finding, matrix entry, and code citation in this report is drawn directly from the codebase without inferring intended architecture.

### Key Takeaways from the Current Audit:
1. **Module Visibility vs Route Protection Disconnect**:
   - The Mobile Home screen (`/mobile`) conditionally renders **nothing** based on permissions. All three module cards (**Operations**, **Accounts**, **Dispatch**) are hardcoded and visible to **any authenticated user**, regardless of role or assigned permissions.
   - For **Operations** and **Dispatch**, neither the landing page nor any sub-page/drill-down checks permissions to block access. Any logged-in user can visit `/mobile/operations/*` and `/mobile/dispatch`.
   - For **Accounts**, the landing page (`/mobile/accounts`) conditionally renders the "Customer Statement" card (requiring `ADMIN` or `accounts_customer_statement`), but still displays "Customer DCR Lookup" and "Hold Queue" unconditionally to all users.
2. **Dispatch Decoupling between Mobile and Desktop**:
   - The desktop dispatch workflow enforces granular 5-step permissions (`dispatch_view`, `dispatch_rate_review`, `dispatch_payment_verification`, `dispatch_truck_details`, `dispatch_ready_for_invoice`, `dispatch_invoice_confirmation`) via `canCompleteDispatchStep` in `src/lib/dispatch-auth.ts`.
   - However, the **Mobile Dispatch flow** (`/mobile/dispatch`) is solely dedicated to **Truck Photo Capture & Upload**. It does **not** check `dispatch_view` or `dispatch_truck_details` either on the page (`/mobile/dispatch/page.tsx`), in the client component (`MobileDispatchClient.tsx`), or in the APIs (`/api/mobile/dispatch/eligible-orders`, `/api/mobile/dispatch/today`, `/api/mobile/dispatch/[id]/truck-image`). Any user with an active session can view orders and upload truck photos.
3. **Accounts Module Discrepancies**:
   - `/mobile/accounts/customer-statement`: Protected at route level (`ADMIN` or `accounts_customer_statement`) and server API level (`/api/admin/customer-statement/statement`).
   - `/mobile/accounts/customer-dcr-lookup`: Route-level check allows access if user has `ADMIN` OR `dcr_management` OR `accounts_customer_statement`. However, the underlying search and summary APIs (`/api/admin/dcr/customer-lookup/search`, `/api/admin/dcr/customer/[customerId]`, `/api/admin/dcr/serial-registry`) strictly require `ADMIN` or `dcr_management`. A user with only `accounts_customer_statement` can open the page, but all searches fail with 401 Unauthorized.
   - `/mobile/accounts/hold-queue`: Protected at route level (`ADMIN` or `dcr_hold_release`) and server API level. In addition, individual customer review and release is governed by `holdQueueReviewEnabled` and numeric threshold `holdQueueReviewLimit`.
4. **Operations Module**:
   - All four stock views (**Solar Panel Stock**, **Wire & Cables Stock**, **Inverter Stock**, **Solar Accessories**) have **no route-level permission checks**. Any authenticated user can view inventory, export Excel raw data, and generate PDF screenshots.
   - `canRunSkuSync` is passed as a prop (`canSync`) to `MobileSolarPanelStockClient`, but is **unused in the component UI**.
5. **Admin Access Model**:
   - Users with `role === 'ADMIN'` receive a comprehensive blanket override: upon session validation (`src/lib/auth.ts`), all permissions in the session payload are forcefully set to `true`, and `holdQueueReviewLimit` is set to `null` (unlimited).

---

## 2. Permission Architecture

### A. Where Permissions Are Defined
Permissions are defined in `src/lib/permissions.ts`:
- **Type**: `PermissionKey` (union of 61 permission string literals).
- **Metadata Array**: `PERMISSIONS: PermissionDefinition[]` (containing `key`, `label`, `description`).
- **Dispatch Step Mapping**: `DISPATCH_STEP_PERMISSION_MAP: Record<string, PermissionKey>` maps workflow steps (`rate-review`, `payment-verification`, `truck-details`, `ready-for-invoice`, `invoice-confirmation`) to permission keys.
- **Dispatch Groups**: `DISPATCH_PERMISSION_GROUPS` groups permissions into `pre_dispatch`, `workflow_control`, and `post_dispatch`.
- **All Keys List**: `ALL_PERMISSION_KEYS: PermissionKey[]`.

### B. Storage & Database Schema
Permissions are stored directly as boolean and nullable float columns on the `User` table in PostgreSQL (`prisma/schema.prisma` lines 20–91):
- General permissions: `canManageCarts`, `canAdjustInventory`, `canRunSkuSync`, `canManageZoneMappings`, `canManageUnlimitedSkus`, `canManageTransfers`, `canDeleteTransfers`, `accountsAccess`, `accounts_customer_statement`, `accounts_invoice_processor`, `accounts_transactions`, `accounts_summary_view`, `accounts_reports_salesman`, `stock_alerts_manage`, `accounts_recovery_manage`, `release_statement_queue`, `dcr_management`, `dcr_serial_mapping_override`, `dcr_hold_release`, etc.
- Hold Queue review permissions: `holdQueueReviewEnabled` (`Boolean`), `holdQueueReviewLimit` (`Float?`).
- Dispatch permissions: `dispatch_view`, `dispatch_rate_review`, `dispatch_payment_verification`, `dispatch_truck_details`, `dispatch_ready_for_invoice`, `dispatch_invoice_confirmation`, `dispatch_workflow_override`, `dispatch_inventory_deduction`, `dispatch_receiving_upload`, `dispatch_checked_by`.

### C. How Users Receive Permissions
- Admin manages permissions in the Admin Workspace at `/admin/user-permissions`.
- Toggling a permission makes a `PATCH` request to `/api/admin/users/[id]/permissions` with `{ key, value }`.
- The server writes the boolean flag to the database and calls `clearUserSessionCache(id)` in `src/lib/session.ts` to invalidate in-memory cached sessions immediately.

### D. How Logged-in User Permissions Are Loaded
1. **Authentication**: User logs in with `mobile` (10 digits) and `pin` (6 digits) at `/mobile/login` via `/api/auth/login`.
2. **Session Creation**: `createSession` (`src/lib/auth.ts`) generates a `sessionToken`, registers it in `ActiveSession` table with `deviceType` (`'mobile'`), and encrypts a JWT into an HTTP-only cookie named `session`.
3. **Session Retrieval**: `getSession()` (`src/lib/auth.ts`) decrypts the JWT cookie, extracts `sessionToken`, and delegates to `validateSession(sessionToken)` in `src/lib/session.ts` (cached in-memory for 5 minutes).
4. **Database Extraction**: `validateSession()` performs a Prisma query selecting all individual boolean columns from the `User` model.
5. **Admin Override Ingestion**: In `src/lib/auth.ts` (lines 88–153), if `merged.role === 'ADMIN'`, every single permission key is set to `true`, and `holdQueueReviewLimit` is set to `null`.

### E. How Permissions Are Exposed to React / Mobile UI
- In Server Components (`page.tsx`), permissions are obtained via `const session = await getSession()`.
- In Client Components, permissions are passed down as props (e.g. `hasTemplatePermission`, `canSync`) or fetched dynamically through dedicated API responses (e.g. `userPermissions` in `/api/admin/dcr/hold-queue`).
- There is **no client-side global React Context** (such as a `PermissionsContext` or `usePermissions` hook) in the mobile tree.

### F. Enforcement Mechanisms Summary
- **Route / Layout Level**: `src/app/mobile/(app)/layout.tsx` enforces authentication (`if (!session) redirect('/mobile/login')`). Individual pages selectively enforce permissions using `redirect(...)`.
- **API Level**: Server routes independently call `getSession()` and check specific boolean flags, returning `401 Unauthorized` or `403 Forbidden`.

---

## 3. Mobile Route Inventory

| Route | Responsible Page / Component | Directly Navigable? | Nav Visibility Condition | Discovered Permission Checks | Enforcing File & Lines |
|---|---|---|---|---|---|
| `/mobile` | `src/app/mobile/(app)/page.tsx` | Yes | Always (Authenticated) | None (Session check only for user name) | `src/app/mobile/(app)/page.tsx` #L5 |
| `/mobile/login` | `src/app/mobile/login/page.tsx` | Yes | Unauthenticated | None (Public login form) | `src/app/mobile/login/page.tsx` |
| `/mobile/operations` | `src/app/mobile/(app)/operations/page.tsx` | Yes | Unconditional card on `/mobile` | None | `src/app/mobile/(app)/operations/page.tsx` #L6 |
| `/mobile/operations/solar-panel-stock` | `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx` | Yes | Unconditional link on `/mobile/operations` | Page: None. Prop: `canSync={!!session.canRunSkuSync}` (unused in UI) | `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx` #L52 |
| `/mobile/operations/wire-cable-stock` | `src/app/mobile/(app)/operations/wire-cable-stock/page.tsx` | Yes | Unconditional link on `/mobile/operations` | None | `src/app/mobile/(app)/operations/wire-cable-stock/page.tsx` #L12 |
| `/mobile/operations/inverter-stock` | `src/app/mobile/(app)/operations/inverter-stock/page.tsx` | Yes | Unconditional link on `/mobile/operations` | None | `src/app/mobile/(app)/operations/inverter-stock/page.tsx` #L12 |
| `/mobile/operations/solar-accessories-stock` | `src/app/mobile/(app)/operations/solar-accessories-stock/page.tsx` | Yes | Unconditional link on `/mobile/operations` | None | `src/app/mobile/(app)/operations/solar-accessories-stock/page.tsx` #L12 |
| `/mobile/accounts` | `src/app/mobile/(app)/accounts/page.tsx` | Yes | Unconditional card on `/mobile` | None for landing page. Sub-card conditional: `session.role === 'ADMIN' \|\| session.accounts_customer_statement` | `src/app/mobile/(app)/accounts/page.tsx` #L8 |
| `/mobile/accounts/customer-statement` | `src/app/mobile/(app)/accounts/customer-statement/page.tsx` | Yes | Conditional on `/mobile/accounts` (`accounts_customer_statement`) | `session.role === 'ADMIN' \|\| session.accounts_customer_statement` | `src/app/mobile/(app)/accounts/customer-statement/page.tsx` #L17-19 |
| `/mobile/accounts/customer-dcr-lookup` | `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx` | Yes | Unconditional on `/mobile/accounts` | `session.role === 'ADMIN' \|\| session.dcr_management \|\| session.accounts_customer_statement` | `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx` #L18-20 |
| `/mobile/accounts/hold-queue` | `src/app/mobile/(app)/accounts/hold-queue/page.tsx` | Yes | Unconditional on `/mobile/accounts` | `session.role === 'ADMIN' \|\| session.dcr_hold_release` | `src/app/mobile/(app)/accounts/hold-queue/page.tsx` #L10-12 |
| `/mobile/dispatch` | `src/app/mobile/(app)/dispatch/page.tsx` | Yes | Unconditional card on `/mobile` | None (Session check only; no `dispatch_view` check) | `src/app/mobile/(app)/dispatch/page.tsx` #L6-10 |

---

## 4. Module Permission Matrix

| Module | Home Screen Card | Card Visibility Permission | Route-Level Protection | Destination Page Protected? | Backend API Protected? | Actual Access State |
|---|---|---|---|---|---|---|
| **Operations** | Operations Card (`/mobile/operations`) | **NO PERMISSION CHECK** (Always visible) | **NO PERMISSION CHECK** | **NO PERMISSION CHECK** (Open to all staff) | Read directly via Prisma in Server Components | **UNRESTRICTED** to any logged-in user |
| **Accounts** | Accounts Card (`/mobile/accounts`) | **NO PERMISSION CHECK** (Always visible) | **NO PERMISSION CHECK** | Partial (Statement & Hold Queue guarded; DCR Lookup guarded with permission mismatch) | Guarded per endpoint | **MIXED** (Landing open; sub-features selectively guarded) |
| **Dispatch** | Dispatch Card (`/mobile/dispatch`) | **NO PERMISSION CHECK** (Always visible) | **NO PERMISSION CHECK** (`dispatch_view` not checked) | **NO PERMISSION CHECK** | **NO PERMISSION CHECK** (`dispatch_truck_details` / `dispatch_view` not checked on mobile APIs) | **UNRESTRICTED** to any logged-in user |

---

## 5. Detailed Feature Permission Matrix

### 5.1 Operations Module Flows

| Flow / Feature | Route | Element / Action | Required Permission | Check Location | UI Behavior Without Perm | Server Enforcement | Notes |
|---|---|---|---|---|---|---|---|
| Module Landing | `/mobile/operations` | View module list | NO PERMISSION CHECK | None | Rendered | None | Open to any authenticated user |
| Solar Panel Stock | `/mobile/operations/solar-panel-stock` | View Stock Table | NO PERMISSION CHECK | None | Rendered | Server Component Prisma query | Open to any user |
| Solar Panel Stock | `/mobile/operations/solar-panel-stock` | Drilldown Sheet | NO PERMISSION CHECK | None | Rendered | In-memory client state | Open to any user |
| Solar Panel Stock | `/mobile/operations/solar-panel-stock` | Raw Data (Excel) | NO PERMISSION CHECK | None | Button active | Client-side xlsx export | Open to any user |
| Solar Panel Stock | `/mobile/operations/solar-panel-stock` | Screenshot (PDF) | NO PERMISSION CHECK | None | Button active | Client-side jsPDF export | Open to any user |
| Wire & Cables Stock | `/mobile/operations/wire-cable-stock` | View Stock Table | NO PERMISSION CHECK | None | Rendered | Server Component Prisma query | Open to any user |
| Wire & Cables Stock | `/mobile/operations/wire-cable-stock` | Drilldown Sheet | NO PERMISSION CHECK | None | Rendered | In-memory client state | Open to any user |
| Inverter Stock | `/mobile/operations/inverter-stock` | View Stock Table | NO PERMISSION CHECK | None | Rendered | Server Component Prisma query | Open to any user |
| Inverter Stock | `/mobile/operations/inverter-stock` | Drilldown Sheet | NO PERMISSION CHECK | None | Rendered | In-memory client state | Open to any user |
| Inverter Stock | `/mobile/operations/inverter-stock` | Raw Data (Excel) | NO PERMISSION CHECK | None | Button active | Client-side xlsx export | Open to any user |
| Inverter Stock | `/mobile/operations/inverter-stock` | Screenshot (PDF) | NO PERMISSION CHECK | None | Button active | Client-side jsPDF export | Open to any user |
| Solar Accessories | `/mobile/operations/solar-accessories-stock` | View Stock Table | NO PERMISSION CHECK | None | Rendered | Server Component Prisma query | Open to any user |
| Solar Accessories | `/mobile/operations/solar-accessories-stock` | Raw Data (Excel) | NO PERMISSION CHECK | None | Button active | Client-side xlsx export | Open to any user |

### 5.2 Accounts Module Flows

| Flow / Feature | Route | Element / Action | Required Permission | Check Location | UI Behavior Without Perm | Server Enforcement | Notes |
|---|---|---|---|---|---|---|---|
| Accounts Hub | `/mobile/accounts` | View Module Menu | NO PERMISSION CHECK | None | Rendered | None | Open to any authenticated user |
| Customer Statement Link | `/mobile/accounts` | Card link to Statement | `ADMIN` or `accounts_customer_statement` | `src/app/mobile/(app)/accounts/page.tsx:8` | Card hidden | N/A | UI visibility gate |
| Customer Statement Page | `/mobile/accounts/customer-statement` | Route access | `ADMIN` or `accounts_customer_statement` | `src/app/mobile/(app)/accounts/customer-statement/page.tsx:17` | Redirects to `/mobile/accounts` | Route-level redirect | Secure route gate |
| Customer Statement | `/mobile/accounts/customer-statement` | Search Customer | `ADMIN` or `accounts_customer_statement` | `src/app/api/admin/customer-statement/search/route.ts:51` | API returns 401 | Server 401 | Protected |
| Customer Statement | `/mobile/accounts/customer-statement` | Fetch Statement Ledger | `ADMIN` or `accounts_customer_statement` | `src/app/api/admin/customer-statement/statement/route.ts:9` | API returns 401 | Server 401 | Protected |
| Customer Statement | `/mobile/accounts/customer-statement` | Expand Invoice Line Items | NO PERMISSION CHECK | `src/app/api/admin/customer-statement/invoice/[id]/route.ts` | Details fetch succeeds | **NO ENFORCEMENT FOUND** | Endpoint does not check session or permission |
| Customer Statement | `/mobile/accounts/customer-statement` | Expand Bill Line Items | NO PERMISSION CHECK | `src/app/api/admin/customer-statement/bill/[id]/route.ts` | Details fetch succeeds | **NO ENFORCEMENT FOUND** | Endpoint does not check session or permission |
| Customer Statement | `/mobile/accounts/customer-statement` | Download Statement PDF | NO PERMISSION CHECK (Inherits page access) | `MobileCustomerStatementClient.tsx:319` | Enabled | Client-side jsPDF rendering | Governed by page access |
| Customer DCR Lookup Link | `/mobile/accounts` | Card link to DCR Lookup | NO PERMISSION CHECK | None | Always displayed | None | Card is unconditionally visible |
| Customer DCR Lookup Page | `/mobile/accounts/customer-dcr-lookup` | Route access | `ADMIN` or `dcr_management` or `accounts_customer_statement` | `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx:18` | Redirects to `/mobile/accounts` | Route-level redirect | **PERMISSION INCONSISTENCY**: Allows `accounts_customer_statement` |
| Customer DCR Lookup | `/mobile/accounts/customer-dcr-lookup` | Search Customer | `ADMIN` or `dcr_management` | `src/app/api/admin/dcr/customer-lookup/search/route.ts:8` | Toast error "Unable to load customers" (401) | Server 401 | Users with only `accounts_customer_statement` fail here |
| Customer DCR Lookup | `/mobile/accounts/customer-dcr-lookup` | Fetch DCR Summary | `ADMIN` or `dcr_management` | `src/app/api/admin/dcr/customer/[customerId]/route.ts:77` | Toast error "Unable to load customer DCR information" (401) | Server 401 | Users with only `accounts_customer_statement` fail here |
| Customer DCR Lookup | `/mobile/accounts/customer-dcr-lookup` | Fetch Invoice Serials | `ADMIN` or `dcr_management` | `src/app/api/admin/dcr/serial-registry/route.ts:10` | Inline loading error (401) | Server 401 | Protected |
| Hold Queue Link | `/mobile/accounts` | Card link to Hold Queue | NO PERMISSION CHECK | None | Always displayed | None | Card is unconditionally visible |
| Hold Queue Page | `/mobile/accounts/hold-queue` | Route access | `ADMIN` or `dcr_hold_release` | `src/app/mobile/(app)/accounts/hold-queue/page.tsx:10` | Redirects to `/mobile/accounts?error=unauthorized` | Route-level redirect | Protected |
| Hold Queue | `/mobile/accounts/hold-queue` | Fetch Hold Queue & KPIs | `ADMIN` or `dcr_hold_release` | `src/app/api/admin/dcr/hold-queue/route.ts:9` | Toast error (403) | Server 403 | Protected |
| Hold Queue | `/mobile/accounts/hold-queue` | Refresh Balance (Single) | `ADMIN` or `dcr_hold_release` | `src/app/api/admin/dcr/hold-queue/refresh/route.ts:11` | Toast error (403) | Server 403 | Protected |
| Hold Queue | `/mobile/accounts/hold-queue` | Refresh All Balances | `ADMIN` or `dcr_hold_release` | `src/app/api/admin/dcr/hold-queue/refresh/route.ts:11` | Toast error (403) | Server 403 | Protected |
| Hold Queue | `/mobile/accounts/hold-queue` | Review Customer Details | `holdQueueReviewEnabled` AND (`holdQueueReviewLimit === null` OR `outstandingBalance <= holdQueueReviewLimit`) | `MobileHoldQueueClient.tsx:575` | Button disabled with Lock icon + warning | UI Only (Detail view drawer) | Guarded in UI |
| Hold Queue | `/mobile/accounts/hold-queue` | Release DCR Serials | `dcr_hold_release` AND `holdQueueReviewEnabled` AND (`holdQueueReviewLimit === null` OR `outstandingBalance <= holdQueueReviewLimit`) | `src/app/api/admin/dcr/hold-queue/release/route.ts:11, 44, 48` | Release button disabled or API rejects with 403 | Server 403 | Dual Enforcement (UI + Server) |

### 5.3 Dispatch Module Flows

| Flow / Feature | Route | Element / Action | Required Permission | Check Location | UI Behavior Without Perm | Server Enforcement | Notes |
|---|---|---|---|---|---|---|---|
| Dispatch Hub | `/mobile/dispatch` | Route access | NO PERMISSION CHECK | `src/app/mobile/(app)/dispatch/page.tsx:6` | Session check only | **NO ENFORCEMENT FOUND** | Does NOT check `dispatch_view` |
| Dispatch | `/mobile/dispatch` | Fetch Active Orders (> ₹50k) | NO PERMISSION CHECK | `src/app/api/mobile/dispatch/eligible-orders/route.ts:38` | Session check only | **NO ENFORCEMENT FOUND** | Does NOT check `dispatch_view` or `dispatch_truck_details` |
| Dispatch | `/mobile/dispatch` | Fetch Today's Uploads | NO PERMISSION CHECK | `src/app/api/mobile/dispatch/today/route.ts:25` | Session check only | **NO ENFORCEMENT FOUND** | Does NOT check `dispatch_view` or `dispatch_truck_details` |
| Dispatch | `/mobile/dispatch` | Upload Truck Photo | NO PERMISSION CHECK | `src/app/api/mobile/dispatch/[id]/truck-image/route.ts:18` | Session check only | **NO ENFORCEMENT FOUND** | Does NOT check `dispatch_truck_details` |
| Dispatch | `/mobile/dispatch` | View Uploaded Image | NO PERMISSION CHECK | `src/app/api/dispatch/truck-image/[uploadId]/route.ts:14` | Session check only | **NO ENFORCEMENT FOUND** | Does NOT check `dispatch_view` |
| Pre-Dispatch Workflow (Rate Review, Payment, Invoice, etc.) | N/A | Full Multi-Step Workflow | `dispatch_rate_review`, `dispatch_payment_verification`, etc. | Desktop only | N/A | Desktop API endpoints check `canCompleteDispatchStep` | **NOT IMPLEMENTED ON MOBILE** |

---

## 6. Action-Level Permission Matrix

| Action | Component | Permission Key | UI Behavior Without Permission | API Behavior Without Permission | Status |
|---|---|---|---|---|---|
| **Export Raw Stock Data** | `MobileSolarPanelStockClient.tsx` / `MobileInverterStockClient.tsx` / `MobileSolarAccessoriesStockClient.tsx` | NO PERMISSION CHECK | Enabled | Client-side export | Open |
| **Generate Stock PDF** | `MobileSolarPanelStockClient.tsx` / `MobileInverterStockClient.tsx` | NO PERMISSION CHECK | Enabled | Client-side jsPDF export | Open |
| **Search Customer (Statement)** | `MobileCustomerStatementClient.tsx` | `accounts_customer_statement` | Input functional, API fails | 401 Unauthorized | UI + SERVER |
| **View Customer Statement Ledger** | `MobileCustomerStatementClient.tsx` | `accounts_customer_statement` | UI shows error toast | 401 Unauthorized | UI + SERVER |
| **Download Customer Statement PDF** | `MobileCustomerStatementClient.tsx` | NO PERMISSION CHECK (Inherited from page) | Enabled | Client-side jsPDF export | UI ONLY |
| **Expand Statement Invoice Details** | `MobileCustomerStatementClient.tsx` | NO PERMISSION CHECK | Enabled | 200 OK (Unauthenticated/Unchecked) | NO ENFORCEMENT FOUND |
| **Search Customer (DCR)** | `MobileCustomerLookupClient.tsx` | `dcr_management` | Input functional, search fails | 401 Unauthorized | SERVER ONLY (UI allows `accounts_customer_statement`) |
| **View Customer DCR Summary** | `MobileCustomerLookupClient.tsx` | `dcr_management` | Loading fails with toast error | 401 Unauthorized | SERVER ONLY |
| **Expand DCR Invoice Serials** | `MobileCustomerLookupClient.tsx` | `dcr_management` | Accordion error state | 401 Unauthorized | SERVER ONLY |
| **Refresh Hold Customer Balance** | `MobileHoldQueueClient.tsx` | `dcr_hold_release` | Enabled | 403 Forbidden | SERVER ONLY |
| **Refresh All Hold Balances** | `MobileHoldQueueClient.tsx` | `dcr_hold_release` | Enabled | 403 Forbidden | SERVER ONLY |
| **Review Customer on Hold** | `MobileHoldQueueClient.tsx` | `holdQueueReviewEnabled` + `holdQueueReviewLimit` | Button disabled, Lock icon shown | N/A (Client-side view toggle) | UI ONLY |
| **Release DCR Serials** | `MobileHoldQueueClient.tsx` | `dcr_hold_release` + `holdQueueReviewEnabled` + `holdQueueReviewLimit` | Button hidden or disabled | 403 Forbidden | UI + SERVER |
| **Capture & Upload Truck Photo** | `MobileDispatchClient.tsx` | NO PERMISSION CHECK | Camera button active | 200 OK (Upload succeeds) | NO ENFORCEMENT FOUND |

---

## 7. API / Server Enforcement Matrix

| API Route | HTTP Method | Client Caller | Permission Enforced | Enforcement Mechanism | Classification |
|---|---|---|---|---|---|
| `/api/mobile/dispatch/eligible-orders` | `GET` | `MobileDispatchClient.tsx:117` | None (Session only) | `if (!session) return 401` | **NO ENFORCEMENT FOUND** |
| `/api/mobile/dispatch/today` | `GET` | `MobileDispatchClient.tsx:118` | None (Session only) | `if (!session) return 401` | **NO ENFORCEMENT FOUND** |
| `/api/mobile/dispatch/[id]/truck-image` | `POST` | `MobileDispatchClient.tsx:301` | None (Session only) | `if (!session) return 401` | **NO ENFORCEMENT FOUND** |
| `/api/dispatch/truck-image/[uploadId]` | `GET` | `MobileDispatchClient.tsx` / `today` | None (Session only) | `if (!session) return 401` | **NO ENFORCEMENT FOUND** |
| `/api/admin/customer-statement/search` | `GET` | `MobileCustomerStatementClient.tsx:105` | `ADMIN` or `accounts_customer_statement` | Inline check in route handler | **UI + SERVER** |
| `/api/admin/customer-statement/statement` | `GET` | `MobileCustomerStatementClient.tsx:173` | `ADMIN` or `accounts_customer_statement` | Inline check in route handler | **UI + SERVER** |
| `/api/admin/customer-statement/invoice/[id]` | `GET` | `MobileCustomerStatementClient.tsx:306` | None | No session or permission check | **NO ENFORCEMENT FOUND** |
| `/api/admin/customer-statement/bill/[id]` | `GET` | `MobileCustomerStatementClient.tsx:306` | None | No session or permission check | **NO ENFORCEMENT FOUND** |
| `/api/admin/customer-statement/customer` | `GET` | Optional sync | `ADMIN` or `accounts_customer_statement` or `dcr_management` | Inline check in route handler | **SERVER/API ONLY** |
| `/api/admin/customer-statement/quick` | `GET` | Optional lookup | `ADMIN` or `accounts_customer_statement` or `dcr_management` | Inline check in route handler | **SERVER/API ONLY** |
| `/api/admin/dcr/customer-lookup/search` | `GET` | `MobileCustomerLookupClient.tsx:167` | `ADMIN` or `dcr_management` | Inline check in route handler | **SERVER/API ONLY** |
| `/api/admin/dcr/customer/[customerId]` | `GET` | `MobileCustomerLookupClient.tsx:142` | `ADMIN` or `dcr_management` | Inline check in route handler | **SERVER/API ONLY** |
| `/api/admin/dcr/serial-registry` | `GET`, `POST` | `MobileCustomerLookupClient.tsx:76` | `ADMIN` or `dcr_management` | Inline check in route handler | **SERVER/API ONLY** |
| `/api/admin/dcr/hold-queue` | `GET` | `MobileHoldQueueClient.tsx:130` | `ADMIN` or `dcr_hold_release` | Inline check in route handler | **UI + SERVER** |
| `/api/admin/dcr/hold-queue/refresh` | `POST` | `MobileHoldQueueClient.tsx:161, 184` | `ADMIN` or `dcr_hold_release` | Inline check in route handler | **UI + SERVER** |
| `/api/admin/dcr/hold-queue/release` | `PATCH` | `MobileHoldQueueClient.tsx:211, 227` | `ADMIN` or `dcr_hold_release` + `holdQueueReviewEnabled` + limit check | Inline check in route handler | **UI + SERVER** |

---

## 8. Permission Definition Inventory

The following permissions are defined in `src/lib/permissions.ts` and exist on the `User` schema in PostgreSQL. Their mobile relevance and actual enforcement state are detailed below:

| Permission Key | Display Label | Description | Relevant Mobile Module | Enforced in Mobile UI? | Enforced on Mobile Server API? | Notes |
|---|---|---|---|---|---|---|
| `accounts_customer_statement` | Customer Statement | Ability to view and print customer account statements | Accounts (`/mobile/accounts/customer-statement`) | Yes (`page.tsx:17`) | Yes (`/api/admin/customer-statement/statement:9`) | Fully enforced |
| `dcr_management` | DCR Management | Ability to manage DCR invoice processing workflow | Accounts (`/mobile/accounts/customer-dcr-lookup`) | Yes (`page.tsx:18`) | Yes (`/api/admin/dcr/customer/[customerId]:77`) | Fully enforced |
| `dcr_hold_release` | Hold Queue | Ability to manage hold queue and release DCRs | Accounts (`/mobile/accounts/hold-queue`) | Yes (`page.tsx:10`) | Yes (`/api/admin/dcr/hold-queue/route.ts:9`) | Fully enforced |
| `holdQueueReviewEnabled` | Hold Queue Review Enabled | Enables reviewing customer hold cards | Accounts (`/mobile/accounts/hold-queue`) | Yes (`MobileHoldQueueClient.tsx:575`) | Yes (`/api/admin/dcr/hold-queue/release/route.ts:44`) | Granular action permission |
| `holdQueueReviewLimit` | Hold Queue Review Limit | Maximum outstanding balance user can review | Accounts (`/mobile/accounts/hold-queue`) | Yes (`MobileHoldQueueClient.tsx:577`) | Yes (`/api/admin/dcr/hold-queue/release/route.ts:48`) | Granular threshold permission |
| `dispatch_view` | Dispatch | Controls whether the Dispatch module is visible/accessible | Dispatch (`/mobile/dispatch`) | **NO** | **NO** | **Dead permission on Mobile**; enforced on Desktop |
| `dispatch_truck_details` | Truck Details | Ability to complete Truck Details in Pre-Dispatch | Dispatch (`/mobile/dispatch`) | **NO** | **NO** | **Bypassed on Mobile**; enforced on Desktop |
| `dispatch_rate_review` | Rate Review | Ability to complete Rate Review in Pre-Dispatch | Dispatch | N/A | N/A | Not implemented on Mobile |
| `dispatch_payment_verification` | Payment Verification | Ability to complete Payment Verification in Pre-Dispatch | Dispatch | N/A | N/A | Not implemented on Mobile |
| `dispatch_ready_for_invoice` | Ready for Invoice | Ability to complete Ready for Invoice in Pre-Dispatch | Dispatch | N/A | N/A | Not implemented on Mobile |
| `dispatch_invoice_confirmation` | Invoice Confirmation | Ability to complete Invoice Confirmation in Pre-Dispatch | Dispatch | N/A | N/A | Not implemented on Mobile |
| `dispatch_workflow_override` | Workflow Override / Reopen | Ability to reopen or override completed Dispatch steps | Dispatch | N/A | N/A | Not implemented on Mobile |
| `dispatch_inventory_deduction` | Inventory Deduction | Ability to perform Post-Dispatch inventory deduction | Dispatch | N/A | N/A | Disabled / Coming Soon |
| `dispatch_receiving_upload` | Receiving Upload | Ability to upload Post-Dispatch receiving documents | Dispatch | N/A | N/A | Disabled / Coming Soon |
| `dispatch_checked_by` | Checked By / At | Ability to perform Post-Dispatch physical check | Dispatch | N/A | N/A | Disabled / Coming Soon |
| `canRunSkuSync` | SKU Sync | Ability to trigger SKU sync from Zoho | Operations (`/mobile/operations/solar-panel-stock`) | **NO** | N/A | Passed as `canSync` prop to client component, but never read or rendered |
| `canAdjustInventory` | Inventory Adjust | Manual stock adjustment | Operations | **NO** | N/A | No stock adjustment action exists in Mobile UI |
| `accountsAccess` | Catalog & Pricing | Access to Catalog & Pricing | Accounts | **NO** | N/A | Unused in Mobile UI |
| `dcr_serial_mapping_override` | Serial Corrections | Correct SKUs, DCR statuses, purchase records | Accounts | **NO** | N/A | Not implemented in Mobile UI (Desktop only) |

---

## 9. User Access Scenarios

### Scenario 1: User with Role `STAFF` and Zero Permissions Assigned
- **Mobile Home (`/mobile`)**:
  - Displays greeting "Hello, [User]".
  - Displays all 3 module cards: **Operations**, **Accounts**, **Dispatch**.
- **Operations (`/mobile/operations`)**:
  - User can click the card and access `/mobile/operations`.
  - User can open **Solar Panel Stock**, **Wire & Cables Stock**, **Inverter Stock**, and **Solar Accessories**.
  - User can view all live inventory numbers across all warehouses.
  - User can export raw Excel data and generate PDF screenshots.
- **Accounts (`/mobile/accounts`)**:
  - User can click the card and access `/mobile/accounts`.
  - "Customer Statement" card is **hidden**. Direct navigation to `/mobile/accounts/customer-statement` redirects back to `/mobile/accounts`.
  - "Customer DCR Lookup" card is **visible**. Direct navigation is **blocked** (redirects back to `/mobile/accounts`).
  - "Hold Queue" card is **visible**. Direct navigation is **blocked** (redirects to `/mobile/accounts?error=unauthorized`).
- **Dispatch (`/mobile/dispatch`)**:
  - User can click the card and access `/mobile/dispatch`.
  - User sees all active sales orders > ₹50,000 awaiting truck photos.
  - User sees today's uploaded truck photos and uploader names.
  - User can activate device camera, capture a photo, and submit it to `/api/mobile/dispatch/[id]/truck-image`, updating the workflow and dispatching live SSE events.

### Scenario 2: User with `accounts_customer_statement: true` (Only)
- **Mobile Home (`/mobile`)**: Same as Scenario 1.
- **Operations (`/mobile/operations`)**: Accessible (unrestricted).
- **Accounts (`/mobile/accounts`)**:
  - "Customer Statement" card is **visible**.
  - User navigates to `/mobile/accounts/customer-statement` and can search customers, view running ledgers, and download statement PDFs.
  - User can expand individual invoice summaries (unauthenticated Zoho detail fetch).
  - "Customer DCR Lookup" card is **visible**. User clicks it and **enters `/mobile/accounts/customer-dcr-lookup`** (allowed by route check `session.accounts_customer_statement`). However, searching any customer displays "Unable to load customers" because the API requires `dcr_management`.
  - "Hold Queue" card is visible, but clicking it redirects to `/mobile/accounts?error=unauthorized`.
- **Dispatch (`/mobile/dispatch`)**: Accessible (unrestricted).

### Scenario 3: User with `dcr_hold_release: true` and `holdQueueReviewEnabled: true`, Limit: ₹100,000
- **Mobile Home (`/mobile`)**: Same as Scenario 1.
- **Operations (`/mobile/operations`)**: Accessible (unrestricted).
- **Accounts (`/mobile/accounts`)**:
  - "Customer Statement" card is hidden (unless assigned).
  - "Customer DCR Lookup" card is visible, but route access is blocked.
  - "Hold Queue" card is visible. User navigates to `/mobile/accounts/hold-queue`.
  - In the queue:
    - Customer A with ₹50,000 balance: Can be refreshed and reviewed; serials can be released.
    - Customer B with ₹150,000 balance: Displays "Exceeds review limit. Requires admin approval." Review button is locked/disabled. If user bypasses the UI and sends a `PATCH` request directly, `/api/admin/dcr/hold-queue/release` rejects with 403.
- **Dispatch (`/mobile/dispatch`)**: Accessible (unrestricted).

### Scenario 4: User with `role: 'ADMIN'`
- **Mobile Home (`/mobile`)**: All cards visible.
- **Operations (`/mobile/operations`)**: Full access to all stock views and exports.
- **Accounts (`/mobile/accounts`)**:
  - All cards visible: Customer Statement, Customer DCR Lookup, Hold Queue.
  - All pages accessible.
  - Hold Queue shows no limit restrictions (`holdQueueReviewLimit` is forced to `null`).
  - All releases and data modifications succeed.
- **Dispatch (`/mobile/dispatch`)**: Full access.

---

## 10. Permission Gaps & Inconsistencies

### 1. [CRITICAL] Mobile Dispatch Completely Bypasses `dispatch_view` and `dispatch_truck_details`
- **Location**:
  - Route: `src/app/mobile/(app)/dispatch/page.tsx:6-10`
  - APIs: `src/app/api/mobile/dispatch/eligible-orders/route.ts:38`, `src/app/api/mobile/dispatch/today/route.ts:25`, `src/app/api/mobile/dispatch/[id]/truck-image/route.ts:18`
- **Description**: While Desktop Dispatch enforces `dispatch_view` and `dispatch_truck_details` (via `canCompleteDispatchStep`), the Mobile Dispatch route and its three backing APIs only check `if (!session) return 401`. Any staff member with an active session can view pending high-value orders, view uploaded photos, and upload truck photos.
- **Impact**: Unauthorized staff can alter dispatch workflows and upload arbitrary truck images.

### 2. [HIGH] Inconsistent Permission Check on Customer DCR Lookup Route
- **Location**: `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx:18`
- **Code**:
  ```typescript
  if (session.role !== 'ADMIN' && !session.dcr_management && !session.accounts_customer_statement) {
    redirect('/mobile/accounts');
  }
  ```
- **Description**: The route check allows users who have `accounts_customer_statement` to enter the page. However, the three backing APIs (`/api/admin/dcr/customer-lookup/search`, `/api/admin/dcr/customer/[customerId]`, `/api/admin/dcr/serial-registry`) strictly require `dcr_management`.
- **Impact**: Broken UX. Staff with only statement permissions see the DCR Lookup page, but every customer search or interaction fails with a 401 toast error.

### 3. [HIGH] Unauthenticated & Unchecked Statement Detail Endpoints
- **Location**:
  - `src/app/api/admin/customer-statement/invoice/[id]/route.ts:4-23`
  - `src/app/api/admin/customer-statement/bill/[id]/route.ts:4-23`
- **Description**: These endpoints fetch Zoho invoice and vendor bill line items (amounts, item names, rates, GST breakdowns). Neither endpoint calls `getSession()` or validates permissions. Any party on the network can query invoice and bill financial line items if they possess a valid ID.
- **Impact**: Sensitive financial data exposure without authentication.

### 4. [MEDIUM] Operations Module Has Zero Permission Gating
- **Location**:
  - `src/app/mobile/(app)/operations/page.tsx`
  - `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx`
  - `src/app/mobile/(app)/operations/wire-cable-stock/page.tsx`
  - `src/app/mobile/(app)/operations/inverter-stock/page.tsx`
  - `src/app/mobile/(app)/operations/solar-accessories-stock/page.tsx`
- **Description**: There are no permissions gating the Operations module or any of its four stock views. Any authenticated user can view inventory, export complete raw stock data to Excel, or generate PDF reports.
- **Impact**: Staff with restricted profiles have full visibility into company-wide warehouse inventory.

### 5. [MEDIUM] Dead / Phantom Prop `canSync` in Solar Panel Stock
- **Location**:
  - `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx:52`
  - `src/app/mobile/(app)/operations/solar-panel-stock/MobileSolarPanelStockClient.tsx:35`
- **Description**: `canSync={!!session.canRunSkuSync}` is computed in `page.tsx` and accepted in the `Props` interface of `MobileSolarPanelStockClient`, but `canSync` is never destructured or used anywhere in the client component.
- **Impact**: Dead code / illusory permission check.

### 6. [LOW] Module Cards on Home Screen Ignore User Permissions
- **Location**: `src/app/mobile/(app)/page.tsx:28-78`
- **Description**: The Mobile Home page unconditionally renders cards for Operations, Accounts, and Dispatch. When a user clicks "Accounts", they may see a mostly blank page if they have no account permissions; when they click "Hold Queue", they get redirected back.
- **Impact**: Misleading UI navigation.

---

## 11. Direct Route / Deep-Link Audit

| Route | Navigable via UI? | Direct URL Access Protected? | Enforcing Code | What Happens on Direct Navigation Without Permission |
|---|---|---|---|---|
| `/mobile` | Yes | No (requires auth) | `src/app/mobile/(app)/layout.tsx:8` | Redirects to `/mobile/login` if not authenticated; renders if authenticated |
| `/mobile/operations` | Yes | No | None | Renders for any authenticated user |
| `/mobile/operations/solar-panel-stock` | Yes | No | None | Renders for any authenticated user |
| `/mobile/operations/wire-cable-stock` | Yes | No | None | Renders for any authenticated user |
| `/mobile/operations/inverter-stock` | Yes | No | None | Renders for any authenticated user |
| `/mobile/operations/solar-accessories-stock` | Yes | No | None | Renders for any authenticated user |
| `/mobile/accounts` | Yes | No | None | Renders for any authenticated user |
| `/mobile/accounts/customer-statement` | Conditional | **YES** | `customer-statement/page.tsx:17` | Redirects to `/mobile/accounts` if user lacks `accounts_customer_statement` |
| `/mobile/accounts/customer-dcr-lookup` | Yes | **PARTIAL** | `customer-dcr-lookup/page.tsx:18` | Redirects if user lacks both `dcr_management` AND `accounts_customer_statement`. If user has statement permission, route renders but APIs fail |
| `/mobile/accounts/hold-queue` | Yes | **YES** | `hold-queue/page.tsx:10` | Redirects to `/mobile/accounts?error=unauthorized` if user lacks `dcr_hold_release` |
| `/mobile/dispatch` | Yes | **NO** | `dispatch/page.tsx:6` | Renders for any authenticated user (`dispatch_view` not checked) |

---

## 12. Admin / Bypass Behavior

Admin bypass is implemented in `src/lib/auth.ts` during session hydration in `getSession()`:

```typescript
// File: src/lib/auth.ts (Lines 88-153)
if (merged.role === 'ADMIN') {
  merged.canManageCarts = true;
  merged.canAdjustInventory = true;
  merged.canRunSkuSync = true;
  merged.canManageZoneMappings = true;
  merged.canManageUnlimitedSkus = true;
  merged.canManageTransfers = true;
  merged.canDeleteTransfers = true;
  merged.accounts_customer_statement = true;
  merged.accounts_invoice_processor = true;
  merged.accounts_transactions = true;
  merged.accounts_summary_view = true;
  merged.accounts_reports_salesman = true;
  merged.stock_alerts_manage = true;
  merged.accounts_recovery_manage = true;
  merged.release_statement_queue = true;
  merged.dcr_management = true;
  merged.dcr_serial_mapping_override = true;
  merged.dcr_hold_release = true;
  merged.solar_orders_view = true;
  merged.solar_orders_create = true;
  merged.solar_orders_approval = true;
  merged.solar_orders_docs_progress = true;
  merged.workflow_edits = true;
  merged.communications_view = true;
  merged.communications_templates = true;
  merged.whatsapp_integration = true;
  merged.holdQueueReviewEnabled = true;
  merged.holdQueueReviewLimit = null; // null represents NO LIMIT (unlimited review)
  // ... all catalog permissions set to true ...
  merged.dispatch_view = true;
  merged.dispatch_rate_review = true;
  merged.dispatch_payment_verification = true;
  merged.dispatch_truck_details = true;
  merged.dispatch_ready_for_invoice = true;
  merged.dispatch_invoice_confirmation = true;
  merged.dispatch_workflow_override = true;
  merged.dispatch_inventory_deduction = true;
  merged.dispatch_receiving_upload = true;
  merged.dispatch_checked_by = true;
}
```

### Characteristics of the Admin Bypass:
1. **Universal**: Regardless of what boolean flags are stored on the `User` row in PostgreSQL, an `ADMIN` session has all 61 permission flags forced to `true`.
2. **Hardcoded Limit Removal**: For the Hold Queue, `holdQueueReviewLimit` is explicitly set to `null`, granting unrestricted approval authority over balances of any magnitude.
3. **Redundant Code Safeguards**: In individual API route files, checks frequently repeat `if (session.role !== 'ADMIN' && !session.some_permission)` even though `session.some_permission` is already `true`.

---

## 13. Current-State Permission Diagram

```
                       USER LOGIN
               (mobile number + 6-digit PIN)
                           │
                           ▼
                 SESSION GENERATION
           ActiveSession DB row created
           JWT cookie issued (deviceType: 'mobile')
                           │
                           ▼
                 PERMISSION HYDRATION
               (src/lib/auth.ts: getSession)
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  role === 'ADMIN'                        role === 'STAFF'
Force ALL 61 keys = true             Read user boolean flags from DB
holdQueueReviewLimit = null          holdQueueReviewLimit = DB value
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
                  MOBILE APP LAYOUT
              (src/app/mobile/(app)/layout.tsx)
          [session exists? YES: continue / NO: redirect /mobile/login]
                           │
                           ▼
                   MOBILE HOME SCREEN
                 (src/app/mobile/(app)/page.tsx)
          [NO PERMISSION CHECKS: All 3 module cards shown]
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   OPERATIONS          ACCOUNTS           DISPATCH
  (/mobile/operations)  (/mobile/accounts)  (/mobile/dispatch)
         │                 │                 │
  [No Route Gate]   [No Route Gate]   [No Route Gate]
         │                 │          (dispatch_view NOT checked)
         │                 │                 │
         │                 ├─► Customer Statement Card
         │                 │   (UI: checks accounts_customer_statement)
         │                 │   Route: checks accounts_customer_statement
         │                 │   API: checks accounts_customer_statement
         │                 │   [Invoice & Bill detail APIs: UNCHECKED]
         │                 │
         │                 ├─► Customer DCR Lookup Card
         │                 │   (UI: unconditionally visible)
         │                 │   Route: checks dcr_management OR statement
         │                 │   API: checks ONLY dcr_management (MISMATCH)
         │                 │
         │                 └─► Hold Queue Card
         │                     (UI: unconditionally visible)
         │                     Route: checks dcr_hold_release
         │                     API: checks dcr_hold_release
         │                     Action: checks holdQueueReviewLimit
         │
         ▼
  STOCK SUB-PAGES
  • Solar Panel Stock
  • Wire & Cable Stock
  • Inverter Stock
  • Solar Accessories
  [No Route Gates / Direct DB queries in RSC / Unrestricted Exports]
```

---

## 14. Potential Future Improvements — NOT IMPLEMENTED

> [!NOTE]
> The items listed in this section are architectural and security recommendations for consideration. In accordance with audit rules, **none** of these recommendations have been implemented.

1. **Enforce `dispatch_view` and `dispatch_truck_details` on Mobile Dispatch**:
   - Add route protection in `src/app/mobile/(app)/dispatch/page.tsx` using `hasDispatchAccess(session)`.
   - Protect `/api/mobile/dispatch/eligible-orders`, `/api/mobile/dispatch/today`, and `/api/mobile/dispatch/[id]/truck-image` using `canCompleteDispatchStep(session, 'truck-details')`.
2. **Align DCR Customer Lookup Route Permission with API Requirements**:
   - In `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx`, remove `!session.accounts_customer_statement` from the access check so only users with `dcr_management` can enter, preventing 401 errors during search.
3. **Secure Statement Detail Endpoints**:
   - Add session and `accounts_customer_statement` checks to `/api/admin/customer-statement/invoice/[id]` and `/api/admin/customer-statement/bill/[id]`.
4. **Conditional Module Card Rendering on Mobile Home**:
   - Conditionally render module cards in `src/app/mobile/(app)/page.tsx` and sub-module cards in `src/app/mobile/(app)/accounts/page.tsx` based on user permissions.
5. **Add Role/Permission Gating for Operations Stock Data**:
   - Introduce an operational stock permission (or use `canAdjustInventory` / `stock_alerts_manage`) to govern visibility and export capabilities.
6. **Clean Up Unused Props**:
   - Remove the unused `canSync` prop in `MobileSolarPanelStockClient.tsx` or wire it up to a SKU sync trigger if intended.

---

## 15. Files Audited

### Mobile UI Routes & Components
- `src/app/mobile/layout.tsx`
- `src/app/mobile/login/page.tsx`
- `src/app/mobile/(app)/layout.tsx`
- `src/app/mobile/(app)/page.tsx`
- `src/app/mobile/_components/BottomNav.tsx`
- `src/app/mobile/(app)/operations/page.tsx`
- `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx`
- `src/app/mobile/(app)/operations/solar-panel-stock/MobileSolarPanelStockClient.tsx`
- `src/app/mobile/(app)/operations/solar-panel-stock/MobileSolarPanelFilterSheet.tsx`
- `src/app/mobile/(app)/operations/solar-panel-stock/MobileSolarPanelDrilldownSheet.tsx`
- `src/app/mobile/(app)/operations/wire-cable-stock/page.tsx`
- `src/app/mobile/(app)/operations/wire-cable-stock/MobileWireCableStockClient.tsx`
- `src/app/mobile/(app)/operations/inverter-stock/page.tsx`
- `src/app/mobile/(app)/operations/inverter-stock/MobileInverterStockClient.tsx`
- `src/app/mobile/(app)/operations/solar-accessories-stock/page.tsx`
- `src/app/mobile/(app)/operations/solar-accessories-stock/MobileSolarAccessoriesStockClient.tsx`
- `src/app/mobile/(app)/accounts/page.tsx`
- `src/app/mobile/(app)/accounts/customer-statement/page.tsx`
- `src/app/mobile/(app)/accounts/customer-statement/MobileCustomerStatementClient.tsx`
- `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx`
- `src/app/mobile/(app)/accounts/customer-dcr-lookup/MobileCustomerLookupClient.tsx`
- `src/app/mobile/(app)/accounts/hold-queue/page.tsx`
- `src/app/mobile/(app)/accounts/hold-queue/MobileHoldQueueClient.tsx`
- `src/app/mobile/(app)/dispatch/page.tsx`
- `src/app/mobile/(app)/dispatch/MobileDispatchClient.tsx`

### Core Authentication, Session & Permission Infrastructure
- `src/lib/permissions.ts`
- `src/lib/auth.ts`
- `src/lib/session.ts`
- `src/lib/dispatch-auth.ts`
- `prisma/schema.prisma`
- `src/app/admin/user-permissions/page.tsx`
- `src/app/api/admin/users/[id]/permissions/route.ts`
- `src/app/api/auth/login/route.ts`

### Mobile & Backing API Routes
- `src/app/api/mobile/dispatch/eligible-orders/route.ts`
- `src/app/api/mobile/dispatch/today/route.ts`
- `src/app/api/mobile/dispatch/[id]/truck-image/route.ts`
- `src/app/api/dispatch/truck-image/[uploadId]/route.ts`
- `src/app/api/dispatch/incoming-queue/route.ts`
- `src/app/api/dispatch/incoming-orders/[id]/workflow/truck-details/route.ts`
- `src/app/api/admin/customer-statement/search/route.ts`
- `src/app/api/admin/customer-statement/statement/route.ts`
- `src/app/api/admin/customer-statement/invoice/[id]/route.ts`
- `src/app/api/admin/customer-statement/bill/[id]/route.ts`
- `src/app/api/admin/customer-statement/customer/route.ts`
- `src/app/api/admin/customer-statement/quick/route.ts`
- `src/app/api/admin/dcr/customer-lookup/search/route.ts`
- `src/app/api/admin/dcr/customer/[customerId]/route.ts`
- `src/app/api/admin/dcr/serial-registry/route.ts`
- `src/app/api/admin/dcr/hold-queue/route.ts`
- `src/app/api/admin/dcr/hold-queue/refresh/route.ts`
- `src/app/api/admin/dcr/hold-queue/release/route.ts`
