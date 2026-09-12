---
id: stable-error-code-separate-trace-id
type: team_decision
title: Separate machine error codes from trace identifiers
domain: security
tags: [errors, api-contract, observability]
status: proposed
enforcement: warn
applies_to: ["src/common/errors/**", "src/**/*.error-codes.ts"]
source: ai
supersedes: ""
related: []
timestamp: 2026-09-12T00:00:00+07:00
---

Every API failure exposes a stable `FEATURE_ACTION_NNN` code and a separate per-request `traceId`. Never substitute the trace identifier for a missing code: consumers branch on `code`, while support uses `traceId` to locate redacted server logs.
