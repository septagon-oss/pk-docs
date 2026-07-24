---
title: v0.2.0 Module Map — auth_management
slug: v0-2-0-module-map-auth-management
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# `auth_management`

Sessions: login, logout, bearer/cookie resolution, lockout policy.

Package: `pk-modules/pkg/auth`

```mermaid
graph LR
  auth[auth_management]:::focus
  user[user_management]
  auth -->|UserBoundaryReader| user
  audit[audit_management]
  auth -->|AuditEmitter| audit
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Depends on

- [`user_management`](user_management.md) via `user.UserBoundaryReader` — looks up users to verify credentials.
- [`audit_management`](audit_management.md) via `audit.AuditEmitter` — emits login success/failure events.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
