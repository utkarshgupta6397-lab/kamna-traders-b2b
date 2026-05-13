# AUTH PERFORMANCE AUDIT: Kamna Traders B2B Production

## Current Architecture
*   **Infrastructure**: Vercel (Frontend/API) + Supabase (PostgreSQL).
*   **Region Deployment**:
    *   **Vercel Functions**: `iad1` (Washington, D.C., USA).
    *   **Supabase Database**: `ap-south-1` (Mumbai, India).
*   **Authentication**: JWT-based with server-side `ActiveSession` validation.
*   **Database Client**: Prisma (Singleton pattern implemented).

## Request Lifecycle (Virginia -> Mumbai)
The current region mismatch imposes a **~240ms baseline RTT** (Round Trip Time) for every single network packet sent between the API and the Database.

1.  **Middleware (Edge)**: JWT decode only. (Fast, <30ms).
2.  **Server Layout (Node)**: Calls `getSession()`.
    *   Cold Start + TCP/SSL/PG Handshake: **~900ms - 1200ms**.
    *   Query Execution: **~240ms**.
3.  **Page/Component (Node)**: Often calls `getSession()` again.
    *   Redundant Query: **~240ms** (No memoization).
4.  **Actual Page Logic**: Executes primary data query.
    *   Query Execution: **~240ms**.
5.  **Total Observed Latency**: **~1.5s - 2.5s**.

## Auth Validation Flow Analysis
*   **Non-Memoized `getSession`**: The `getSession` function in `src/lib/auth.ts` does not use `React.cache`. In a typical Next.js request, this results in multiple serial roundtrips to Mumbai just to verify the same token.
*   **Strict Validation**: Every page load performs a `prisma.activeSession.findUnique` lookup. While safe, the 240ms penalty makes this extremely expensive.

## Heartbeat System Analysis
*   **Status**: Decommissioned.
*   **Finding**: High-frequency database writes to `lastSeenAt` have been removed. Slowness is now confirmed as **Read Latency** and **Connection Acquisition** overhead rather than write contention.

## ActiveSession Analysis
*   **Lookup Strategy**: Uses `@unique` index on `sessionToken`.
*   **Overhead**: Validation is strictly read-only, but it is synchronous and blocking for all protected routes.
*   **Concurrency**: Multiple concurrent user requests do not cause locking, but the total connection count is higher than necessary due to slow query completion.

## Prisma Architecture Audit
*   **Singleton Status**: Active. `globalThis.prisma` is used.
*   **Anti-Pattern**: While the client is a singleton, the serverless environment frequently cold-starts or recycles processes, leading to high "Connection Acquisition" times (~1.1s) in the logs.
*   **Instrumentation**: `[Forensic] SLOW DB ROUNDTRIP` logs confirm that query execution is fast (~240ms) but the path from function to DB is the primary lag source.

## Database Connection Audit
*   **Pooled URL**: Configured with `pgbouncer=true`.
*   **SSL**: Required.
*   **Hypothesis**: The pooling helps with connection count, but doesn't solve the laws of physics regarding the 13,000km distance between Virginia and Mumbai.

## SKU Sync Performance Audit
*   **Critical Bottleneck**: The `runSkuSync` logic executes in a sequential `for` loop.
*   **Math of Failure**:
    *   ~7-10 roundtrips per SKU (Upserts for Brand/Category + Registry checks + Persistence verification).
    *   10 queries * 240ms = **2.4 seconds per SKU**.
    *   A sync of 100 SKUs takes **4 minutes**, during which the Node.js function is held open, risking Vercel timeouts.

## Root Cause Hypotheses

| Hypothesis | Confidence | Impact |
| :--- | :--- | :--- |
| **Region Mismatch (Virginia vs Mumbai)** | 100% | **SEVERE**. Adds 240ms to every DB hit. |
| **Lack of Auth Memoization** | 90% | **HIGH**. Compounds RTT penalty 2-3x per request. |
| **Sequential Sync Processing** | 100% | **SEVERE**. Makes large-scale updates impossible. |
| **Serverless Connection Churn** | 80% | **MEDIUM**. Causes the ~1.1s spikes on first request. |

## Most Likely Primary Bottleneck
**Cross-Continent Network Latency (RTT)**.
Every request is paying a "tax" of 240ms per database query. When combined with non-memoized auth validation and sequential sync logic, the latency scales linearly to 2.5s+.

## Recommended Fixes (High Level)
1.  **Move Vercel Region**: Change Vercel Function region to `sin1` (Singapore) or `bom1` (Mumbai) to match Supabase.
2.  **Memoize Auth**: Wrap `getSession` in `React.cache` to ensure 1 DB hit per request.
3.  **Parallelize Sync**: Refactor `runSkuSync` to use `Promise.all` or batch operations to minimize sequential roundtrips.
4.  **Lightweight Auth**: Consider a "Stale-While-Revalidate" approach for session validation (e.g., validate every 5 mins instead of every request).

## Risk Assessment
*   **Auth Refactor**: Low risk if signature is still verified at the Edge.
*   **Region Move**: Medium risk for users currently closer to Virginia (unlikely for this project).
*   **Parallel Sync**: High risk of DB connection exhaustion if batches are too large.

## Production Deployment Considerations
*   Changing Vercel regions requires a redeploy and may affect other integrated services.
*   Parallel sync should be implemented with a concurrency limit (e.g., `p-limit`).
