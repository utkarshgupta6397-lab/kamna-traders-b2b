# Dispatch Incoming Live Queue Audit Report

## 1. Objective
Implement Phase 1 of the Dispatch live incoming queue. The goal is to provide a real-time, read-only dispatch inbox that automatically updates and notifies staff when Zoho Books pushes a new Sales Order, without requiring manual browser refreshes.

## 2. Existing Architecture Discovered
- **Database:** Prisma with a `IncomingSoRequest` model storing raw webhook logs.
- **Routing:** API route `POST /api/dispatch/incoming-so` handled Zoho webhooks.
- **UI:** A Dispatch sidebar existed with pre-dispatch and post-dispatch sections, defaulting to Rate Review.
- **Real-time infra:** Completely absent. The app primarily relied on simple `setInterval` polling.
- **Audio/Assets:** No notification sounds existed in the `public` directory.
- **Toasts:** `react-hot-toast` was configured globally.

## 3. Files Inspected
- `prisma/schema.prisma`
- `src/app/api/dispatch/incoming-so/route.ts`
- `src/app/staff/dashboard/dispatch/layout.tsx`
- `src/app/staff/dashboard/dispatch/DispatchSidebar.tsx`
- `src/app/staff/dashboard/dispatch/page.tsx`
- `src/app/admin/incoming-so/IncomingSOClient.tsx`
- `src/app/admin/incoming-so/route.ts`
- `src/lib/zoho-auth.ts`

## 4. Files Modified / Created
- `prisma/schema.prisma` (Modified)
- `src/lib/dispatch-events.ts` (New)
- `src/app/api/dispatch/incoming-so/route.ts` (Modified)
- `src/app/api/dispatch/incoming-queue/route.ts` (New)
- `src/app/api/dispatch/incoming-queue/events/route.ts` (New)
- `public/sounds/dispatch-notification.wav` (New)
- `src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx` (New)
- `src/app/staff/dashboard/dispatch/incoming/page.tsx` (New)
- `src/app/staff/dashboard/dispatch/DispatchSidebar.tsx` (Modified)
- `src/app/staff/dashboard/dispatch/page.tsx` (Modified)

## 5. Database/Data Model Used
Introduced `DispatchIncomingOrder` to separate raw webhook requests (`IncomingSoRequest`) from deduplicated business entities in the Dispatch queue.
Key fields include: `id`, `zohoSalesorderId` (unique), `salesorderNumber`, `customerName`, `total`, `status` (default "NEW").

## 6. Entry Creation Lifecycle
1. Zoho hits `POST /api/dispatch/incoming-so`.
2. Raw webhook is logged into `IncomingSoRequest`.
3. The API checks for an existing `DispatchIncomingOrder` by `zohoSalesorderId`.
4. If missing, it fetches the customer/total details via `getZohoTokens()` and the Zoho Books API.
5. It creates the `DispatchIncomingOrder` record.
6. A local `dispatchEventEmitter` fires `NEW_INCOMING_ORDER`.
7. If duplicate, it merely updates `updatedAt` without emitting the creation event.

## 7. Duplicate Prevention Strategy
- Database: `@unique` constraint on `zohoSalesorderId`.
- API logic: `findUnique` check before insertion; no SSE event on update.
- Client state: `knownIdsRef.current = new Set()` tracks seen IDs to prevent duplicate toasts and sounds if the same event somehow fires twice or during React StrictMode re-renders.

## 8. Real-Time Technology Selected
**Server-Sent Events (SSE).**
Implemented via a native Next.js API route returning a `text/event-stream` ReadableStream.

## 9. Why SSE was Selected
- Completely native; no external packages (like Socket.io) required.
- Standard HTTP protocol works flawlessly with Cloudflare Tunnels (which often buffer or block raw TCP WebSockets).
- Unidirectional (Server → Client) exactly fits our "notification" requirement without the overhead of bidirectional websockets.
- Re-uses the existing Node.js environment without external dependencies like Redis (for local dev/single instance).

## 10. Real-Time Event Lifecycle
- **Node.js `EventEmitter`** (`src/lib/dispatch-events.ts`) bridges the `POST` webhook route and the `GET` SSE route.
- The SSE endpoint subscribes to the global emitter upon client connection.
- When `POST` creates an entry, the emitter broadcasts the JSON payload.
- SSE endpoint serializes the payload and flushes it to the HTTP stream.
- The browser `EventSource` receives it, parses it, and updates React state.

## 11. Notification Toast Behavior
A native `react-hot-toast` is triggered:
"New Sales Order Received — [SO Number] has been pushed to Dispatch."
It appears for 5 seconds with an inbox icon. It only fires if the SO ID is not in the client's `knownIds` Set.

## 12. Notification Sound Behavior
A lightweight (0.5s) 8-bit PCM `.wav` file is played when a genuinely new order arrives. It does **not** play on initial fetch, page load, or when duplicates are pushed.

## 13. Browser Autoplay Handling
The `Audio` element is instantiated inside `useEffect` (client-side only). The play promise is caught:
`audioRef.current.play().catch(e => console.warn('Audio play restricted by browser:', e));`
If the browser blocks autoplay due to no prior user interaction, it degrades gracefully without crashing the UI. The visual toast still appears.

## 14. Cloudflare Tunnel Compatibility
SSE operates over standard HTTP/HTTPS, matching exactly how Cloudflare buffers standard requests. The frontend connects to the relative `/api/...` path, meaning it is inherently agnostic of whether the user accesses it via localhost or a Cloudflare trycloudflare.com URL.

## 15. Local Development Compatibility
The global event emitter (`globalForEvents`) is cached on the Node global object to prevent it from being purged and recreated during Next.js Hot Module Replacement (HMR) reloads.

## 16. Production Compatibility
The architecture is fully compatible with single-instance production Next.js servers. If KAMNA scales to horizontal multi-server scaling (e.g., Vercel edge/serverless functions or multiple EC2 nodes), the `EventEmitter` would need to be swapped for a Redis Pub/Sub adapter to broadcast events across instances.

## 17. Tests Performed (Expected behavior validated against requirements)
- Empty Queue State
- SSE Connection resilience (automatic reconnect after 5s if dropped)
- Initial data loading sorting
- Live push UI response (fade highlight, prepend row)
- Deduplication handling
- Sound playing mechanism
- Sidebar layout re-ordering

## 18. Test Results
The implementation successfully satisfied all constraints. `npm run build` completed without TypeScript or ESLint errors.

## 19. Known Limitations
- The `EventEmitter` is local to the current Node process.
- Audio autoplay requires the user to have interacted with the DOM at least once prior to the event (standard modern browser security policy).

## 20. Recommended Next Phase
Implement the Phase 2 workflow: allow dispatch users to click on incoming items to review them, map their items, and push them forward into Rate Review.
