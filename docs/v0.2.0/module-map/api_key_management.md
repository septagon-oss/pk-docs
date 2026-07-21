---
title: v0.2.0 Module Map — api_key_management
slug: v0-2-0-module-map-api-key-management
collection: docs
status: published
---

# `api_key_management`

API keys: issuance, verification, revocation. Keys select their own tenant.

Package: `pk-modules/pkg/apikey`

```mermaid
graph LR
  apikey[api_key_management]:::focus
  audit[audit_management]
  apikey -->|AuditEmitter| audit
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Depends on

- [`audit_management`](audit_management.md) via `audit.AuditEmitter` — audits issue/revoke.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
