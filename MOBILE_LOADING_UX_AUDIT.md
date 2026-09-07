# Mobile Loading UX Audit
**Kamna Traders B2B ERP — Mobile UI**
*Date: September 7, 2026*

---

## 1. Mobile Route Inventory

| Route | Page Component | Server / Client Component | Main Data Sources | API Calls | Current Loading Behavior | Current Navigation Behavior | Existing `loading.tsx` | Existing `Suspense` | Existing Skeleton | Existing Action Loading | UX Problem | Recommended Loading Treatment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/mobile` | `src/app/mobile/(app)/page.tsx` | Server Component | `getSession()` | None | Instant/None | Instant once server renders; blank if slow session | None | None | None | None | Tapping card navigates without visual pressed state / feedback; blank gap if cold start | Module card route skeleton (`loading.tsx`), active tap feedback on cards |
| `/mobile/operations` | `src/app/mobile/(app)/operations/page.tsx` | Server Component | `getSession()`, permission checks | None | None | Instant / potential blank delay | None | None | None | None | Tapping category navigation gives minimal feedback, destination loading is unhandled | Category list skeleton (`loading.tsx`), smooth active press states |
| `/mobile/operations/solar-panel-stock` | `src/app/mobile/(app)/operations/solar-panel-stock/page.tsx` | Server Component + Client Child (`MobileSolarPanelStockClient`) | Prisma (`warehouse`, `category`, `brand`), `ProductLookupService.search` | Initial server-rendered via Prisma & ProductLookup; Excel/Screenshot on demand | **None** on route load. Blank white screen during server query (can take 1-3s). | Unresponsive feeling while waiting for server DB queries | **None** | None | None | Raw Data & Screenshot have spinners | Heavy server data fetch with no `loading.tsx` causes complete navigation freeze | Add `loading.tsx` with dedicated KPI & series table skeleton matching solar panel layout |
| `/mobile/operations/wire-cable-stock` | `src/app/mobile/(app)/operations/wire-cable-stock/page.tsx` | Server Component + Client Child (`MobileWireCableStockClient`) | Prisma (`warehouse`, `category`, `brand`), `ProductLookupService.search` | Initial server-rendered | Uses `loading.tsx` with `MobileWireCableStockSkeleton` | Immediate skeleton render via `loading.tsx` | **Yes** (`loading.tsx`) | Next.js route Suspense | **Yes** (`MobileWireCableStockSkeleton`) | Filter / toggle states exist | High quality existing skeleton; drawer has internal mini-skeleton | Benchmark model; ensure header styling and transitions align with system |
| `/mobile/operations/inverter-stock` | `src/app/mobile/(app)/operations/inverter-stock/page.tsx` | Server Component + Client Child (`MobileInverterStockClient`) | Prisma (`warehouse`), `ProductLookupService.search` | Initial server-rendered | Uses `loading.tsx` with `MobileInverterStockSkeleton` | Immediate skeleton render via `loading.tsx` | **Yes** (`loading.tsx`) | Next.js route Suspense | **Yes** (`MobileInverterStockSkeleton`) | Brand filter / toggle states | High quality existing skeleton; brand group cards match content well | Benchmark model; ensure consistent primitive reusability |
| `/mobile/operations/solar-accessories-stock` | `src/app/mobile/(app)/operations/solar-accessories-stock/page.tsx` | Server Component + Client Child (`MobileSolarAccessoriesStockClient`) | Prisma (`warehouse`), `ProductLookupService.search` | Initial server-rendered | **None** on route load. Blank screen during server data fetch | Blank screen during page transition | **None** | None | None | Export raw data has spinner | Complete freeze/blank screen on navigation from Operations hub | Add `loading.tsx` with Grand Total banner and accordion category card skeletons |
| `/mobile/accounts` | `src/app/mobile/(app)/accounts/page.tsx` | Server Component | `getSession()`, permission checks | None | None | Instant / potential blank delay | None | None | None | None | No visual feedback during navigation from Home or between sub-routes | Accounts hub skeleton (`loading.tsx`) matching Available Modules cards |
| `/mobile/accounts/customer-statement` | `src/app/mobile/(app)/accounts/customer-statement/page.tsx` | Server Component + Client Child (`MobileCustomerStatementClient`) | `getSession()`, `searchParams` | Search: `/api/admin/customer-statement/search`<br>Statement: `/api/admin/customer-statement/statement`<br>Invoices: `/api/admin/customer-statement/invoice-details` | Shows generic spinner `<div className="w-8 h-8 ... animate-spin" />` with text "Fetching statement..." | Page loads empty search box; fetching statement is generic spinner | **None** | None | Inline line item detail text pulse only | PDF generation has toast + state; search debounced | Generic spinner replaces entire lower page; jarring visual shift when statement arrives | Add `loading.tsx` for route. In-page: show customer header skeleton + statement KPI/transaction row skeleton instead of bare spinner |
| `/mobile/accounts/customer-dcr-lookup` | `src/app/mobile/(app)/accounts/customer-dcr-lookup/page.tsx` | Server Component + Client Child (`MobileCustomerLookupClient`) | `getSession()`, `localStorage` cached customer ID | Search: `/api/admin/dcr/customer-lookup/search`<br>Summary: `/api/admin/dcr/customer/[id]`<br>Serials: `/api/admin/dcr/serial-registry` | When cached ID exists, shows pulsing boxes for header/KPIs, and 3 pulse card skeletons for invoices. During search, spinner in search sheet. | Route load has no skeleton (`loading.tsx` missing); in-page loading is partial | **None** | None | Partial ad-hoc pulses in-page | Search sheet has spinner; pagination has loading state | If user navigates directly or via link, blank page until client hydrates and fetches; invoice pulses don't match card layout exactly | Add `loading.tsx` with customer selector + KPI grid skeleton; refine in-page invoice card skeletons |
| `/mobile/accounts/hold-queue` | `src/app/mobile/(app)/accounts/hold-queue/page.tsx` | Server Component + Client Child (`MobileHoldQueueClient`) | `getSession()`, role/permission check | List: `/api/admin/dcr/hold-queue`<br>Release: `/api/admin/dcr/release-serials`<br>Unlock: `/api/admin/dcr/unlock-customer` | Initial load shows 3 generic rectangular pulse blocks (`h-24 rounded-xl`). Detail view has no skeleton. Refresh All shows text "Refreshing...". | Blank transition until client mounts, then crude pulse boxes | **None** | None | Crude pulse rectangles (not matching customer card layout) | Release button disabled with opacity; Refresh All has spinner | Initial pulse boxes don't match final customer cards (missing badges, balances, age indicators); detail view has no loading state; no route skeleton | Add `loading.tsx` with header, KPI grid, and realistic Hold Queue card skeletons; refine in-page refresh and release states |
| `/mobile/dispatch` | `src/app/mobile/(app)/dispatch/page.tsx` | Server Component + Client Child (`MobileDispatchClient`) | `getSession()`, permission checks | Orders: `/api/mobile/dispatch/eligible-orders`<br>Upload: `/api/mobile/dispatch/upload-truck-photo` | Initial load shows generic centered spinner (`Loader2 text-slate-600 "Loading dispatch orders..."`). Refresh button spins icon. | Blank transition until client mounts, then centered spinner | **None** | None | None | Refresh has spinning icon; photo upload has pending states | Full-page generic spinner causes major layout jump once order cards render; truck photo gallery thumbnails have no skeleton placeholder | Add `loading.tsx` for dispatch route; replace in-page generic loader with realistic active order card skeletons and today's uploaded card skeletons; add image thumbnail loading skeleton |
| `/mobile/login` | `src/app/mobile/login/page.tsx` | Client Component | Client state, `/api/auth/login` | Login POST | Instant / Suspense fallback is plain div | Form submit spinner inside button | None | Suspense boundary | None | Sign In button has spinner + disable | Suspense fallback is empty div | Add neat logo + form skeleton fallback |

---

## 2. Loading Architecture Audit

### A. Which pages are Server Components?
1. `/mobile/page.tsx` (Mobile Home)
2. `/mobile/operations/page.tsx` (Stock Management hub)
3. `/mobile/operations/solar-panel-stock/page.tsx`
4. `/mobile/operations/wire-cable-stock/page.tsx`
5. `/mobile/operations/inverter-stock/page.tsx`
6. `/mobile/operations/solar-accessories-stock/page.tsx`
7. `/mobile/accounts/page.tsx` (Accounts hub)
8. `/mobile/accounts/customer-statement/page.tsx`
9. `/mobile/accounts/customer-dcr-lookup/page.tsx`
10. `/mobile/accounts/hold-queue/page.tsx`
11. `/mobile/dispatch/page.tsx`

*Note: All route entrypoints are Server Components that check authentication and permissions before rendering client components.*

### B. Which pages are Client Components?
1. `/mobile/login/page.tsx` (`'use client'`)
2. Child client components for all data pages:
   - `MobileSolarPanelStockClient.tsx`
   - `MobileWireCableStockClient.tsx`
   - `MobileInverterStockClient.tsx`
   - `MobileSolarAccessoriesStockClient.tsx`
   - `MobileCustomerStatementClient.tsx`
   - `MobileCustomerLookupClient.tsx`
   - `MobileHoldQueueClient.tsx`
   - `MobileDispatchClient.tsx`

### C. Which pages load data server-side?
- `solar-panel-stock/page.tsx`: Server-side DB fetch via Prisma (`warehouse`, `category`, `brand`) and `ProductLookupService.search`.
- `wire-cable-stock/page.tsx`: Server-side DB fetch via Prisma and `ProductLookupService.search`.
- `inverter-stock/page.tsx`: Server-side DB fetch via Prisma and `ProductLookupService.search`.
- `solar-accessories-stock/page.tsx`: Server-side DB fetch via Prisma and `ProductLookupService.search`.

### D. Which pages fetch data client-side?
- `dispatch/MobileDispatchClient.tsx`: Fetches `/api/mobile/dispatch/eligible-orders`.
- `hold-queue/MobileHoldQueueClient.tsx`: Fetches `/api/admin/dcr/hold-queue`.
- `customer-statement/MobileCustomerStatementClient.tsx`: Fetches `/api/admin/customer-statement/search`, `/api/admin/customer-statement/statement`, `/api/admin/customer-statement/invoice-details`.
- `customer-dcr-lookup/MobileCustomerLookupClient.tsx`: Fetches `/api/admin/dcr/customer-lookup/search`, `/api/admin/dcr/customer/[id]`, `/api/admin/dcr/serial-registry`.

### E. Which pages use Suspense?
- `wire-cable-stock` and `inverter-stock` implicitly use Next.js route Suspense via their `loading.tsx`.
- `/mobile/login` wraps `MobileLoginContent` in a React `<Suspense>`.
- **None** of the other pages or data-fetching blocks currently use `<Suspense>` or component-level suspense boundaries.

### F. Which pages use `loading.tsx`?
- **ONLY TWO**:
  - `/mobile/operations/wire-cable-stock/loading.tsx`
  - `/mobile/operations/inverter-stock/loading.tsx`
- **MISSING `loading.tsx`**:
  - `/mobile/loading.tsx` (Mobile Home)
  - `/mobile/operations/loading.tsx` (Stock Management Hub)
  - `/mobile/operations/solar-panel-stock/loading.tsx` (Critical! Heavy server queries)
  - `/mobile/operations/solar-accessories-stock/loading.tsx` (Critical! Heavy server queries)
  - `/mobile/accounts/loading.tsx` (Accounts Hub)
  - `/mobile/accounts/customer-statement/loading.tsx`
  - `/mobile/accounts/customer-dcr-lookup/loading.tsx`
  - `/mobile/accounts/hold-queue/loading.tsx`
  - `/mobile/dispatch/loading.tsx`

### G. Which pages have no loading state?
- `/mobile/operations/solar-panel-stock` has **ZERO** route loading state. Users clicking "Solar Panel Stock" experience a completely unresponsive 1-3 second delay before the screen suddenly swaps.
- `/mobile/operations/solar-accessories-stock` has **ZERO** route loading state.
- Navigation into `/mobile/dispatch` has no route loading state.
- Navigation into `/mobile/accounts/hold-queue` has no route loading state.
- Navigation into `/mobile/accounts/customer-statement` has no route loading state.
- Navigation into `/mobile/accounts/customer-dcr-lookup` has no route loading state.

### H. Which components already have skeleton implementations?
- `MobileWireCableStockSkeleton.tsx`: High quality layout (Summary cards, measurement toggle, filter bar, table hierarchy).
- `MobileInverterStockSkeleton.tsx`: High quality layout (Summary stats, search bar, brand cards).
- `MobileCustomerLookupClient.tsx`: Contains inline ad-hoc pulses (`bg-slate-200 animate-pulse`), but not a full structured skeleton.
- `MobileHoldQueueClient.tsx`: Contains 3 crude `<div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />` blocks.

### I. Which actions already expose pending/loading state?
- Dispatch: "Refresh Orders" has spinning icon; "Capture Truck Photo" opens live camera; "Upload Truck Photo" modal has `submitting` loader with disabled button.
- Customer Statement: "Search" sets `isSearching`; "Generate PDF" shows toast loader; Expand invoice row shows "Loading details...".
- Customer DCR Lookup: Search input has debounced `isSearching` spinner; expand serials has `status: 'loading'`.
- Hold Queue: "Release" buttons have `isReleasing` disable state; "Refresh All" button has spinning icon.
- Solar Panel Stock: Export raw data and screenshot have spinners.

### J. Which pages have blank/white/empty areas during loading?
- `solar-panel-stock`: Entire route blank during server render.
- `solar-accessories-stock`: Entire route blank during server render.
- `dispatch`: Main order area is replaced by a centered `<Loader2 className="animate-spin" />` with no skeleton shape.
- `customer-statement`: Below search, the entire statement area is replaced by an 8x8 spinner while loading data.
- `hold-queue`: Main list displays empty rectangular boxes rather than customer cards with outstanding balances and badges.
- `MobileImagePreview` / Truck photo thumbnails: Show blank or broken box while remote image is fetching.

---

## 3. Navigation Audit

| Navigation Transition | From | To | Current Visual Feedback | Transition Delay | Destination Render State | UX Issue |
|---|---|---|---|---|---|---|
| Home → Stock Management | `/mobile` | `/mobile/operations` | Card active scale `0.96` | ~100-300ms | Immediate | Good tap feedback, but if server delay occurs, no route skeleton |
| Stock Management → Solar Panel Stock | `/mobile/operations` | `/mobile/operations/solar-panel-stock` | Card active scale `0.98` | 1000-2500ms (heavy Prisma queries) | Blank freeze until complete HTML arrives | **Severe freeze**. User taps, card compresses, then screen stays static on `/mobile/operations` for 2+ seconds |
| Stock Management → Wire & Cable Stock | `/mobile/operations` | `/mobile/operations/wire-cable-stock` | Card active scale `0.98` | Instant skeleton via `loading.tsx` | WireCableStockSkeleton rendered immediately, then pops in data | **Excellent UX** (the gold standard in this codebase) |
| Stock Management → Inverter Stock | `/mobile/operations` | `/mobile/operations/inverter-stock` | Card active scale `0.98` | Instant skeleton via `loading.tsx` | InverterStockSkeleton rendered immediately, then pops in data | **Excellent UX** |
| Stock Management → Solar Accessories Stock | `/mobile/operations` | `/mobile/operations/solar-accessories-stock` | Card active scale `0.98` | 1000-2000ms | Blank freeze until complete HTML arrives | **Severe freeze** |
| Home → Accounts | `/mobile` | `/mobile/accounts` | Card active scale `0.96` | ~100-300ms | Immediate | Good tap feedback, but missing route skeleton for slow connections |
| Accounts → Customer Statement | `/mobile/accounts` | `/mobile/accounts/customer-statement` | Card active scale `0.98` | 200-500ms | Instant header + empty search; if customer in sessionStorage, bare spinner | Sudden transition, followed by bare spinner |
| Accounts → Customer DCR Lookup | `/mobile/accounts` | `/mobile/accounts/customer-dcr-lookup` | Card active scale `0.98` | 200-500ms | Instant header + "No customer selected" or crude pulses if cached ID | Missing route skeleton |
| Accounts → Hold Queue | `/mobile/accounts` | `/mobile/accounts/hold-queue` | Card active scale `0.98` | 400-1000ms | Instant header, then 3 crude gray rectangular boxes | Route transition pause, followed by layout shift |
| Home → Dispatch | `/mobile` | `/mobile/dispatch` | Card active scale `0.96` | 300-800ms | Instant header, then centered Loader2 spinner | Centered spinner with text causes severe layout jump when orders load |
| BottomNav: Home | Any mobile page | `/mobile` | Link click | ~100-300ms | Immediate | Smooth |
| Back Button (Header) | Any sub-page | Parent hub | Header chevron active opacity `0.6` | ~100-300ms | Immediate | Good tap feedback |

---

## 4. API & Data Loading Audit

### A. Customer Statement
- **Initial Load**: If customer ID is restored from `sessionStorage`, client invokes `fetchStatement(savedId)`. `loading` is set to `true`.
  - *Current UX*: Renders customer card at top, but entire lower body renders a centered spinner: `<div className="w-8 h-8 ... animate-spin" /> Fetching statement...`.
  - *Problem*: No skeleton for the KPI cards (Total Invoiced, Total Paid, Balance), date filter pills, or transaction table. When data arrives, the page experiences a massive layout shift.
- **Search Loading**: Typing in search box debounces 300ms, calls `/api/admin/customer-statement/search`. `isSearching` is set.
  - *Current UX*: Small search input with no inline spinner indicator while searching.
- **Invoice Expand Details**: Tapping an invoice calls `/api/admin/customer-statement/invoice-details`.
  - *Current UX*: Shows text `"Loading details..."` with text pulse.
- **Refresh**: Re-selection or re-fetch causes the whole screen below customer info to collapse into the centered spinner.
- **Empty State**: When 0 transactions found, shows "No transactions found in this period". Correctly separated from loading.

### B. Customer DCR Lookup
- **Initial Load**: If customer ID restored from `localStorage`, calls `/api/admin/dcr/customer/[id]`. `isFetchingSummary` is set.
  - *Current UX*: Shows small pulsing rects for name and 3 invoice skeletons (`bg-white rounded-xl p-4 shadow-sm`). KPI section shows small pulses.
  - *Problem*: Invoices skeleton lacks top status bar, price, and salesperson lines, causing jump. Search sheet selection has a sudden blank flash before summary arrives.
- **Search Loading**: Opens full-screen search sheet. Shows centered spinner during search query.
- **Expand Invoice Serials**: Calls `/api/admin/dcr/serial-registry`. Shows status indicators.
- **Empty State**: Shows "No customer selected" (initial) or "No invoices match the selected filters" (empty). Good semantic separation.
- **Error State**: Shows inline red banner with "Try Again" button. Good error handling.

### C. Hold Queue
- **Initial Load**: Calls `/api/admin/dcr/hold-queue`. `loading` is set to `true`.
  - *Current UX*: KPI cards show 0s or stale numbers, and customer list displays 3 plain gray blocks: `[1, 2, 3].map(i => <div className="bg-white h-24 rounded-xl border border-slate-200 animate-pulse" />)`.
  - *Problem*: Gray blocks don't resemble customer cards. They lack header, outstanding badge, age pill, and action buttons. Once loaded, the page abruptly jumps in height.
- **Refresh All**: Calls `handleRefreshAll`. Sets `isRefreshingAll`.
  - *Current UX*: Button spins Refresh icon and changes text to "Refreshing...". Good, but the list below does not subtly indicate refresh without wiping data.
- **Release Action**: Calls `/api/admin/dcr/release-serials`. Sets `isReleasing`.
  - *Current UX*: Buttons are disabled with opacity. Duplicate click prevented.
- **Empty State**: Shows "No customers on hold found." Correctly separated.

### D. Dispatch
- **Initial Load**: Calls `/api/mobile/dispatch/eligible-orders`. `loading` is set to `true`.
  - *Current UX*: Shows centered `<Loader2 size={36} className="animate-spin text-[#1A2766] mb-3" />` with "Loading dispatch orders...".
  - *Problem*: Zero skeleton structure. User has no idea if 1, 5, or 10 cards will load. Major layout jump.
- **Refresh**: Refresh button has spinning icon. Preserves existing orders while re-fetching. Good pattern.
- **Upload Truck Photo**: Live camera stream capture → canvas resize → FormData POST to `/api/mobile/dispatch/upload-truck-photo`. Submitting state disables button and shows spinner.
- **Today's Uploads Tab**: Displays thumbnail images (`img src={up.imageUrl}`).
  - *Current UX*: No image skeleton or placeholder while image loads; thumbnail is blank until byte stream finishes.
- **Empty State**: Shows "All Caught Up" with checkmark (Upload tab) and "No Uploads Today" with truck icon (Today tab). Excellent empty states.

### E. Stock Management (Solar Panel, Solar Accessories)
- **Initial Load**: Server Components querying large Prisma tables.
  - *Current UX*: No client fetch; entirely server-side. But because `loading.tsx` is completely missing in both routes, Next.js does not stream a skeleton. Navigation simply hangs on the previous screen until the entire server render finishes.
  - *Problem*: Biggest source of perceived slowness in the entire mobile app.

---

## 5. Action Audit

| Action | Component | Current Loading Feedback | Disabled While Pending? | Prevents Duplicate? | Issues Identified |
|---|---|---|---|---|---|
| Card Tap Navigation | Home & Hub pages (`Link`) | `active:scale-[0.96]` or `[0.98]` | No | No (rapid double-tap can queue transitions) | Needs subtle pressed state and immediate route skeleton |
| Customer Search (Statement) | `MobileCustomerStatementClient` | Debounce 300ms | No | No | No spinner inside search input while fetching |
| Customer Search (DCR Lookup) | `MobileCustomerLookupClient` | Debounce 400ms + centered spinner in sheet | No | Yes | Works adequately; input could use inline spinner |
| Hold Queue Refresh All | `MobileHoldQueueClient` | Icon spin + text change "Refreshing..." | Yes (`disabled={isRefreshingAll}`) | Yes | Background list doesn't show subtle loading shimmer |
| Hold Queue Release Serials | `MobileHoldQueueClient` | `disabled={isReleasing}` | Yes | Yes | Button lacks small inline spinner |
| Dispatch Refresh | `MobileDispatchClient` | Icon spin `animate-spin` | Yes (`disabled={refreshing}`) | Yes | Localized, doesn't wipe list. Excellent. |
| Dispatch Photo Upload | `MobileDispatchClient` | `submitting` boolean disables button and shows `Loader2` | Yes | Yes | Correctly handles mutation pending state |
| Solar Stock Raw Data Export | `MobileSolarPanelStockClient` | Spinner `Loader2` in overflow menu | Yes (`disabled={isExporting}`) | Yes | Works well |
| Solar Stock Screenshot | `MobileSolarPanelStockClient` | Spinner `Loader2` in overflow menu | Yes (`disabled={isScreenshotting}`) | Yes | Works well |
| Accessories Raw Data Export | `MobileSolarAccessoriesStockClient` | Spinner `Loader2` in overflow menu | Yes (`disabled={isExporting}`) | Yes | Works well |
| Statement PDF Export | `MobileCustomerStatementClient` | `toast.loading('Generating Statement PDF...')` | Yes (`disabled={pdfGenerating}`) | Yes | Button shows text change and spinner |

---

## 6. Architecture & Reusability Gap Analysis

1. **Missing `loading.tsx` files**:
   - `src/app/mobile/(app)/loading.tsx` (Root app loader)
   - `src/app/mobile/(app)/operations/loading.tsx`
   - `src/app/mobile/(app)/operations/solar-panel-stock/loading.tsx`
   - `src/app/mobile/(app)/operations/solar-accessories-stock/loading.tsx`
   - `src/app/mobile/(app)/accounts/loading.tsx`
   - `src/app/mobile/(app)/accounts/customer-statement/loading.tsx`
   - `src/app/mobile/(app)/accounts/customer-dcr-lookup/loading.tsx`
   - `src/app/mobile/(app)/accounts/hold-queue/loading.tsx`
   - `src/app/mobile/(app)/dispatch/loading.tsx`

2. **Absence of Shared Mobile Skeleton Primitives**:
   - Every existing skeleton manually creates `div`s with inline Tailwind classes like `bg-slate-200 animate-pulse`.
   - Wire & Cable and Inverter have custom skeletons, but there is no shared library of:
     - `MobileSkeleton` (base shimmer element with proper rounded and slate shades)
     - `MobilePageSkeleton`: Top header with title + back chevron + main container
     - `MobileCardSkeleton`: Reusable ERP card outline with shimmer
     - `MobileKpiSkeleton`: Reusable 2-col or 3-col KPI summary statistics
     - `MobileListSkeleton`: Reusable list rows
     - `MobileImageSkeleton`: Reusable photo thumbnail with placeholder
   - Centralized primitives in `src/components/mobile/skeleton/` ensure standard heights, radii (`rounded-2xl`, `rounded-xl`), colors (`bg-slate-100`, `bg-slate-200`), and zero layout shift.

---

## 7. Next Steps & Implementation Strategy

1. **Step 1: Build Shared Mobile Skeleton Primitives** in `src/components/mobile/skeleton/`:
   - `MobileSkeleton` (base shimmer element with proper rounded and slate shades)
   - `MobileHeaderSkeleton` (standard 56px sticky navy `#1A2766` header with back button)
   - `MobileKpiSkeleton` (grid of 2, 3, or 4 KPI cards matching the exact design)
   - `MobileCardSkeleton` (standard card with header line, subtitle, and badge)
   - `MobileTableSkeleton` (standard table layout matching Solar Panel and Wire & Cable)
   - `MobileImageSkeleton` (image thumbnail with camera/image icon placeholder)

2. **Step 2: Implement Missing `loading.tsx` Route Skeletons**:
   - Mobile Home (`/mobile/loading.tsx`)
   - Stock Management Hub (`/mobile/operations/loading.tsx`)
   - Solar Panel Stock (`/mobile/operations/solar-panel-stock/loading.tsx`)
   - Solar Accessories Stock (`/mobile/operations/solar-accessories-stock/loading.tsx`)
   - Accounts Hub (`/mobile/accounts/loading.tsx`)
   - Customer Statement (`/mobile/accounts/customer-statement/loading.tsx`)
   - Customer DCR Lookup (`/mobile/accounts/customer-dcr-lookup/loading.tsx`)
   - Hold Queue (`/mobile/accounts/hold-queue/loading.tsx`)
   - Dispatch (`/mobile/dispatch/loading.tsx`)

3. **Step 3: Enhance In-Page Dynamic Data Skeletons**:
   - `MobileDispatchClient`: Replace generic `<Loader2 />` with `MobileDispatchSkeleton` (active orders & today's uploads). Add thumbnail image placeholders.
   - `MobileCustomerStatementClient`: Replace generic spinner with statement KPI skeleton & transaction rows skeleton.
   - `MobileCustomerLookupClient`: Standardize invoice cards & KPI skeletons to match real cards.
   - `MobileHoldQueueClient`: Replace crude 3 gray boxes with realistic `MobileHoldQueueCardSkeleton`.

4. **Step 4: Polish Action & Input Loading**:
   - Customer search inputs with localized spinner icons.
   - Release action buttons with inline mini spinner and dimension lock.
   - Ensure image thumbnails render smooth shimmer until `onLoad` fires.

5. **Step 5: Documentation & Verification**:
   - Document rules in `MOBILE_LOADING_UX_GUIDELINES.md`.
   - Run complete verification matrix in `MOBILE_LOADING_UX_VERIFICATION.md`.
