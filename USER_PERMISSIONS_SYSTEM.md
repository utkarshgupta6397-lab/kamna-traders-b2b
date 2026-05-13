# User Permissions System (Simplified)

This document describes the streamlined Role-Based Access Control (RBAC) system for Kamna Traders B2B.

## Core Principle
The system is designed to be minimal and operationally focused. It currently manages a single granular permission to control critical warehouse actions while preserving the broad access of administrative users.

## 1. Permissions Model
Located in `src/lib/permissions.ts`.

| Permission Key | Label | Description |
| :--- | :--- | :--- |
| `canManageCarts` | Cart Edit/Delete | Ability to edit items or delete completed carts. |

## 2. Role-Based Overrides
- **ADMIN**: Automatically granted `canManageCarts = true`. This override is enforced at the session retrieval layer (`src/lib/auth.ts`), ensuring administrators cannot be accidentally locked out.
- **STAFF**: Subject to the toggle state in the User Permissions matrix.

## 3. Session Integration
Permissions are fetched once per session lifecycle and cached for 5 minutes in memory on the server (`src/lib/session.ts`).
- **Middleware**: Performs lightweight JWT validation for routing.
- **Layouts/APIs**: Use `getSession()` to access pre-validated permission flags.

## 4. UI Management
Managed at `/admin/user-permissions`.
- Simple table view sorted by User Name/Role.
- Admin users show a fixed "Full Access" status.
- Staff users have a single toggle for `canManageCarts`.

## 5. Security Enforcements
The permission check is enforced at both the UI layer (hiding buttons) and the API layer (`src/app/api/staff/carts/[id]/route.ts`).
