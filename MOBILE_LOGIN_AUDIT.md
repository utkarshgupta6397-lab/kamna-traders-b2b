# Forensic Audit of KAMNA ERP Mobile UI & Mobile Login Flow

**Audit Date:** 2026-09-04  
**Working Branch:** `dev-2` (`f6251c0aee7a82565476db989baff0a63ceeda88`)  
**Reference Branch:** `main` (`1dac7dbb8ffc49087651f8e1f6550084d6c55db0`)  
**Merge Base:** `f5ae94630e4c998f286b8573bf3a40752b026571`  

---

## 1. Executive Summary & Root Cause Confirmation

The mobile login failure in the real browser was caused by two compounding issues:

1. **Next.js Dev Server LAN Origin Filtering Blocked Client Hydration:**
   - In `next.config.ts` on `dev-2`, `allowedDevOrigins` was statically declared without the active LAN IP (`192.168.29.227`), whereas `main` dynamically resolved interface IPs (`...getLanIps()`).
   - Consequently, when mobile devices accessed `http://192.168.29.227:3000`, the browser rejected the Next.js Dev/HMR socket connection (`ERR_INVALID_HTTP_RESPONSE`).
   - This aborted React client component hydration (`__reactFiber` and event listeners were never attached to the DOM).
   - Because the React bundle never hydrated, all controlled input bindings and `onSubmit` / `onClick` handlers were dead. Clicking "Sign In" either did nothing (if disabled in initial SSR) or triggered a native HTML GET submission which leaked `?mobile=...&pin=...` into the URL query string.

2. **Mobile Input Length Constraints and Silent Validation Traps:**
   - In `main`, `src/app/mobile/login/page.tsx` lacked `maxLength={10}` on `#mobile`.
   - `main` used `e.target as HTMLFormElement`, which resolved to the `<button>` on mobile touch taps, returning `null` on `form.querySelector('#mobile')` and triggering an unhandled silent `return;` with zero network requests and zero error feedback.
   - The button remained enabled even when empty, only to fail silently on click.

3. **Desktop Telemetry / DevConsole Floating Overlays:**
   - `DevConsole.tsx` and `TelemetryOverlay.tsx` on `dev-2` had lost their `if (pathname?.startsWith('/mobile')) return null;` guard that was present on `main`, floating over mobile layouts.

---

## 2. File-by-File Status & Comparison Matrix

| Path | `main` Status | `dev-2` / Working Tree | Status / Classification |
|---|---|---|---|
| `next.config.ts` | Uses dynamic `getLanIps()` | Was missing dynamic LAN IPs | **Fixed / Restored from `main`**. Solved the root hydration failure. |
| `src/app/mobile/login/page.tsx` | Missing `maxLength={10}`, has `e.target` bug, silent `return` | Controlled state + `maxLength={10}` + `canSubmit` validation | **Fixed**. Strict DOM limit, `e.currentTarget`, visible error handling. |
| `src/app/mobile/layout.tsx` | Contains PWA metadata, `InstallBanner`, `HideDevUI` | Identical to `main` | **Verified in parity**. |
| `src/app/mobile/(app)/layout.tsx` | Server-side `getSession()` guard, redirects to `/mobile/login` | Identical to `main` | **Verified in parity**. Dedicated Mobile UI sandbox. |
| `src/app/mobile/(app)/page.tsx` | Mobile ERP dashboard (Operations & Accounts modules) | Identical to `main` | **Verified in parity**. |
| `src/components/dev/TelemetryOverlay.tsx` | Hidden on `/mobile` | Restored guard | **Fixed / Restored from `main`**. |
| `src/components/debug/DevConsole.tsx` | Hidden on `/mobile` | Restored guard | **Fixed / Restored from `main`**. |
| `src/lib/auth.ts` | `secure: process.env.NODE_ENV === 'production'` | `secure: !!isSecure \|\| !!process.env.HTTPS_LOCAL` | **Fixed**. Allows session cookie over HTTP LAN IP. |
| `src/app/api/auth/renew/route.ts` | `secure: process.env.NODE_ENV === 'production'` | Same LAN HTTP cookie fix | **Fixed**. |
| `src/app/staff/**` | Desktop staff portal | Intact & unaffected | **Verified segregated**. |

---

## 3. Login Flow Architecture

```
User accesses: http://192.168.29.227:3000/mobile
        │
        ▼
Mobile App Layout Guard: src/app/mobile/(app)/layout.tsx
        │ (Unauthenticated)
        ▼
Redirect 307: /mobile/login
        │
        ▼
Mobile Login Client: src/app/mobile/login/page.tsx
  - Next.js successfully hydrates (dynamic LAN origins permitted)
  - Mobile input: digits only, hard-limited to 10 via onChange and maxLength
  - PIN input: digits only, hard-limited to 6 via onChange and maxLength
  - canSubmit = /^\d{10}$/.test(mobile) && /^\d{6}$/.test(pin) && !loading
  - Sign In button remains disabled until canSubmit === true
        │
        ▼
User clicks enabled "Sign In"
  - e.preventDefault() prevents URL query string pollution
  - POST /api/auth/login with JSON body { mobile, pin }
  - Server sets HttpOnly cookie "session", returns { success: true }
  - Client navigates to /mobile
        │
        ▼
Dedicated Mobile ERP Dashboard: src/app/mobile/(app)/page.tsx
  - Validates session
  - Renders "KAMNA ERP" header and Operations / Accounts modules
```
