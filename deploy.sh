#!/bin/bash
set -e

DEPLOY_START_TIME=$SECONDS

echo "Starting deployment pipeline..."
echo "======================================"

# 1. Fetching Code
STEP_START=$SECONDS
echo "1. Fetching latest code..."

# Capture current hashes to check for changes
CURRENT_PKG_HASH=$(sha1sum package.json package-lock.json 2>/dev/null | sha1sum | awk '{print $1}') || true
CURRENT_PRISMA_HASH=$(sha1sum prisma/schema.prisma 2>/dev/null | awk '{print $1}') || true

git fetch origin
git reset --hard origin/main

NEW_PKG_HASH=$(sha1sum package.json package-lock.json 2>/dev/null | sha1sum | awk '{print $1}') || true
NEW_PRISMA_HASH=$(sha1sum prisma/schema.prisma 2>/dev/null | awk '{print $1}') || true

echo "✓ Git step completed in $((SECONDS - STEP_START))s"

# 2. Dependencies
STEP_START=$SECONDS
NPM_INSTALL_RAN=false

if [ "$CURRENT_PKG_HASH" != "$NEW_PKG_HASH" ]; then
    echo "2. Installing dependencies (package.json changed)..."
    npm install
    NPM_INSTALL_RAN=true
    echo "✓ npm install completed in $((SECONDS - STEP_START))s"
else
    echo "2. Skipping npm install (package.json unchanged)."
fi

# 3. Prisma
STEP_START=$SECONDS
if [ "$NPM_INSTALL_RAN" = true ]; then
    echo "3. Prisma generate skipped (already ran via postinstall)."
elif [ "$CURRENT_PRISMA_HASH" != "$NEW_PRISMA_HASH" ]; then
    echo "3. Generating Prisma client (schema changed)..."
    npx prisma generate
    echo "✓ Prisma generate completed in $((SECONDS - STEP_START))s"
else
    echo "3. Skipping Prisma generate (schema unchanged)."
fi

STEP_START=$SECONDS
echo "3b. Pushing Prisma schema to DB..."
npx prisma db push --accept-data-loss
echo "✓ Prisma db push completed in $((SECONDS - STEP_START))s"

# 4. Next.js Build
echo "4. Backing up old production build..."
cp -r .next .next.backup || true
pkill -f "next build" || true
rm -rf .next

STEP_START=$SECONDS
echo "5. Building Next.js app..."
if ! npm run build; then
  echo "❌ Build failed! Restoring old production build..."
  rm -rf .next
  mv .next.backup .next || true
  exit 1
fi
rm -rf .next.backup
echo "✓ Next.js build completed in $((SECONDS - STEP_START))s"

# 5. PM2 Reload
STEP_START=$SECONDS
echo "6. Reloading PM2 gracefully..."
pm2 reload kamna --update-env
echo "✓ PM2 reload completed in $((SECONDS - STEP_START))s"

# 6. Health Check
STEP_START=$SECONDS
echo "7. Verifying deployment health..."
sleep 5
curl -f http://localhost:3000/api/health
echo "✓ Health check completed in $((SECONDS - STEP_START))s"

echo "======================================"
echo "Deployment completed successfully! ✅"
echo "Total deployment time: $((SECONDS - DEPLOY_START_TIME))s"

