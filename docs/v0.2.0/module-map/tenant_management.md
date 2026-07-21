---
title: v0.2.0 Module Map — tenant_management
slug: v0-2-0-module-map-tenant-management
collection: docs
status: published
---

# `tenant_management`

Tenants — the root of all data scoping.

Package: `pk-modules/pkg/tenant`

```mermaid
graph LR
  tenant[tenant_management]:::focus
  user[user_management]
  user -->|TenantService| tenant
  content[content_management]
  content -->|TenantService| tenant
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Consumed by

- [`user_management`](user_management.md) via `tenant.TenantService` — validates tenant_id on create.
- [`content_management`](content_management.md) via `tenant.TenantService` — validates tenant_id on create.

## Depends on

Nothing — this module is a root of the graph.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
