# Local Development Changelog

This document tracks significant modifications made to the LOCAL environment of the `kamna-traders-b2b` project to stabilize the Zoho Books integration and improve developer experience.

## Zoho Sales Order Integration Fixes

### Inlined Request Execution
- **Why**: Resolved persistent `Invalid value passed for organization_id` errors caused by inconsistent environment variable resolution across different routes.
- **Change**: Hardcoded the Zoho Books API URL and force-injected the `customer_id` and `salesperson_id` immediately before the `fetch` call in:
    - `src/lib/zoho-auth.ts`
    - `src/app/api/admin/zoho/test-sales-order/route.ts`
- **Modified Files**: `src/lib/zoho-auth.ts`, `src/app/api/admin/zoho/test-sales-order/route.ts`.

### Region Consistency (.in)
- **Why**: The project targets the Indian Zoho region. Using `.com` or mixed domains caused authentication failures.
- **Change**: Standardized all API and Accounts endpoints to `zohoapis.in` and `accounts.zoho.in`.
- **Modified Files**: `src/lib/zoho-auth.ts`, `src/lib/zoho.ts`, `.env`.

### Diagnostics & Visibility
- **Why**: Lack of visibility into final request payloads made debugging difficult.
- **Change**: Added high-visibility console logs (`FETCH URL`, `FETCH BODY`) that print the exact metadata sent to Zoho. Added startup `ZOHO CONFIG` logs.
- **Modified Files**: `src/lib/zoho-auth.ts`, `src/lib/sku-sync.ts`.

## Local Environment & Stability

### Database Isolation
- **Why**: Previous setup used inconsistent/broken connection strings. Local Postgres is more stable for this project.
- **Change**: Configured a local PostgreSQL instance (`kamna_traders_local`) and updated Prisma to use it.
- **Modified Files**: `.env`, `prisma/schema.prisma`.

### SKU Sync Enhancements
- **Why**: Faster local syncing without OAuth overhead.
- **Change**: Implemented support for `ZOHO_CREATOR_SYNC_URL` (Creator Mode) which bypasses standard OAuth for SKU synchronization in local development.
- **Modified Files**: `src/lib/sku-sync.ts`, `src/lib/zoho.ts`, `src/app/api/admin/sku-sync/preview/route.ts`.

### Debug Tooling
- **Why**: Manual verification of Zoho status was tedious.
- **Change**: Enhanced the `/api/debug/zoho-org` endpoint to verify token validity, organization access, and contact accessibility for the default customer.
- **Modified Files**: `src/app/api/debug/zoho-org/route.ts`, `src/app/admin/zoho-debug/page.tsx`.

## Known Temporary Hacks / Cleanup Needed Before Production

> [!CAUTION]
> The following values are currently hardcoded for local verification and **MUST** be refactored back to environment variable resolution before production deployment.

1. **Hardcoded Zoho SO URL**: `https://www.zohoapis.in/books/v3/salesorders?organization_id=60027595766`
2. **Force-Injected Customer ID**: `1759923000000023423`
3. **Force-Injected Salesperson ID**: `1759923000001693003`
4. **Local DB Credentials**: Currently set to standard local Postgres defaults.
