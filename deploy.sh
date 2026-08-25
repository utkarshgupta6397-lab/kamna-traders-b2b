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
git clean -fd

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

# 4. Out-of-place Next.js Build & Cache Preservation
STEP_START=$SECONDS
echo "4. Preparing out-of-place Next.js build environment..."

rm -rf .next.new || true
mkdir -p .next.new

# if [ -d ".next/cache" ]; then
#     echo "   - Preserving Next.js cache..."
#     cp -a .next/cache .next.new/cache || true
# fi
echo "✓ Cache preparation completed in $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
echo "5. Building Next.js app (out-of-place)..."

if ! NEXT_BUILD_DIR=".next.new" npm run build; then
    echo "❌ Build failed! Deployment aborted."
    echo "   - Production application was NOT affected and remains live."
    rm -rf .next.new || true
    exit 1
fi
echo "✓ Next.js build completed in $((SECONDS - STEP_START))s"
NEXT_BUILD_TIME=$((SECONDS - STEP_START))

# 5. Atomic Activation
STEP_START=$SECONDS
echo "6. Activating new build..."

# Clean up any leftover rollback directories
rm -rf .next.rollback || true

# Perform the fastest possible directory swap (not truly atomic, but <1ms downtime without symlinks)
if [ -d ".next" ]; then
    mv .next .next.rollback
fi
mv .next.new .next

echo "✓ Activation completed in $((SECONDS - STEP_START))s"

# 6. PM2 Reload
STEP_START=$SECONDS
echo "7. Reloading PM2 gracefully..."
if ! pm2 reload kamna --update-env; then
    echo "❌ PM2 reload failed! Restoring previous build..."
    mv .next .next.failed_reload || true
    mv .next.rollback .next || true
    pm2 reload kamna --update-env || true
    exit 1
fi
echo "✓ PM2 reload completed in $((SECONDS - STEP_START))s"

# 7. Health Check and Rollback
STEP_START=$SECONDS
echo "8. Verifying deployment health..."

# Give PM2 a few seconds to start the new workers
sleep 5

if ! curl -f http://localhost:3000/api/health; then
    echo ""
    echo "❌ Health check failed! Initiating automatic rollback..."
    
    # Restore the previous working build
    mv .next .next.failed_health || true
    mv .next.rollback .next || true
    
    echo "   - Reloading PM2 with restored build..."
    if ! pm2 reload kamna --update-env; then
        echo "💥 CRITICAL DEPLOYMENT FAILURE: Rollback PM2 reload also failed!"
        echo "   - The application may be offline."
        exit 1
    fi
    
    sleep 5
    if curl -f http://localhost:3000/api/health; then
        echo "✓ Production successfully restored to previous known-good state."
        echo "❌ Deployment FAILED. (Rolled back safely)."
        exit 1
    else
        echo "💥 CRITICAL DEPLOYMENT FAILURE: Rollback health check also failed!"
        echo "   - The application is likely offline or broken."
        exit 1
    fi
fi

echo "✓ Health check passed in $((SECONDS - STEP_START))s"

# Cleanup
rm -rf .next.rollback || true

echo "======================================"
echo "Deployment completed successfully! ✅"
echo "Total deployment time: $((SECONDS - DEPLOY_START_TIME))s"
echo "Next.js build time: ${NEXT_BUILD_TIME}s"
