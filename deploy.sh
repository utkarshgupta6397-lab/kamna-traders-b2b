#!/bin/bash

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Building Next.js app..."
npm run build

echo "Restarting PM2..."
pm2 restart kamna --update-env

echo "Done!"
