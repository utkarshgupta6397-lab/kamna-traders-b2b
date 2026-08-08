# Catalog Sync - Phase 4: Deterministic Synchronization

This document outlines the finalized synchronization algorithm designed to prevent unique constraint violations and enforce idempotency while preserving Master Data ownership.

## Core Principles
1. **Product & ProductVariant** are the undisputed masters of truth.
2. **Sku** is a backwards-compatibility integration layer.
3. **Idempotency**: Running a sync operation 100 times must yield the exact same result as running it once.
4. **No Crashes**: If a record cannot be synced due to a unique constraint violation (e.g. duplicate Zoho ID), it is skipped and marked as a **Conflict** rather than halting the entire engine.

## Product → SKU Sync Algorithm

**Trigger**: Executed when pushing new/updated Products to the legacy Sku table.

1. Fetch all `ProductVariant` (master) and `Sku` (target) records.
2. Build an active map of all claimed `zohoBookItemId`s in the `Sku` table (`zohoIdToSkuId`).
3. Iterate through every `ProductVariant`:
   - Compute `desiredValues` (Name, Price, Category, Zoho ID, etc).
   - If `Sku` does not exist:
     - Check if `desiredZohoId` is claimed by another `Sku` in `zohoIdToSkuId`.
     - **Conflict**: If yes, flag as Conflict and skip.
     - **Create**: If no, insert new `Sku`.
   - If `Sku` exists:
     - Compare `desiredValues` with current `Sku` values.
     - If updates are needed, check `desiredZohoId` against `zohoIdToSkuId` to ensure it's not claiming a Zoho ID belonging to a different `Sku`.
     - **Conflict**: If yes, flag as Conflict and skip.
     - **Update**: If no, update existing `Sku`.
     - **Skip**: If no changes needed, mark as up-to-date.

## SKU → Product Sync Algorithm

**Trigger**: Executed when pulling legacy data or migrating old SKUs into the new Catalog format.

1. Fetch all `Sku` (master for migration) and `ProductVariant` (target) records.
2. Build an active map of all claimed `zohoBookItemId`s in the `ProductVariant` table (`variantZohoMap`).
3. Build an active map of variants keyed by `sku` (`variantMap`).
4. Iterate through every `Sku`:
   - Lookup existing `ProductVariant` using `sku` string matching.
   - If `ProductVariant` does not exist:
     - Check if the Sku's `zohoBookItemId` is already claimed by a DIFFERENT `ProductVariant` via `variantZohoMap`.
     - **Conflict**: If yes, flag as Conflict and skip.
     - **Create**: If no, create a new `Product` and `ProductVariant` to represent this legacy Sku.
   - If `ProductVariant` exists:
     - Determine if Zoho-owned fields (e.g., `zohoBookItemId`, `isActive` if enabled) need updating.
     - If `zohoBookItemId` is changing, check against `variantZohoMap` to prevent unique constraint crashes.
     - **Conflict**: If yes, flag as Conflict and skip.
     - **Update**: If no, update the `ProductVariant`.
     - **Skip**: If no changes needed, mark as up-to-date.

## Handling Conflicts
When a conflict is detected in the UI preview, the row will display:
- **Action**: `Conflict`
- **Details**: Explanation of the conflict (e.g. `Zoho ID X is already claimed by Variant Y`)
- **Suggested Action**: A human-readable step to resolve the conflict, which usually involves manually un-binding the Zoho ID from the legacy/stale record.
