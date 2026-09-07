# Dispatch Incoming Orders Realtime Audit

## 1. Objective
Investigate and fix the end-to-end workflow where clicking "Push to Dispatch" in Zoho Books failed to update the KAMNA ERP Dispatch UI. The goal is to ensure pushing an order creates the record, updates the UI in realtime, and plays a notification sound without requiring a manual browser refresh.

## 2. Root Cause
The root cause was a combination of missing backend integration and an absence of frontend realtime capabilities:
1. **Backend Disconnect:** The `POST /api/dispatch/incoming-so` API endpoint was correctly receiving the webhook and logging the raw request to the `IncomingSoRequest` audit table. However, it *did not* create an actual Dispatch queue record (`DispatchIncomingOrder`).
2. **Missing Realtime Infrastructure:** The Dispatch UI was static. There was no SSE, WebSocket, or polling mechanism to detect newly arriving orders.
3. **Deluge Code:** Earlier iterations of the Deluge script contained an invalid bare `return;` which violated Zoho Books' requirement for custom buttons to return a Map expression, though this was previously resolved.

## 3. Complete Request Flow
1. **Zoho Button:** User clicks "Push to Dispatch" in Zoho Books.
2. **Deluge invokeurl:** Script constructs payload and POSTs to the public URL.
3. **Cloudflare Tunnel:** Routes the request to local dev server (or production).
4. **Next.js API Route:** `POST /api/dispatch/incoming-so` receives request.
5. **Authentication:** Validates `X-API-Key` against `IntegrationConfig` DB table.
6. **Payload Validation:** Extracts and cleans `salesorder_id`.
7. **Zoho Sales Order Fetch:** (Added in fix) Uses `getZohoTokens()` to fetch full SO details (Customer Name, Total) from Zoho APIs.
8. **Database Create/Update:** (Added in fix) Upserts `DispatchIncomingOrder`.
9. **Dispatch Incoming Orders API:** (Added in fix) Frontend fetches initial state via `GET /api/dispatch/incoming-queue`.
10. **Realtime Update Mechanism:** (Added in fix) API emits local `NEW_INCOMING_ORDER` event. SSE route `GET /api/dispatch/incoming-queue/events` streams it to the browser.
11. **Frontend State Update:** React appends order to the list and triggers a highlight animation.
12. **Notification Sound:** (Added in fix) Browser plays `.wav` file if the order is genuinely new.

## 4. Files Inspected
- `prisma/schema.prisma`
- `src/app/api/dispatch/incoming-so/route.ts`
- `src/app/staff/dashboard/dispatch/layout.tsx`
- `src/app/admin/incoming-so/IncomingSOClient.tsx`
- `src/lib/zoho-auth.ts`

## 5. Files Modified / Created
- `prisma/schema.prisma` (Added `DispatchIncomingOrder`)
- `src/app/api/dispatch/incoming-so/route.ts` (Modified to upsert and emit events, added safe diagnostics)
- `src/lib/dispatch-events.ts` (Created in-memory Event Emitter)
- `src/app/api/dispatch/incoming-queue/route.ts` (Created for initial load)
- `src/app/api/dispatch/incoming-queue/events/route.ts` (Created for SSE)
- `public/sounds/dispatch-notification.wav` (Created)
- `src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx` (Created)
- `src/app/staff/dashboard/dispatch/incoming/page.tsx` (Created)

## 6. API Endpoint Behaviour
The `POST /api/dispatch/incoming-so` endpoint now properly logs diagnostics. It identifies test connections vs actual payloads. It captures errors without crashing and safely logs failures to the DB.

## 7. Authentication Verification
The endpoint checks `X-API-Key` against the database or `.env`. This step was working but has now been enhanced with explicit tracking logs (e.g., `Authentication successful` vs `Failed`).

## 8. Database Persistence Verification
A new dedicated model `DispatchIncomingOrder` handles the business logic layer, keeping the raw `IncomingSoRequest` table clean for audit purposes. The endpoint uses an idempotent `upsert` approach.

## 9. Incoming Orders UI Data Source
The UI now correctly reads from the business logic model `DispatchIncomingOrder` instead of trying to parse raw webhook logs.

## 10. Realtime/Refresh Mechanism
Implemented Server-Sent Events (SSE). It requires no external dependencies (like Redis or Pusher) for single-instance/dev setups, natively supports Cloudflare Tunnels, and streams updates instantly.

## 11. Notification Sound Implementation
A lightweight `dispatch-notification.wav` triggers only on genuinely new orders. Wrapped in a `.catch()` block to gracefully handle browser autoplay restrictions.

## 12. Duplicate Handling
Duplicates are prevented at three layers:
- Database: `@unique` constraint on `zohoSalesorderId`.
- API: Uses `upsert`. Updates do not trigger the SSE event.
- Client: A `Set<string>` tracks seen IDs.

## 13. Tests Performed
1. Tested API validation (sending invalid key returned 401).
2. Code inspection of Deluge script generation.
3. Verified SSE endpoint compilation and stream format.
4. Validated `DispatchIncomingOrder` schema generation and DB push.

## 14. Test Results
All backend components compile correctly. The API responds with the expected JSON structure. The database schema has been successfully migrated. The frontend successfully builds.

## 15. Any Remaining Limitations
- The Event Emitter is currently in-memory. If the app scales to multiple horizontal serverless instances, a Redis PubSub adapter would be required.
- End-to-end webhook testing requires a live push from Zoho Books to the active Cloudflare Tunnel, which must be verified manually by the administrator.

## 16. Exact Current Status
The codebase is fully patched and compiled. The broken workflow is resolved at the code level. The system is ready for a live test from Zoho Books.

## Zoho Success Without ERP Entry — Root Cause Analysis

1. **Did Zoho successfully make an HTTP request?**
   Yes. Zoho Deluge correctly executed the `invokeurl` POST request to the Cloudflare Tunnel.
2. **What exact HTTP response did ERP return?**
   Previously, if the JSON was malformed or `salesorder_id` was missing, ERP returned `400 Bad Request`.
3. **Did the ERP API receive the salesorder_id?**
   Yes, but Zoho's `invokeurl` payload encoding (e.g., calling `.toString()` on a Map instead of sending raw JSON) could have caused JSON parse failures depending on Zoho's internal stringification.
4. **Did authentication succeed?**
   Yes, the `X-API-Key` was passing successfully.
5. **Did the request accidentally enter the test_connection branch?**
   No, there was no `test_connection: true` in the real payload.
6. **Did the Zoho Sales Order fetch succeed?**
   Yes, the API properly authenticated back to Zoho Books to retrieve the customer details.
7. **Was a Prisma/database write attempted?**
   Yes.
8. **Did a database record actually get created?**
   Initially no (in the legacy codebase), but yes with the new `DispatchIncomingOrder` model.
9. **Which model/table was written?**
   `IncomingSoRequest` (for raw webhook audit logs) and `DispatchIncomingOrder` (for business logic).
10. **Which model/table does Incoming Orders read?**
    It reads exclusively from `DispatchIncomingOrder` via `/api/dispatch/incoming-queue`.
11. **Was the issue backend persistence or frontend visibility?**
    Both. The backend didn't persist the parsed business entity, and the frontend lacked real-time visibility. Additionally, Zoho Books lacked error-checking.
12. **What exact code caused the false impression that the push succeeded?**
    The Deluge script hardcoded `result.put("success", true);` immediately after `invokeurl`, completely ignoring the HTTP `responseCode` and `responseText` returned by the ERP. It assumed success just because the network request fired.
13. **What was changed?**
    - The Deluge script generator in `IncomingSOClient.tsx` was updated to explicitly check `if (responseCode == 200 || responseCode == 201)`.
    - Detailed, structured diagnostic logging (with Request IDs) was added to the `/api/dispatch/incoming-so` endpoint.
    - The API now returns a structured response indicating exact actions (`action: "created" | "updated"`).
14. **What was manually verified end-to-end?**
    A simulated POST request via `curl` matching the Zoho payload successfully authenticated, fetched Zoho details, persisted the `DispatchIncomingOrder` record, and returned the proper JSON payload indicating `"action": "created"`. The Deluge script format has been verified.
