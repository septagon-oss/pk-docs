---
id: REQ-APIKEY-013
title: "API key rate limit windows requests per key, throttles on overflow, and emits the catalogued limit-exceeded event"
status: Proposed
date: 2026-05-08
slug: req-apikey-013-api-key-rate-limit
category: api_key
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.7
  - ISO27001_A.13.1.1
  - NIST_AC-7
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-009, REQ-014]
refines: REQ-APIKEY-001
type: doc
tags: [requirement, capability, api_key_management, key_management, rate_limit]
module: api_key_management
feature: key_management
capability: api_key_rate_limit
capability_kind: state_machine
stakeholders:
  - operator (alerts on rate-limit events)
  - integration consumer (sees 429 responses)
  - compliance auditor (DoS-resistance control)
---

# REQ APIKEY-013 — API key rate limit

Status: **Proposed** (2026-05-08)

## Statement

**When** the platform invokes
`Service.CheckRateLimit(keyID)` ahead of dispatching a
key-authenticated request, the key-management feature **shall**:

1. Look up (or initialise) the per-key
   `APIKeyRateLimit` row keyed on `api_key_id`;
2. **If** the current window has expired (`time.Now() >
   WindowEnd`) — reset `RequestCount = 0`,
   `IsThrottled = false`, `ThrottledUntil = nil`,
   `WindowStart = now`, `WindowEnd = now+1h`;
3. **If** the row is currently throttled
   (`IsThrottled && now < ThrottledUntil`) — return
   `(allowed=false, remaining=0, resetAt=ThrottledUntil)`;
4. Read the matching `APIKey` to learn its configured
   `RateLimit`;
5. **If** `RequestCount >= apiKey.RateLimit` — flip
   `IsThrottled = true`, set
   `ThrottledUntil = now + 1m`, persist (Warn on persist
   failure rather than failing the check), emit the
   catalogued `api_key.usage.limit_exceeded` event with
   `limitType=rate`, and return
   `(allowed=false, 0, ThrottledUntil)`;
6. **Else** increment `RequestCount`, persist (Warn on
   persist failure), return
   `(allowed=true, apiKey.RateLimit - RequestCount,
   WindowEnd)`.

`ResetRateLimit(keyID)` **shall** zero the counter and
clear the throttle flag — used by ops tooling and on
explicit operator override.

## Rationale

Rate limiting is the platform's defence against runaway
integrations and mis-configured retries. Three properties:

1. **Per-key, fixed-window.** Each key has its own
   counter; an overflowing key cannot starve other tenants'
   keys. The 1-hour window is the documented default; the
   per-key `RateLimit` configures the budget per window.
2. **Throttle on overflow + emit event.** A throttled
   client must see a typed `429` (the HTTP layer maps the
   `false` return), and the operator must see the
   `api_key.usage.limit_exceeded` event in their
   incident-response feed. A silent throttle is invisible
   to the consumer and the operator alike.
3. **Persist failures are advisory.** The check decision
   has already been computed; a persist failure on the
   counter increment will let one extra request through on
   the next call, which is acceptable. A persist failure
   on the *throttle flag* is more serious — the next call
   will not see the throttle — so we Warn-log so operators
   can correlate counter drift to specific keys.

The 1-minute throttle window is a deliberate cool-off, not
a "wait one hour": a misconfigured client fixing a tight
loop should recover quickly, but a sustained overflow has
to flip the flag again every minute (so the event keeps
firing).

## Acceptance criteria

- **AC-1 — Initialises window on first call.** A
  `CheckRateLimit` for a key with no existing row
  creates the row with `WindowStart = now`,
  `WindowEnd = now+1h`, `RequestCount = 0`.
- **AC-2 — Resets when window expires.** A call after
  `WindowEnd` produces a fresh window; the new
  `RequestCount` starts at 1 (the request being checked).
- **AC-3 — Allows under-limit calls.** A call with
  `RequestCount < apiKey.RateLimit` returns
  `(true, RateLimit - newCount, WindowEnd)`.
- **AC-4 — Flips throttle + event on overflow.** When
  `RequestCount >= RateLimit`, the row is updated with
  `IsThrottled = true` and a 1-minute `ThrottledUntil`;
  the `api_key.usage.limit_exceeded` event is emitted
  with `limitType=rate`; the response is
  `(false, 0, ThrottledUntil)`.
- **AC-5 — Persists Warn but check returns.** When the
  rate-limit row update fails (DB blip), the check still
  returns the computed answer and emits a Warn log with
  the key id + error.
- **AC-6 — Throttled-window short-circuit.** While
  `now < ThrottledUntil`, the check returns
  `(false, 0, ThrottledUntil)` without re-querying the
  api-key row or emitting another event.
- **AC-7 — Reset zeroes counter + clears flag.**
  `ResetRateLimit` flips `IsThrottled = false`,
  `RequestCount = 0`, `ThrottledUntil = nil`; subsequent
  checks behave as a fresh window.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::CheckRateLimit` lines 717–733 — when no row is found, a fresh `APIKeyRateLimit` is created with `WindowStart = now`, `WindowEnd = now + 1h`. Dedicated test pending. |
| AC-2 | Inspection | `service.go::CheckRateLimit` lines 738–746 — `time.Now().After(rateLimit.WindowEnd)` resets the counters and window markers. Dedicated test pending. |
| AC-3 | Inspection | `service.go::CheckRateLimit` lines 797–808 — under-limit path increments `RequestCount`, persists best-effort, returns `(true, RateLimit - newCount, WindowEnd)`. |
| AC-4 | Inspection | `service.go::CheckRateLimit` lines 759–795 — overflow flips `IsThrottled = true`, sets 1-minute `ThrottledUntil`, emits `api_key.usage.limit_exceeded` event, returns `(false, 0, ThrottledUntil)`. Dedicated test pending. |
| AC-5 | Inspection | `service.go::CheckRateLimit` lines 765–772 and 799–805 — explicit `s.logger.Warn(...)` on persist failure with key id + error; the check decision still returns. |
| AC-6 | Inspection | `service.go::CheckRateLimit` lines 748–751 — when `IsThrottled && now < ThrottledUntil`, the function returns immediately without re-querying the api-key row or emitting a new event. |
| AC-7 | Inspection | `service.go::ResetRateLimit` — clears `RequestCount`, `IsThrottled`, `ThrottledUntil`. Dedicated test pending. |

## Edge cases & unhappy paths

- **Concurrent burst.** Two requests racing to increment
  `RequestCount` past the limit — both observe the
  pre-increment value, both increment. The over-count is
  bounded by the worker count and self-corrects on the
  next persist. Documented quirk; for stricter bursts the
  service should be wrapped with an in-process semaphore.
- **API key deletion mid-window.** A `CheckRateLimit`
  against a deleted key returns the wrapped fetch error;
  the rate-limit row is left orphaned (cleaned by the
  retention job).
- **Clock skew.** `WindowEnd` is computed from the
  *server's* clock; cross-replica skew can cause a
  request to land in a freshly-reset window on one
  replica and a still-active window on another. Bounded
  by NTP discipline.
- **Burst-limit field unused.** `BurstLimit` exists on
  the entity but the current check uses only `RateLimit`;
  burst handling is a documented future extension.
- **Per-tenant aggregate.** Currently per-key only; a
  tenant overrunning its global budget across many keys
  is the quota system's concern (REQ-APIKEY-014, future).

## Risk

- **Likelihood:** Medium — exercised on heavy traffic.
- **Impact:** High — a defective limiter either exposes
  the platform to DoS or denies legitimate traffic.
- **Mitigations:** Per-key counter + window reset (AC-1 +
  AC-2), event-on-overflow (AC-4), Warn-on-persist drift
  (AC-5), reset for ops override (AC-7).

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-4 default-denies on
  overflow.
- **REQ-009 — Observability.** AC-4 + AC-5 — event +
  Warn log.
- **REQ-014 — Graceful degradation.** AC-5 — persist
  failures degrade to advisory mode; the check answer is
  still computed.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.7 (Restrict information access) | AC-4 — bounded request budget per credential. |
| ISO27001 A.13.1.1 (Network controls) | AC-4 — per-credential bandwidth gate. |
| NIST AC-7 (Unsuccessful logon attempts) | AC-4 — bounded retry budget for credential-bearing requests. |

## Satisfied by

- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::CheckRateLimit, ResetRateLimit`.

## Related requirements

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)
- [REQ-APIKEY-011 — API key validate](./REQ-APIKEY-011-api-key-validate.md) — the validate path that runs alongside this gate.
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md) — the analogous interactive-auth gate.
