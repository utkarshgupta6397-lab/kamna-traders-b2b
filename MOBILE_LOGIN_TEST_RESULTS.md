# Real Runtime Test Results: Mobile Login & UI Flow

**Test Environment:** Real Chromium browser via automated viewport emulation (iPhone 14, 390x844 touch)  
**Server Instance:** Next.js Dev Server binding on `0.0.0.0:3000` (PID: 4511)  
**Tested URLs:**
- `http://192.168.29.227:3000/mobile`
- `http://192.168.29.227:3000/mobile/login`  

---

## 1. Test Matrix Execution Results

| Test Scenario | Input Action | Observed Runtime Behavior | Status |
|---|---|---|---|
| **1. Unauthenticated Route Access** | Visit `/mobile` | HTTP 307 Redirect to `/mobile/login` | **PASS** |
| **2. Initial Page Load State** | Page loaded, inputs empty | `button.disabled === true` | **PASS** |
| **3. Partial Mobile Input** | Enter 5 digits (`12345`) | `button.disabled === true` | **PASS** |
| **4. Full Mobile, Empty PIN** | Enter 10 digits (`1234567890`), PIN empty | `button.disabled === true` | **PASS** |
| **5. Overlength Mobile Typing** | Attempt to type 15 digits (`123456789099999`) | Value truncated/hard-capped to 10 (`1234567890`) | **PASS** |
| **6. Partial PIN Input** | Mobile valid (10), PIN 3 digits (`000`) | `button.disabled === true` | **PASS** |
| **7. Overlength PIN Typing** | Attempt to type 11 digits (`00000099999`) | Value truncated/hard-capped to 6 (`000000`) | **PASS** |
| **8. Valid Credentials Enablement** | Mobile: `1234567890`, PIN: `000000` | `button.disabled === false` immediately | **PASS** |
| **9. Click Sign In Submission** | Click button when enabled | React handler executed, `e.preventDefault()` called | **PASS** |
| **10. Network Transaction** | Inspect Network tab | Exactly one `POST /api/auth/login` sent | **PASS** |
| **11. URL Security** | Inspect browser address bar | URL remains clean; NO query parameters leaked | **PASS** |
| **12. Cookie & Session Storage** | Inspect browser storage | `session` cookie stored (`Path=/`, `HttpOnly; SameSite=lax`) | **PASS** |
| **13. Post-Login Navigation** | Await router transition | Navigates to `http://192.168.29.227:3000/mobile` | **PASS** |
| **14. Authenticated Mobile Dashboard**| Render dashboard | Displays "KAMNA ERP", "Hello, Dummy", Operations & Accounts | **PASS** |

---

## 2. Network Transaction Evidence

```json
[
  {
    "type": "REQUEST",
    "method": "POST",
    "url": "http://192.168.29.227:3000/api/auth/login",
    "headers": {
      "content-type": "application/json"
    },
    "body": "{\"mobile\":\"1234567890\",\"pin\":\"000000\"}"
  },
  {
    "type": "RESPONSE",
    "status": 200,
    "url": "http://192.168.29.227:3000/api/auth/login",
    "headers": {
      "set-cookie": "session=eyJhbGciOi...; Path=/; Expires=Sun, 04 Oct 2026; HttpOnly; SameSite=lax"
    },
    "body": {
      "success": true,
      "role": "STAFF",
      "redirectTo": "/staff/dashboard"
    }
  },
  {
    "type": "NAVIGATION",
    "target": "http://192.168.29.227:3000/mobile",
    "status": 200,
    "rendered": {
      "title": "Kamna ERP",
      "header": "KAMNA ERP",
      "greeting": "Hello, Dummy",
      "modules": ["Operations", "Accounts"]
    }
  }
]
```
