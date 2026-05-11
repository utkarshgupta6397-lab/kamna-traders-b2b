# Local Development Setup Guide

Follow these steps to restore or setup the local development environment for Kamna Traders B2B.

## 1. Environment Variables
1. Copy `.env.local.example` to `.env.local`.
2. Fill in the required Zoho credentials and database URLs.
3. **DO NOT** commit `.env.local` to version control.

## 2. Local Database
1. Ensure PostgreSQL is running on your machine.
2. Create a database named `kamna_traders_local`.
3. Run Prisma migrations to setup the schema:
   ```bash
   npx prisma migrate dev
   ```
4. (Optional) Seed the database with master data:
   ```bash
   node prisma/seed.js
   ```

## 3. Zoho Books Integration
The local environment is configured for the **Indian region (.in)**.

### Reconnecting Zoho
1. Start the dev server: `npm run dev`.
2. Navigate to `http://localhost:3000/admin/zoho-debug`.
3. Click **"Connect Zoho"**.
4. You will be redirected to Zoho for authorization. Ensure the `organizations.READ` scope is included if prompted.
5. After success, the token is saved in your local database.

### Verifying Connectivity
Use the built-in debug tools:
- **Organization Check**: `http://localhost:3000/api/debug/zoho-org`
- **SKU Preview**: `http://localhost:3000/api/admin/sku-sync/preview`
- **Sales Order Test**: Click **"Create Test Sales Order"** on the Zoho Debug page.

## 4. Troubleshooting
- **Invalid Redirect URI**: Ensure `ZOHO_REDIRECT_URI` in `.env.local` exactly matches `http://localhost:3000/api/zoho/callback` (no trailing slash).
- **Organization ID Error**: Check that `ZOHO_ORGANIZATION_ID` matches your Zoho Books profile.
- **Port Conflicts**: If the server hangs, run `pkill -9 -f "next"` or `killall node`.

## 5. Performance Recommendations
- Use `npx next dev --webpack` for faster local builds if Turbopack is causing overhead.
- Keep `node_modules` clean by running `rm -rf .next` occasionally.
