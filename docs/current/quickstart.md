---
title: Current Quickstart
slug: current-quickstart
collection: guides
status: published
---

# Current quickstart

This is the current runnable PlatformKit OSS path. The executable contract is
the public [`septagon-oss/platformkit`](https://github.com/septagon-oss/platformkit)
repository; version-named documentation elsewhere in this repository is
historical.

## Requirements

- Go 1.26 or newer
- no Docker, Node.js, C compiler, or external database for the default starter

## Clone and run

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
GOWORK=off go run .
```

A fresh database starts the domain-neutral nine-module starter with SQLite and
a loopback-only listener at `127.0.0.1:8080`.

```text
local tenant: tenant_local
local login:  operator@local.test / local-development-only
```

These are development credentials. A configured or non-development deployment
fails closed without a strong `seed.admin_password`, and it does not print the
password. An upgraded database can retain an older durable tenant ID to avoid
orphaning extension rows; use the tenant and email printed by that database's
startup banner.

`PORT=8090 go run .` changes the port while remaining on loopback. Listening on
a network interface requires an explicit address:

```bash
PK_HTTP_ADDR=0.0.0.0:8080 GOWORK=off go run .
```

## Confirm readiness and authenticate

```bash
curl -fsS http://127.0.0.1:8080/ready

curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "tenant_local",
    "email": "operator@local.test",
    "password": "local-development-only"
  }'
```

The login response's `id` is a bearer session:

```bash
curl -fsS http://127.0.0.1:8080/api/v1/tenants \
  -H 'Authorization: Bearer YOUR_SESSION_ID'
```

Open `http://127.0.0.1:8080/admin` for the operator console. The public landing
page does not expose credentials.

## What actually ships

The starter composes nine modules: tenant, user, authentication, API key,
audit, content, notification, admin, and health. Product domains, public
storefronts, billing, email delivery, mobile clients, MCP servers, and vertical
workflows are not implicit starter capabilities. Add application-owned
capabilities through the supported
[`starterapp.WithModules`](./extensions.md) seam.

