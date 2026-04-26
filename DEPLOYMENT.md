# Production Deployment

This app is a Next.js 16 application with Prisma and PostgreSQL. The repo is already set up for Vercel through `vercel.json`.

## Required Services

- Vercel project connected to this GitHub repository
- Production PostgreSQL database
- AiSensy API key for staff PIN reset messages

## Required Environment Variables

Set these in the production hosting environment:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
POSTGRES_PRISMA_URL="postgresql://USER:PASSWORD@POOLER_HOST:PORT/DATABASE?schema=public"
SUPABASE_POOLER_HOST="aws-0-ap-south-1.pooler.supabase.com"
SESSION_SECRET="generate-a-long-random-secret"
AISENSY_API_KEY="your-aisensy-api-key"
```

For Vercel Postgres or Supabase poolers, `POSTGRES_PRISMA_URL` should be the pooled Prisma-compatible URL. The app and Prisma deploy config prefer `POSTGRES_PRISMA_URL` and fall back to `DATABASE_URL` for local setups.

If `DATABASE_URL` or `POSTGRES_PRISMA_URL` points to Supabase's direct IPv6-only `db.*.supabase.co` host, the app builds a session-pooler URL from `SUPABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DATABASE`. Override `SUPABASE_POOLER_HOST` if the Supabase project is not in `ap-south-1`.

## Vercel Settings

- Framework preset: Next.js
- Install command: `npm ci`
- Build command: `npm run vercel-build`
- Output directory: leave default

`npm run vercel-build` runs:

```bash
prisma generate && prisma migrate deploy && next build
```

## First Production Deploy

1. Create the production PostgreSQL database.
2. Add all required environment variables in Vercel.
3. Deploy from Vercel or run `vercel --prod` from this repo after logging in.
4. Seed initial admin/staff data only if needed:

```bash
npm run db:seed
```

Run seeding against production only from a trusted machine with production env vars loaded. The `/api/dev/seed` endpoint is blocked in production.

## Preflight Checks

```bash
npm ci
npm run lint
DATABASE_URL="..." DIRECT_URL="..." SESSION_SECRET="..." AISENSY_API_KEY="..." npm run build
```

## Production Notes

- Rotate any AiSensy key that may have been committed before this cleanup.
- Change or remove seeded default credentials before exposing the site publicly.
- Keep database backups enabled before running future migrations.
