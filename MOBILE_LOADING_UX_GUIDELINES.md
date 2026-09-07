# Mobile Loading UX Guidelines
**Kamna Traders B2B ERP — Engineering & Design Standard**
*Version: 1.0.0 — September 2026*

---

## Executive Summary

In a high-utility ERP application accessed via mobile networks, loading perception directly impacts user confidence and operational speed. Blank screens, generic full-screen spinners, or sudden layout shifts make the system feel slow or unresponsive.

This document establishes the official standard for **every current and future mobile route and interactive component** in the Kamna B2B ERP mobile suite.

---

## 1. The Three-Level Loading Architecture

Every mobile experience must address loading at three distinct levels:

```
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 1: Route / Navigation Loading (Route Transitions)      │
│  • Instant tactile tap response on trigger                  │
│  • loading.tsx skeleton matching destination layout         │
│  • NextTopLoader route progress indicator at the top        │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 2: Page / Dynamic Data Loading (Async Fetching)       │
│  • Skeleton placeholders matching final card/table geometry │
│  • aria-busy="true" on loading containers                   │
│  • Strict separation of Loading vs. Empty vs. Error states  │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 3: Action / Mutation Loading (Buttons, Forms, Upload) │
│  • Dimension-locked buttons with inline micro-spinner       │
│  • Prevent duplicate taps (disabled during isPending)       │
│  • Localized refresh feedback without wiping current data   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. When to Create `loading.tsx`

Next.js App Router relies on `loading.tsx` to automatically wrap page components in React `<Suspense>` boundaries during server-side navigation.

### Rules:
1. **Every page route** under `src/app/mobile/**` MUST have a co-located `loading.tsx` file if it performs server-side data fetching (Prisma, Zoho sync, service calls) or renders client-side API loaders.
2. The `loading.tsx` file MUST render the standard mobile top header with the appropriate title and back chevron, followed by the page-specific skeleton.
3. The skeleton MUST closely replicate the destination screen's geometry (header height, KPI count, card borders, and list dimensions).

### Checklist for `loading.tsx`:
- [ ] Uses sticky navy header (`#1A2766`, height `56px`, safe-area-inset-top padding).
- [ ] Renders realistic KPI summaries and card placeholders with `animate-pulse` and `bg-slate-200`.
- [ ] Wrapped within standard mobile max-width container (`max-w-[430px] mx-auto w-full`).
- [ ] Does not include artificial `setTimeout` or delays.

---

## 3. When to Use Client-Side Skeleton State

When a page fetches data on the client (e.g. `useEffect`, search input, tab switch):
1. **Initial load**: Show a full skeleton matching the expected content rather than a generic spinner.
2. **Subsequent filter/search**: Maintain existing content if reasonable, or render a localized skeleton in the results container.
3. **Always set `aria-busy="true"`** on the loading container to ensure screen-reader accessibility.

---

## 4. How to Handle Refresh vs. Initial Loading

### The Golden Rule:
> **Never wipe the entire screen into a blank skeleton during a user-triggered refresh.**

1. **Initial Page Load**:
   - Data is null/empty: Render the full-screen structural skeleton.
2. **User Refresh (e.g. "Refresh All", "Pull-to-refresh", Refresh icon)**:
   - Keep current data visible on screen.
   - Spin the refresh button icon (`animate-spin`).
   - Disable the refresh trigger to prevent duplicate requests.
   - Update data in place when the API responds.

---

## 5. How to Handle Search Loading

Search experiences must never feel frozen or unresponsive:
1. **Debounce inputs** (200ms–400ms) to prevent server flooding.
2. **Show an inline spinner** inside the search input box (`right-3 top-1/2 -translate-y-1/2`) while `isSearching` is true.
3. **If results exist**, keep existing results visible with a subtle opacity change or replace the results list with a 3-row skeleton.
4. **If 0 results found**, only transition to the Empty State *after* the request completes.

---

## 6. How to Handle Mutations (Actions)

For actions modifying server state (Release, Approve, Save, Upload, Submit, Delete):
1. **Prevent Duplicate Submissions**: Disable the button immediately on tap (`disabled={isSubmitting}`).
2. **Preserve Button Dimensions**: Do not let the button collapse or jump when showing a spinner.
   - Use `flex items-center justify-center gap-2`.
   - Replace or accompany text with a mini spinner (`w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin`).
3. **Provide Success/Error Toast**: Always display feedback via `toast.success` or `toast.error`.
4. **Restore State**: In the `finally` block, reset the loading boolean so the control unlocks on failure.

---

## 7. How to Handle Images & Remote Assets

Remote photos (e.g. truck photos, product pictures) must never display broken gaps or layout jumps:
1. Use a wrapper component like `MobileTruckImageThumbnail`.
2. Display a subtle skeleton placeholder (`bg-slate-200 animate-pulse` with icon) until `onLoad` triggers.
3. Transition smoothly (`opacity-0` to `opacity-100` with `duration-200`).
4. In case of network failure, render a clean error state (`ImageOff` icon with "Failed" badge) rather than browser-default broken image icons.

---

## 8. Strict Separation of States

Every async mobile view MUST implement four distinct states:

| State | Condition | Visual Treatment |
|---|---|---|
| **Loading** | Initial request pending | Structural skeleton matching final geometry (`animate-pulse`) |
| **Success** | Data received & count > 0 | Real ERP data cards / tables with interactive controls |
| **Empty** | Data received & count === 0 | Friendly icon (CheckCircle, Package, Truck) + clear guidance text |
| **Error** | API / network error | Clean alert box with "Try Again" / retry action button |

**Anti-pattern to avoid**: Never show "No records found" while the request is still in flight.

---

## 9. Reusable Mobile Skeleton Primitives

The codebase provides shared skeleton primitives in `src/components/mobile/skeleton/MobileSkeleton.tsx`:

- `<MobileSkeleton />`: Base shimmer box with configurable `rounded` and `className`.
- `<MobileHeaderSkeleton title="..." />`: Sticky navy ERP header skeleton.
- `<MobileKpiGridSkeleton columns={2|3|4} count={N} />`: KPI summary card grid.
- `<MobileCardSkeleton lines={2|3} />`: Standard mobile ERP module card skeleton.
- `<MobileTruckImageThumbnail />`: Dedicated image loader with skeleton and error fallback.

Use these primitives when assembling skeletons for new mobile features.

---

## 10. What NOT to Do

1. ❌ **Do NOT add artificial delays (`setTimeout`)** just to make a skeleton visible. Loading indicators must reflect genuine state.
2. ❌ **Do NOT show a full-screen blocking spinner** for simple card or route navigation.
3. ❌ **Do NOT change permission, authentication, or business logic** when implementing loading UI.
4. ❌ **Do NOT let skeletons cause layout shift (CLS)**. Skeletons should match the height, width, and padding of the final elements.
5. ❌ **Do NOT forget `aria-busy="true"` and `aria-hidden="true"`** on loading placeholders.
