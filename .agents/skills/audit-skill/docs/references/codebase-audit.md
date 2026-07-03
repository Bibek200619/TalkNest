# Codebase Audit Reference

Full instructions for performing a production-grade codebase audit covering UI, functionality, accessibility, performance, security, and test coverage.

---

## Table of Contents
1. [Build & Run](#1-build--run)
2. [Route Crawl & Flow Execution](#2-route-crawl--flow-execution)
3. [UI Inspection](#3-ui-inspection)
4. [Functional Bug Detection](#4-functional-bug-detection)
5. [Accessibility (WCAG 2.1)](#5-accessibility-wcag-21)
6. [Performance](#6-performance)
7. [Security & Privacy](#7-security--privacy)
8. [Test Coverage Gaps](#8-test-coverage-gaps)
9. [Fixes & Patches](#9-fixes--patches)
10. [Report Assembly](#10-report-assembly)

---

## 1. Build & Run

**Goal**: Verify the project builds and runs without errors.

### Steps
```bash
# Clone / unzip the repo
git clone <repo-url> && cd <project>

# Install dependencies
npm install        # or: yarn / pnpm install / pip install -r requirements.txt

# Run build
npm run build      # or: yarn build / make build

# Start dev server
npm run dev        # or: yarn dev / python manage.py runserver
```

### If build fails
- Report exact error message + stack trace
- Identify failing file + line number
- Suggest minimal fix (missing dep, env var, config error, etc.)
- Attempt static analysis on the code even if the build fails

---

## 2. Route Crawl & Flow Execution

**Goal**: Discover all routes and execute critical user flows.

### Route Discovery
- Parse client router (React Router, Next.js pages/, Vue Router, etc.)
- Parse sitemap.xml if available
- List all discovered routes

### Critical Flows to Execute
For each flow provided by the user (and these defaults):
- **Authentication**: Register → Login → Logout → Password reset
- **Core feature flow**: Whatever the app's main purpose is
- **Admin flow**: If admin panel exists
- **Error states**: 404, 500, empty states, loading states

### For each flow, record
- Steps to reproduce
- HTTP request/response logs (method, URL, status, body)
- UI state at each step
- Any errors or unexpected behavior

---

## 3. UI Inspection

**Goal**: Find visual bugs, layout issues, and responsive breakpoints problems.

### Viewports to Test
| Name    | Width × Height |
|---------|---------------|
| Desktop | 1366 × 768    |
| Tablet  | 768 × 1024    |
| Mobile  | 375 × 812     |

### Checklist per Page per Viewport
- [ ] Layout overflow or horizontal scroll
- [ ] Misaligned elements (flexbox/grid issues)
- [ ] Overlapping content
- [ ] Incorrect fonts (wrong weight, size, family)
- [ ] Color contrast failures (< 4.5:1 for text)
- [ ] Missing assets (broken images, icons, fonts)
- [ ] Spacing inconsistencies (padding/margin drift)
- [ ] Broken responsive breakpoints

### For each UI issue, report
```
Issue: [Short description]
Page: [Route]
Viewport: [Desktop/Tablet/Mobile]
Component/File: [path/to/component.tsx:line]
CSS Rule: [exact property and value causing issue]
Screenshot: [if available]
Fix: [suggested CSS or layout change]
```

---

## 4. Functional Bug Detection

**Goal**: Find broken functionality, API errors, and logic bugs.

### Categories to Check
- **Broken buttons/links**: Click handlers missing or throwing errors
- **API errors**: 4xx/5xx responses, missing error handling, race conditions
- **Form validation**: Missing required field checks, incorrect regex, no server-side validation
- **Navigation failures**: Broken routes, infinite redirects, history bugs
- **State management**: Incorrect updates, stale data, client/server desync
- **Race conditions**: Concurrent requests, missing debounce/throttle

### For each bug, report
```
Bug: [Short title]
Severity: Critical / High / Medium / Low
Page/Flow: [Where it occurs]
File: [path/to/file.ts:line]
Reproduction Steps:
  1. Go to [URL]
  2. Click [element]
  3. Observe [error]
HTTP Log:
  Request:  POST /api/endpoint {"key": "value"}
  Response: 500 {"error": "message"}
Failing Code:
  [Minimal code snippet]
Fix:
  [Suggested fix or code diff]
```

---

## 5. Accessibility (WCAG 2.1)

**Goal**: Find WCAG 2.1 Level AA failures.

### Automated Checks
Run axe-core or similar:
```bash
npx axe-cli <url> --include main
```

### Manual Checklist
- [ ] **1.1.1** All images have descriptive alt text
- [ ] **1.3.1** Semantic HTML used (headings in order, landmarks present)
- [ ] **1.4.3** Text contrast ≥ 4.5:1 (3:1 for large text)
- [ ] **1.4.4** Text resizable to 200% without loss of content
- [ ] **2.1.1** All functionality reachable by keyboard
- [ ] **2.1.2** No keyboard traps
- [ ] **2.4.3** Logical focus order
- [ ] **2.4.7** Focus indicator visible
- [ ] **3.3.1** Input errors identified and described
- [ ] **4.1.2** All form inputs have labels
- [ ] **4.1.3** Status messages use ARIA live regions

### For each a11y issue, report
```
Issue: [Description]
WCAG Criteria: [e.g., 1.4.3 Contrast (Minimum)]
Element: [selector or component]
File: [path:line]
Current: [what it does now]
Required: [what WCAG requires]
Fix: [code change]
```

---

## 6. Performance

**Goal**: Find performance bottlenecks and quick wins.

### Checks
- **Bundle size**: Run `npm run build -- --analyze` or `webpack-bundle-analyzer`
- **Lighthouse scores**: Run `npx lighthouse <url> --output json`
- **Render-blocking resources**: Scripts/stylesheets blocking First Contentful Paint
- **Images**: Unoptimized, missing `width`/`height`, no lazy loading, wrong format
- **Caching**: Missing `Cache-Control` headers, no CDN, no service worker
- **API response time**: Endpoints > 200ms need optimization

### Targets
| Metric | Target |
|--------|--------|
| FCP    | < 1.8s |
| LCP    | < 2.5s |
| TTI    | < 3.8s |
| CLS    | < 0.1  |
| Bundle | < 250KB gzipped |

### For each issue, provide
- Current value vs. target
- File/resource responsible
- Specific fix (code split, lazy load, compress, cache header, etc.)

---

## 7. Security & Privacy

**Goal**: Identify security vulnerabilities quickly.

### Checks
```bash
# Dependency audit
npm audit --audit-level=high

# Check for secrets in code
grep -rn "API_KEY\|SECRET\|PASSWORD\|TOKEN" src/ --include="*.ts" --include="*.js"

# Check package versions for known CVEs
npx audit-ci --high
```

### Manual Review
- [ ] No secrets/API keys committed to repo (check .env files, git history)
- [ ] CORS policy is restrictive (not `*` in production)
- [ ] HTTP security headers present: `CSP`, `X-Frame-Options`, `HSTS`, `X-Content-Type`
- [ ] Input sanitization on all user inputs (XSS prevention)
- [ ] CSRF tokens on state-changing forms
- [ ] Authentication tokens stored securely (httpOnly cookies, not localStorage)
- [ ] Sensitive data not logged
- [ ] Dependencies free of known CVEs

### For each issue, report
```
Vulnerability: [Title]
Severity: Critical / High / Medium / Low
Type: [XSS / CSRF / Secrets Leak / CVE / etc.]
File: [path:line]
CVE: [if applicable]
Evidence: [code snippet or config]
Fix: [specific remediation]
```

---

## 8. Test Coverage Gaps

**Goal**: Identify missing tests for critical flows.

### Analyze existing tests
```bash
# Coverage report
npm run test -- --coverage

# Check what's tested
ls src/**/*.test.ts src/**/*.spec.ts
```

### Generate missing tests

#### Unit test example (Vitest/Jest)
```typescript
// tests/unit/auth.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail } from '../src/utils/validation'

describe('validateEmail', () => {
  it('rejects invalid email formats', () => {
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('missing@domain')).toBe(false)
  })
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
  })
})
```

#### E2E test example (Playwright)
```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test('user can log in with valid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', 'user@example.com')
  await page.fill('[data-testid="password"]', 'password123')
  await page.click('[data-testid="submit"]')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
})

test('shows error on invalid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', 'wrong@example.com')
  await page.fill('[data-testid="password"]', 'wrongpassword')
  await page.click('[data-testid="submit"]')
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
})
```

---

## 9. Fixes & Patches

For every Critical and High issue, produce:

### Format
```
### Fix: [Issue Title]
Severity: Critical / High
File: path/to/file.ts

#### Problem
[1-2 sentence description]

#### Patch
```diff
- old code
+ new code
```

#### Regression Test
```typescript
// test that prevents this from regressing
```
```

---

## 10. Report Assembly

### Executive Summary Template
```markdown
## Executive Summary

**Project**: [Name]
**Audit Date**: [Date]
**Auditor**: Claude (AI-assisted audit)

### Top 5 Critical Findings
1. [Finding] — Impact: [Business impact] — Fix: [1-line fix]
2. ...

### Severity Breakdown
| Severity | Count |
|----------|-------|
| Critical | X     |
| High     | X     |
| Medium   | X     |
| Low      | X     |

### Recommended Next 3 Engineering Tasks
1. [Task] — Estimated: [X days]
2. ...

### 2-Week Sprint Plan
Week 1: Address all Critical + High security issues
Week 2: Address High functional bugs + accessibility failures
```

### CI Recommendations
```yaml
# .github/workflows/quality.yml
name: Quality Checks
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --coverage
      - run: npm audit --audit-level=high
      - run: npx playwright test
      - run: npx lighthouse-ci autorun
```
