# Kamna Traders B2B - AI Context & Documentation

> **Note to future AIs (Claude, Gemini, ChatGPT, Cursor, etc.):** 
> If you are reading this file, you have been instantiated to work on the Kamna Traders B2B platform. Read this entire document carefully before making structural changes.

## 1. Project Overview
Kamna Traders is a B2B ordering and wholesale point-of-sale (POS) terminal built for maximum speed and industrial efficiency. It is designed to allow warehouse staff and B2B customers to rapidly scan, search, and queue industrial SKUs (Solar Panels, Inverters, Lithium Batteries, Electrical Equipment) into a dispatch/cart system. 

It is intentionally designed **not** to look like a standard B2C ecommerce store, but rather a professional, high-density industrial dashboard.

## 2. Tech Stack
*   **Framework**: Next.js 16.2.4 (App Router)
*   **Database**: Supabase PostgreSQL
*   **ORM**: Prisma (`v6.19.3`)
*   **Styling**: Tailwind CSS (v4)
*   **Icons**: Lucide React
*   **State Management**: Zustand (`src/store/cartStore.ts`)
*   **Deployment**: Vercel

## 3. Architecture & Core Layouts
The UI is strictly locked into a **3-column rigid grid** to prevent layout shifting and maximize horizontal real estate:
1.  **Left Sidebar (220px)**: Sticky Categories list.
2.  **Center Console (Fluid)**: The Product Grid. Uses a 148px fixed-height industrial card (`ProductCard.tsx`).
3.  **Right Sidebar (320px)**: Sticky Dispatch Bin / Cart Panel (`CartPanel.tsx`). Uses high-density 42px row heights.

*Colors*: The platform uses `#F6F7FA` for background depth, `#E7EAF0` for borders, `#1A2766` for primary brand accents, and `#25D366` for WhatsApp integration.

## 4. Key Workflows
*   **Speed Mode**: Implemented in `StaffHomeClient.tsx`. Pressing `/` globally focuses the search bar. Arrow keys (`ArrowUp`, `ArrowDown`) navigate the product grid, and `Enter` instantly adds the highlighted item to the dispatch bin.
*   **Data Strategy**: To prevent stale price data on B2B orders, the `ProductCard` disables adding items to the cart if they are marked `isOos` (Out of Stock), and the system relies on real-time database queries on page load.
*   **WhatsApp Integration**: The right cart sidebar generates a formatted URL-encoded WhatsApp message with the order details, which is sent to the central business number.

## 5. Database Schema (Prisma)
*   **Models**: `User` (Staff), `Warehouse`, `Category`, `Brand`, `Sku`, `WarehouseInventory`, `Cart`, `CartItem`, `CustomerLead`.
*   **Important Details**: `Sku` has fields like `moq` (Minimum Order Quantity) and `stepQty` (The interval by which quantity increases per click). The database was recently migrated from local SQLite to Supabase Postgres.

## 6. Known Deployment Quirks (Vercel + Supabase)
*   Vercel serverless functions operate on **IPv4 only**. Supabase direct connection strings (`db.[ref].supabase.co:5432`) are often IPv6.
*   Therefore, Vercel deployments **must** use the Supabase Connection Pooler (`aws-0-[region].pooler.supabase.com:6543`) for the `DATABASE_URL` to successfully connect. 
*   Prisma migrations (`DIRECT_URL`) can still use the direct IPv6 string if run locally.

---
*Created on: April 26, 2026. Please append new major architectural decisions to this file.*
