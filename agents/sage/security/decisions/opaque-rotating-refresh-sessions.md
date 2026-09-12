---
id: opaque-rotating-refresh-sessions
type: team_decision
title: Keep browser refresh tokens opaque and server-revocable
domain: security
tags: [authentication, jwe, refresh-token, browser]
status: proposed
enforcement: warn
applies_to: ["src/modules/auth/**", "prisma/**"]
source: ai
supersedes: ""
related: []
timestamp: 2026-09-12T00:00:00+07:00
---

Access tokens may be encrypted JWE values, but browser refresh tokens remain high-entropy opaque values in HttpOnly cookies. Store only their hashes, rotate on use, retain ended rows for replay detection, and use a fixed family expiry so rotation cannot extend a stolen session indefinitely.
