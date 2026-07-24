---
title: v0.2.0 Module Map — user_management
slug: v0-2-0-module-map-user-management
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# `user_management`

Users, credentials, and the user boundary read/write ports.

Package: `pk-modules/pkg/user`

```mermaid
graph LR
  user[user_management]:::focus
  tenant[tenant_management]
  user -->|TenantService| tenant
  auth[auth_management]
  auth -->|UserBoundaryReader| user
  notification[notification_management]
  notification -->|UserBoundaryReader| user
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Depends on

- [`tenant_management`](tenant_management.md) via `tenant.TenantService` — validates tenant_id on create.

## Consumed by

- [`auth_management`](auth_management.md) via `user.UserBoundaryReader` — looks up users to verify credentials.
- [`notification_management`](notification_management.md) via `user.UserBoundaryReader` — resolves recipients.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
