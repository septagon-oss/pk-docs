# Security

**How do I report a vulnerability?**

Report it privately. **Do not open a public GitHub issue for a security
vulnerability** — a public issue tells everyone about the problem before there is
a fix.

## How to report

Email **security@septagon.dev** with:

- a description of the issue and the impact you think it has,
- the steps to reproduce it (a minimal proof of concept helps a lot),
- the affected repo, version, or commit.

We will acknowledge your report, work with you on a fix, and credit you when the
fix ships if you would like the credit. Please give us a reasonable window to
address the issue before disclosing it publicly.

## Supported versions

PlatformKit is early — **v0.2.0**, the security release; expect APIs to
move. There is no long-term
support window yet. Security fixes land on the `main` branch of the affected
repo. If you need stability today, pin to a specific commit and watch the repo
for security updates.

| Version | Supported |
|---|---|
| `main` (current) | Yes — fixes land here |
| Tagged early releases (v0.x) | Best effort; upgrade to current |

## Scope

In scope: vulnerabilities in PlatformKit's own code — the layers under the
`septagon-oss` organization (`pk-core`, `pk-modules`, `pk-runtime`, `pk-apps`,
`pk-tools`, and the other published layers), including the security baseline
(CSRF, CORS, headers, password hashing, signed cookies, rate-limiting, signature
verification) and the module/port boundary.

Worth knowing before you report:

- **The demo `changeme` admin password is development-only, not a
  vulnerability.** The starter requires authentication, gates `/admin` behind a
  login wall, and enforces multi-tenant isolation. The `admin@local.test` /
  `changeme` seed default applies only when `environment` is `development` and
  is never re-asserted; production boots require `seed.admin_password`. A weak
  password you leave configured in production is your configuration, not a bug
  in PlatformKit.
- **SQLite is the local default, not a production-at-scale store.** "SQLite does
  not scale to a large production deployment" is a documented limitation, not a
  security bug — swap in your own store behind the store port for production.

Out of scope: issues in your own application code built on top of PlatformKit,
and issues in third-party dependencies (report those upstream, though we welcome
a heads-up).

---

See also: [open-core.md](docs/v0.2.0/open-core.md) for what the OSS security baseline
covers, [quickstart.md](docs/v0.2.0/quickstart.md) for the login-first API flow and the
`/admin` login wall.
