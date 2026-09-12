---
title: Use Playwright as the only test runner
domain: testing
status: proposed
enforcement: warn
applies_to: [testing, "tests/**", "playwright.config.ts"]
source: human
---

Keep every test in root `tests/` and run it with Playwright. API E2E uses the request fixture without a browser. Database-mutating tests require an explicit opt-in, must guard the exact database/schema target, use isolated identifiers, and clean up only records they created.
