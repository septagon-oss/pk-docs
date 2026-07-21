---
title: v0.2.0 Module Map — content_management
slug: v0-2-0-module-map-content-management
collection: docs
status: published
---

# `content_management`

Tenant-scoped content (posts, pages) with slugs and publishing.

Package: `pk-modules/pkg/content`

```mermaid
graph LR
  content[content_management]:::focus
  tenant[tenant_management]
  content -->|TenantService| tenant
  audit[audit_management]
  content -->|AuditEmitter| audit
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Depends on

- [`tenant_management`](tenant_management.md) via `tenant.TenantService` — validates tenant_id on create.
- [`audit_management`](audit_management.md) via `audit.AuditEmitter` — audits content lifecycle.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
