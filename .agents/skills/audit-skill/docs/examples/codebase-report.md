# Example: Codebase Audit Report

> This is a realistic example output showing what a full codebase audit looks like.
> Use this as a reference for format, depth, and style.

---

# Audit Report: ShopFlow E-Commerce Platform

## Executive Summary

**Project**: ShopFlow  
**Audit Date**: 2024-01-15  
**Auditor**: Claude (audit-skill v1.0)

### Top 5 Critical Findings

1. **Auth tokens stored in localStorage** — Any XSS attack can steal user sessions. Impact: Full account takeover. Fix: Move to httpOnly cookies. Est: 4 hours.

2. **Checkout API has no CSRF protection** — Attackers can trigger purchases from malicious sites. Impact: Financial fraud. Fix: Add CSRF tokens. Est: 2 hours.

3. **Product search crashes on mobile at 375px** — `overflow: hidden` on `.search-results` clips results invisibly. Impact: ~40% of users (mobile). Fix: 1 CSS rule. Est: 30 min.

4. **Password reset link never expires** — Reset links are valid indefinitely. Impact: Account takeover via old emails. Fix: Add 1-hour expiry. Est: 2 hours.

5. **No error boundaries in React** — Any unhandled JS error crashes the entire app. Impact: Complete UI failure for users. Fix: Add ErrorBoundary components. Est: 3 hours.

### Severity Breakdown
| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 7     |
| Medium   | 12    |
| Low      | 8     |

### Recommended Next 3 Engineering Tasks
1. **Security sprint** — Fix auth token storage + CSRF + password reset — 1 day
2. **Mobile crash fix + error boundaries** — 1 day  
3. **Accessibility pass** — Fix 6 WCAG failures blocking screen reader users — 2 days

---

## Technical Findings

### AUDIT-001 — Critical — Security
**Auth Tokens in localStorage**

**File**: `src/auth/AuthProvider.tsx:47`  
**Reproduction**:
1. Log in at `/login`
2. Open DevTools → Application → localStorage
3. Observe `authToken` stored in plaintext

**Code**:
```typescript
// src/auth/AuthProvider.tsx:47 ❌
localStorage.setItem('authToken', response.data.token)
```

**Fix**:
```diff
- localStorage.setItem('authToken', response.data.token)
+ // Token now set via httpOnly cookie from server
+ // Remove all localStorage token reads
```

**Server change needed** (`api/auth/login.ts`):
```typescript
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
})
```

**Regression Test**:
```typescript
test('auth token is not accessible via JavaScript', async ({ page }) => {
  await loginAs(page, 'user@example.com')
  const token = await page.evaluate(() => localStorage.getItem('authToken'))
  expect(token).toBeNull()
})
```

---

### AUDIT-002 — High — Accessibility
**Missing Form Labels on Checkout**

**WCAG**: 4.1.2 Name, Role, Value  
**File**: `src/pages/checkout/PaymentForm.tsx:23`

**Current**:
```jsx
<input type="text" placeholder="Card number" /> ❌
```

**Fix**:
```jsx
<label htmlFor="card-number">Card Number</label>
<input id="card-number" type="text" placeholder="1234 5678 9012 3456" />
```

---

### AUDIT-003 — High — Performance
**Unoptimized Product Images**

**File**: `src/components/ProductCard.tsx:12`  
**Issue**: Images are 2MB+ JPEGs with no lazy loading or size attributes

**Current**:
```jsx
<img src={product.imageUrl} alt={product.name} />
```

**Fix**:
```jsx
<img
  src={product.imageUrl}
  alt={product.name}
  width={300}
  height={300}
  loading="lazy"
  decoding="async"
/>
```

**LCP improvement**: ~1.2s on mobile

---

## CI Recommendations

```yaml
# .github/workflows/quality.yml
name: Quality Gates
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit --audit-level=high
      - run: npx semgrep --config=p/security-audit src/

  tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci && npm test -- --coverage
      - run: npx playwright test

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - run: npx @lhci/cli autorun
```

---

## 2-Week Sprint Plan

**Week 1**: Security & Stability
- Day 1-2: Fix auth token storage (AUDIT-001) + CSRF tokens
- Day 3: Fix password reset expiry + add error boundaries  
- Day 4-5: Security header configuration + npm audit fixes

**Week 2**: UX & Accessibility
- Day 1-2: Mobile layout fixes (5 pages affected)
- Day 3-4: Accessibility pass (WCAG failures)
- Day 5: Performance — image optimization + lazy loading

---

## JSON Summary

```json
{
  "audit": {
    "type": "codebase",
    "project": "ShopFlow",
    "date": "2024-01-15",
    "summary": {
      "total_issues": 30,
      "critical": 3,
      "high": 7,
      "medium": 12,
      "low": 8,
      "top_3_tasks": [
        "Fix auth token storage + CSRF protection",
        "Fix mobile crashes + add error boundaries",
        "Accessibility pass — 6 WCAG failures"
      ]
    },
    "findings": [
      {
        "id": "AUDIT-001",
        "severity": "Critical",
        "category": "Security",
        "title": "Auth tokens stored in localStorage",
        "file": "src/auth/AuthProvider.tsx",
        "line": 47,
        "fix": {
          "description": "Move to httpOnly cookie set by server",
          "diff": "see above"
        }
      }
    ]
  }
}
```
