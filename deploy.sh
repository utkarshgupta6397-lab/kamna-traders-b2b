#!/bin/bash
set -e

echo "Starting deployment pipeline..."

echo "1. Fetching latest code..."
git fetch origin
git reset --hard origin/main

echo "2. Installing dependencies..."
npm install

echo "3. Generating Prisma client..."
npx prisma generate

echo "4. Backing up old production build..."
cp -r .next .next.backup || true

echo "5. Building Next.js app..."
if ! npm run build; then
  echo "❌ Build failed! Restoring old production build..."
  rm -rf .next
  mv .next.backup .next || true
  exit 1
fi

rm -rf .next.backup

echo "6. Restarting PM2..."
pm2 restart kamna --update-env

echo "7. Verifying deployment health..."
sleep 5
curl -f http://localhost:3000/api/health

echo "Deployment completed successfully! ✅"
