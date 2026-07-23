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

PlatformKit is pre-1.0; expect APIs to move. There is no long-term support
window yet. Security fixes land on the `main` branch of the affected repo. If
you need stability today, pin to a specific commit and watch the repo for
security updates.

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

- **The zero-config local bootstrap credential is development-only.** The
  canonical front door listens on loopback and prints
  `operator@local.test / local-development-only` for local use. Development
  deliberately repairs that credential on restart, so it must never be exposed
  to a network. Production boots require `seed.admin_password`, do not repair a
  rotated password, and never inherit the local credential.
- **SQLite is the local default, not a production-at-scale store.** "SQLite does
  not scale to a large production deployment" is a documented limitation, not a
  security bug — swap in your own store behind the store port for production.

Out of scope: issues in your own application code built on top of PlatformKit,
and issues in third-party dependencies (report those upstream, though we welcome
a heads-up).

---

See the current
[PlatformKit README](https://github.com/septagon-oss/platformkit#readme) for the
supported local bootstrap and authenticated API flow. Versioned directories in
this repository are historical snapshots.
