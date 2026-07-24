---
title: v0.2.0 Module Map — admin_management
slug: v0-2-0-module-map-admin-management
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# `admin_management`

The /admin console shell; renders pages other modules register.

Package: `pk-modules/pkg/admin`

```mermaid
graph LR
  admin[admin_management]:::focus
  others[all nine modules]
  others -.->|portslib registration| admin
  classDef focus fill:#0e7490,color:#fff,stroke:#22d3ee
```

## Registration hub

This module has no outgoing dependencies. Every module registers into it through `pk-modules/pkg/portslib` (`AdminRegistrar`), so the arrows point inward.

Routes, options, and provided interfaces: see this module's section in the [Module Reference](../module-reference.md).

[← back to the module map](README.md)
