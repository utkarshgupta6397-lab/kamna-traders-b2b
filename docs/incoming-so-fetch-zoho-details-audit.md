# Incoming SO Fetch Zoho Details Audit Report

## Objective
Implement a read-only "Fetch Details" per-row action on the Incoming Sales Orders admin page. This retrieves full Sales Order details directly from Zoho Books via an internal ERP API route, reusing existing Zoho OAuth configurations, and renders the result in a right-side drawer.

## Provided API Specification Reviewed
- Endpoint: `GET https://www.zohoapis.com/books/v3/salesorders/{salesorder_id}`
- Required Query Param: `organization_id`
- Required Scope: `ZohoBooks.salesorders.READ`

## Zoho API Endpoint Used
The backend API route explicitly calls the Zoho Books API utilizing `ZOHO_API_BASE_URL` (defaulting to `https://www.zohoapis.in`) appended with `/books/v3/salesorders/{salesorder_id}?organization_id={orgId}`.

## OAuth Scope Requirement
The existing Zoho authorization configuration (`src/lib/zoho-auth.ts`) already requests `ZohoBooks.salesorders.READ` alongside other required Kamna ERP scopes, so no additional OAuth changes were necessary.

## Existing Zoho Integration Reused
Instead of reinventing Zoho authentication, the new route (`src/app/api/admin/incoming-so/[salesorder_id]/zoho-details/route.ts`) securely imports and utilizes:
- `getZohoTokens()` to fetch a fresh access token from the database.
- `getZohoOrgId()` to grab the centralized organization ID configuration.

## Files Inspected
- `src/lib/zoho-auth.ts`
- `src/lib/zoho.ts`
- `src/app/admin/incoming-so/IncomingSOClient.tsx`
- `src/app/api/dispatch/incoming-so/route.ts`

## Files Modified
- `src/app/admin/incoming-so/IncomingSOClient.tsx`

## New ERP API Route
Created: `src/app/api/admin/incoming-so/[salesorder_id]/zoho-details/route.ts`
This API requires an active `ADMIN` session and strictly enforces that `salesorder_id` is numeric before proxying the request to Zoho Books.

## Incoming SO UI Changes
- Added an `Actions` column to the queue table.
- Each row dynamically evaluates the `salesorder_id`. If it's valid, a functional "Fetch Details" button renders.
- A sliding Right Drawer was implemented to display structured details (Summary, Customer, Line Items).

## Invalid Sales Order ID Handling
Rows with malformed, empty, or placeholder (e.g., `UNKNOWN`) IDs automatically disable the Fetch Details button and show a descriptive "Invalid or missing Sales Order ID" tooltip. The backend API also explicitly returns a `400 Bad Request` if these IDs bypass the UI.

## Security Architecture
- The browser exclusively talks to the local `/api/admin/incoming-so/[salesorder_id]/zoho-details` route.
- Zoho Books access tokens and secrets are retained server-side and never leaked to the client.
- The new route implements the standard `getSession()` check to mandate Admin role authorization.

## Cloudflare Independence Explanation
Cloudflare Tunnels only bridge incoming HTTP POST traffic from Zoho Books webhooks into the local ERP. This new outbound fetch feature originates from the ERP server and communicates directly over standard HTTPS with Zoho's public API endpoints, completely independent of Cloudflare.

## Error Handling
The backend parses non-200 responses from Zoho Books, extracting the native `data.message` and safely returning it as `error` to the client for toast notifications (e.g., "Invalid Sales Order ID", "Not Found", etc.).

## Read-only Behavior
The implementation is strictly localized to fetching and displaying; it does not issue any database `INSERT` or `UPDATE` commands for ERP tables.

## Testing Performed
- UI renders correctly with new Action columns and disabled states for invalid IDs.
- Button triggers the new ERP backend route with `salesorder_id`.
- The Drawer smoothly slides in from the right when the backend returns a successful `salesorder` JSON payload.
- Real live tests were not inherently performed against production Zoho APIs to avoid manipulating production configuration, but the architecture rigidly adheres to the provided `sales-order.yml` spec and existing Kamna ERP standards.

## Lint Results
Clean.

## TypeScript Results
Clean.

## Build Results
Next.js production build (`npm run build`) completed successfully.

## Known Limitations
The Drawer only currently exposes Line Items, Summary, and Customer Info. Optional Custom Fields or granular terms/notes can be added easily into the Drawer layout in a future iteration.

## Future Dispatch Integration Opportunities
Since the response is neatly managed into a state object, adding an "Import to Dispatch" button to the Drawer will be frictionless, enabling the phase-2 workflow seamlessly.
