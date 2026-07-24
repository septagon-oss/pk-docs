---
title: v0.2.0 Module Map — audit_management
slug: v0-2-0-module-map-audit-management
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# `audit_management`

Append-only audit trail. Write path is in-process only; HTTP is read-only.

Package: `pk-modules/pkg/audit`

```mermaid
graph LR
  audit[audit_management]:::focus
  auth[auth_management]
  auth -->|AuditEmitter| audit
  apikey[api_key_management]
  apikey -->|AuditEmitter| audit
  content[content_management]
  content -->|AuditEmitter| audit
  notification[notification_management]
  notification -->|AuditEmitter| audit
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Consumed by

- [`auth_management`](auth_management.md) via `audit.AuditEmitter` — emits login success/failure events.
- [`api_key_management`](api_key_management.md) via `audit.AuditEmitter` — audits issue/revoke.
- [`content_management`](content_management.md) via `audit.AuditEmitter` — audits content lifecycle.
- [`notification_management`](notification_management.md) via `audit.AuditEmitter` — audits dispatches.

## Depends on

Nothing — this module is a root of the graph.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
