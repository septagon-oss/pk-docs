---
title: v0.2.0 Deployment Guide
slug: v0-2-0-deployment-guide
collection: docs
status: published
---

# v0.2.0 Deployment Guide

The starter app is a single, pure-Go binary: no CGO (SQLite via
`modernc.org/sqlite`), no npm build, no external database, no Docker
requirement. Deployment is correspondingly boring — build a static binary, run
it behind a TLS-terminating reverse proxy, keep `pk.db` on persistent disk.

**v0.2.0 ships no official container image and no Helm chart for the starter
app** (both are on the roadmap — see the
[release notes](./release-notes-v0.2.0.md)). Everything below is
operator-assembled from standard tools.

Prerequisites: Go 1.26+ on the build machine. Nothing on the target host but
the binary and a writable data directory.

## Read this first

- **`/admin` and the CRUD APIs require authentication.** `/api/v1/*` rejects
  anonymous requests with `401` and `/admin` redirects to `/admin/login`; every
  by-id operation is tenant-scoped. You still terminate TLS in front and set
  `seed.admin_password` for production — see the
  [Security Baseline](./security-baseline.md).
- **The app reads no environment variables.** Address, timeouts, and DSN come
  from `config.yaml` (via a wrapper) or compiled-in defaults — see
  [Configuration](./configuration.md). The systemd/Docker examples below use a
  wrapper that loads `config.yaml`.
- **SQLite means one writable file, one process.** The default DSN is
  `file:./pk.db?...` — relative to the working directory, so pin the working
  directory (or use an absolute path in the DSN). Do not run two replicas
  against one `pk.db`.

## Build a binary

From a clone of the front door (or your own wrapper module — recommended for
production so you can load `config.yaml`; see
[Configuration](./configuration.md) for the 15-line wrapper):

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
CGO_ENABLED=0 go build -o platformkit .
```

Cross-compilation works the standard Go way — the sqlite driver is pure Go:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o platformkit .
```

Smoke-test the result:

```bash
./platformkit &
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/ready
kill %1
```

## Reverse proxy

Terminate TLS in front and protect `/admin`. The app listens on plain HTTP
(`http.addr`, default `:8080`) and does not serve `:443` itself.

Caddy (automatic TLS; basic-auth on the admin shell):

```caddy
example.com {
    @admin path /admin /admin/*
    basic_auth @admin {
        # caddy hash-password to generate
        ops JDJhJDE0JC4uLg
    }
    reverse_proxy 127.0.0.1:8080
}
```

nginx equivalent:

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    # ssl_certificate / ssl_certificate_key ...

    location /admin {
        auth_basic "restricted";
        auth_basic_user_file /etc/nginx/htpasswd;
        proxy_pass http://127.0.0.1:8080;
    }
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

## systemd unit

Assuming the binary at `/opt/platformkit/platformkit`, data in
`/var/lib/platformkit`, and (if you built the wrapper) a `config.yaml` in the
working directory:

```ini
# /etc/systemd/system/platformkit.service
[Unit]
Description=PlatformKit starter app
After=network-online.target
Wants=network-online.target

[Service]
User=platformkit
Group=platformkit
WorkingDirectory=/var/lib/platformkit
ExecStart=/opt/platformkit/platformkit
Restart=on-failure
# The app shuts down cleanly on SIGTERM (default systemd KillSignal),
# honoring http.shutdown_timeout (default 30s).
TimeoutStopSec=45

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/platformkit
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd --system --home /var/lib/platformkit platformkit
sudo mkdir -p /var/lib/platformkit && sudo chown platformkit: /var/lib/platformkit
sudo systemctl daemon-reload
sudo systemctl enable --now platformkit
curl -fsS http://localhost:8080/live
```

`WorkingDirectory` matters twice: the default DSN writes `./pk.db` there, and
the wrapper (if you use one) loads `./config.yaml` from there. Back up
`/var/lib/platformkit/pk.db` — it holds everything, including the audit log.

## Docker

No official image ships in v0.2.0; a minimal multi-stage Dockerfile you own
works because the binary is CGO-free:

```dockerfile
FROM golang:1.26 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /out/platformkit . && mkdir /out/data

FROM gcr.io/distroless/static-debian12:nonroot
# /data is created in the build stage and copied with nonroot ownership so
# the named volume initialized from it is writable by the nonroot user.
COPY --from=build --chown=nonroot:nonroot /out/data /data
COPY --from=build /out/platformkit /usr/local/bin/platformkit
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/platformkit"]
```

```bash
docker build -t platformkit:0.2.0 .
docker run -d --name platformkit \
  -p 127.0.0.1:8080:8080 \
  -v platformkit-data:/data \
  platformkit:0.2.0
curl -fsS http://localhost:8080/healthz
```

`WORKDIR /data` + the volume keeps `pk.db` (and `config.yaml`, if you `COPY`
or mount one next to it) on persistent storage. Bind the port to localhost and
front it with your proxy.

### Health probes

For any orchestrator:

- **Liveness:** `GET /live` → `204` (never touches the DB).
- **Readiness:** `GET /ready` → `200` when the composed module plan is
  healthy, `503` otherwise.
- **Diagnostics:** `GET /healthz` → per-module store checks (see the
  [Observability Guide](./observability-guide.md)).

## pk-deploy — when you outgrow "one binary, one host"

[`pk-deploy`](https://github.com/septagon-oss/pk-deploy) is a separate OSS
repo: a small, vendor-neutral **deployment control-plane kernel**. It is not
required to deploy the starter app, and it is intentionally not
PlatformKit-specific. What it gives you:

- a self-hosted control plane (a NAS, a VM, a small server) that creates
  **signed deployment jobs** (HMAC-SHA256 envelopes);
- a narrow **pull-based worker** inside each runtime that polls over outbound
  connectivity and verifies job signatures before doing anything — the
  control-plane host never needs broad cluster credentials;
- an **executor registry** so those jobs can drive Flux, Helm, Docker Compose,
  SSH, Terraform, or other targets via adapters;
- **evidence bundles** and **Prometheus text-format metrics** from workers.

The OSS core owns the contracts (plan grammar, signed jobs, worker loop,
executor registry, evidence, metrics exposition) in packages `pkg/deploy`,
`pkg/job`, `pkg/worker`, `pkg/evidence`, `pkg/metrics`; concrete UIs,
persistence, Git providers, and hosted features are adapters or downstream
extensions. Two binaries ship: `cmd/pk-deploy-controlplane` (serves `/`,
`/healthz`, `/metrics`, `/api/status`) and `cmd/pk-deploy-worker`, with
example manifests under `deploy/` (a Docker Compose file for the control
plane, a Kubernetes manifest for the worker).

Use it when you have a fleet — several apps, several hosts, and a need for
auditable, signed deployments from self-hosted infrastructure. Skip it while
`scp` + `systemctl restart` covers you.

```bash
go get github.com/septagon-oss/pk-deploy@v0.2.0
# or explore locally:
git clone https://github.com/septagon-oss/pk-deploy
cd pk-deploy && make verify && make example
```

## Related pages

- [Configuration](./configuration.md) — the config-file wrapper used above.
- [Security Baseline](./security-baseline.md) — hardening order of operations.
- [Quickstart](./quickstart.md) — local development flow.
