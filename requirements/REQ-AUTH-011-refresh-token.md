---
id: REQ-AUTH-011
title: "Refresh-token redemption atomically rotates one durable current family generation"
status: Proposed
date: 2026-07-18
slug: req-auth-011-refresh-token
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
  - OWASP_ASVS_3.2.1
satisfied_by:
  adr: [ADR-0006, ADR-0007, ADR-0067]
  conventions: [C-04, C-19, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-AUTH-012, REQ-AUTH-016]
type: doc
tags: [requirement, capability, auth_management, authentication, refresh, token, replay]
module: auth_management
feature: authentication
capability: refresh_token
capability_kind: state_machine
stakeholders:
  - end-user
  - operator
  - compliance auditor
---

# REQ AUTH-011 — Durable single-use refresh redemption

Status: **Proposed** (2026-07-18)

## Statement

**When** a caller presents a PlatformKit refresh token, the system **shall**
cryptographically validate it and atomically exchange the one currently
authorized family generation for a new access token and refresh token. The
durable authority **shall** contain only a one-way digest and exact
user/tenant/session binding. **If** any cryptographic, durable, session,
account, membership, or transaction precondition is missing or uncertain, the
system **shall** fail closed and return no credential.

## Rationale

Refresh tokens are long-lived bearer credentials. A cache blacklist cannot
prove single use: cache entries can disappear and a read followed by a write
allows two replicas to accept the same token. A raw bearer stored on a session
row also turns every row projection or database disclosure into credential
disclosure.

The family ledger solves both problems. One session has one current digest and
generation. A database lock plus compare-and-swap gives exactly one redemption
winner, while reuse revokes the whole family and session. Current user,
membership, and role state is resolved during rotation so the renewed access
token does not preserve stale authority.

## Acceptance criteria

- **AC-1 — Complete cryptographic validation.** Only HS256 refresh-purpose
  tokens with valid signature, `iat`, `exp`, configured issuer and audience,
  and non-empty `jti`, family, generation, user, tenant, and session claims may
  reach durable redemption.
- **AC-2 — Hash-only durable authority.** The family row stores one 32-byte
  SHA-256 digest, never the raw bearer, and has exactly one session, user,
  tenant, positive generation, expiry, and complete revocation state.
- **AC-3 — Mandatory atomic rotation.** Redemption locks the family and uses a
  generation-plus-digest compare-and-swap. Rotation cannot be disabled, and
  two concurrent submissions have exactly one successful exchange.
- **AC-4 — Reuse containment.** A stale generation, stale digest, or exact
  binding mismatch returns `refresh token revoked` and durably revokes both the
  family and its session. The newly rotated token cannot outlive detected
  family reuse.
- **AC-5 — Live authority revalidation.** Before minting, the service requires
  the exact active session and user, the same tenant, an active membership when
  tenancy is composed, and current roles. A durable guest membership replaces
  every stale or orphan elevated role with the guest ceiling.
- **AC-6 — Transactional no-credential boundary.** Family replacement, session
  activity, audit intent, and the catalogued refresh event commit together. A
  write, audit, outbox, or store error returns no token and leaves the original
  generation usable unless the transaction committed an intentional denial.
- **AC-7 — Cache independence.** Cache availability and cache blacklist content
  do not grant or deny refresh authority. A cache outage cannot permit replay;
  a durable-store outage cannot produce a token.
- **AC-8 — Atomic initial issuance.** A remembered login returns its initial
  refresh bearer only after generation one has been registered durably. Failure
  to register the digest returns no bearer.
- **AC-9 — Missing or orphan authority fails closed.** Empty, malformed,
  expired, wrong-purpose, missing-family, revoked-family, expired-session, and
  inactive-account cases return no token. A signed orphan family claim causes
  conservative revocation of its exact session when that session is present.
- **AC-10 — Tenant continuity.** Refresh never selects or changes a tenant;
  tenant switching requires a separately authorized session transition.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshValidatesConfiguredIssuerAndAudience` plus the malformed and purpose-claim cases in the authentication service suite. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_migration_test.go::TestDurableRefreshTokenMigrationContainsNoRawBearerColumn` and `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestInitialRememberedIssuanceRegistersDigestBeforeReturn`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshConcurrentRedemptionHasExactlyOneWinner` and `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestRefresh_SingleUse_FailsOnReplay`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshSequentialReplayRevokesFamilyAndSession` and `TestDurableRefreshRejectsInactiveRevokedAndMismatchedState`. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshRejectsInactiveRevokedAndMismatchedState` and `modules/platformkit-business-modules/auth_management/features/authentication/login_link_membership_test.go::TestRefreshAccessTokenGuestCeilingReplacesOrphanAdminClaim`. |
| AC-6 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshDoesNotReturnTokenWhenSessionTouchFails`. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestDurableRefreshIgnoresCacheOutageAndFailsClosedOnLedgerOutage` and `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestRefreshAccessToken_DoesNotTreatCacheAsAuthority`. |
| AC-8 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestInitialRememberedIssuanceRegistersDigestBeforeReturn`. |
| AC-9 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestRefreshAccessToken_EmptyToken` and the durable inactive/revoked/mismatch table test. |
| AC-10 | Inspection | Family and JWT tenant IDs must match exactly; tenant change remains owned by REQ-AUTH-017. |

## Edge cases and unhappy paths

- **Concurrent duplicate delivery.** One request can complete rotation before a
  duplicate is recognized. The duplicate then revokes the family, including
  the just-issued generation. This availability cost is intentional reuse
  containment.
- **State change after a read.** The access token is still subject to live
  session, user, and tenant-membership checks on use. Revocation does not rely
  solely on the snapshot embedded in the token.
- **Migration.** Migration 019 invalidates pre-migration remembered bearers and
  is security-irreversible; it does not copy recoverable bearer material.
- **Cache outage.** Rotation continues from durable state. Cache remains useful
  for short-circuit JTI denial but is not consulted as refresh authority.

## Risk

- **Likelihood:** High — every remembered session uses this path repeatedly.
- **Impact:** Critical — replay can mint a fresh authenticated session after
  credential theft or logout.
- **Mitigations:** Hash-only storage, mandatory compare-and-swap rotation,
  family-wide reuse revocation, live authority checks, and transactional audit
  and event publication.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Exact tenant binding is immutable
  throughout a family.
- **REQ-004 — Audit per mutation.** Successful rotation and terminal revocation
  commit with their audit intent and catalogued event.
- **REQ-005 — Fail closed.** Unknown durable or eligibility state emits no
  credential.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-5, AC-9 — only current eligible principals renew access. |
| SOC2 CC6.7 | AC-2, AC-3, AC-4 — bearer secrecy, single use, and reuse containment. |
| ISO27001 A.9.4 | AC-4, AC-5, AC-7 — durable revocation and live access control. |
| OWASP ASVS 3.2.1 | AC-3 and AC-4 — rotating refresh credentials with replay detection. |

## Satisfied by

- `auth_management/features/authentication/refresh_token.go`
- `auth_management/features/authentication/refresh_token_store.go`
- `auth_management/features/authentication/login_session.go`
- `auth_management/migrations/019_create_durable_refresh_token_families.up.sql`
- `auth_management/features/authentication/refresh_token_durable_test.go`

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md)
- [REQ-AUTH-016 — Token verification](./REQ-AUTH-016-token-verification.md)
- [REQ-AUTH-017 — Session lifecycle](./REQ-AUTH-017-session-lifecycle.md)
- [ADR 0067 — Refresh tokens use durable single-use families](../adr/0067-refresh-tokens-use-durable-single-use-families.md)
