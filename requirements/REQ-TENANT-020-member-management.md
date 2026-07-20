---
id: REQ-TENANT-020
title: "Tenant member management binds users to tenants with role-typed records and audit-bearing transitions"
status: Proposed
date: 2026-05-08
slug: req-tenant-020-member-management
category: tenant
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.2
  - ISO27001_A.9.2.2
  - ISO27001_A.9.2.6
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-TENANT-002
type: doc
tags: [requirement, capability, tenant_management, member, role]
module: tenant_management
feature: tenant_lifecycle
capability: member_management
capability_kind: state_machine
stakeholders:
  - tenant administrator (manages the team)
  - operator (incident-driven member removal)
  - compliance auditor (membership timeline)
---

# REQ TENANT-020 — Tenant member management

Status: **Proposed** (2026-05-08)

## Statement

The tenant lifecycle feature **shall** expose a member-management
surface that binds users to tenants:

1. **`AddMember(tenantID, req)`** — verify the tenant exists,
   construct a `TenantMember` record with the requested role,
   record the inviter from `appcontext` when present, persist
   via the wrapped member repository, and increment
   `tenant.member.added`.
2. **`RemoveMember(tenantID, userID)`** — delete the
   `(tenant_id, user_id)` member row. The operation **shall**
   refuse with a `member not found` error when no row matches
   and **shall** increment `tenant.member.removed` only on
   actual deletion.
3. **`UpdateMemberRole(tenantID, userID, role)`** — read the
   matching member, set the new role, persist. A missing
   member returns a typed not-found error.
4. **`GetMember(tenantID, userID)`** — return the member DTO
   when found, `(nil, nil)` when missing (used as a probe by
   the admin UI).
5. **`ListMembers(tenantID, filter)`** — paginated list scoped
   to the tenant; status / role filters honoured when the
   caller's slice is non-empty.

## Rationale

Membership is the edge in the user-tenant graph that every
permission check, navigation gate, and admin-UI selector queries.
Three pressures shape the surface:

1. **Tenant-existence verification.** `AddMember` reads the
   tenant before writing the member — without this, a typo'd
   tenant id creates a dangling member row that no admin path
   can reach.
2. **Email-as-userID-on-invite is a deliberate transient
   identifier.** Until `user_management` resolves the email
   to a concrete user record (boundary reader), the invite
   row carries the email in the `UserID` slot. The boundary
   reader's lookup-by-email path is what makes invites work
   before the user record exists.
3. **`GetMember` is a probe, not an assertion.** The admin UI
   uses it to populate "are you already a member?" badges; a
   not-found return is `(nil, nil)`, not an error. List paths
   that need a definitive answer use the underlying typed
   filter directly.

The list path's `firstStringFilter` adapter is documented anchor:
an empty slice means "no clause" (so the listing returns every
member of the tenant), not "Eq against the empty string" (which
would silently filter to zero results).

## Acceptance criteria

- **AC-1 — Add verifies tenant + persists member.** A
  successful `AddMember` first reads the tenant (refuses
  with a wrapped error if missing), then persists the
  `TenantMember` record, increments
  `tenant.member.added`, and returns the DTO.
- **AC-2 — Add captures inviter from context.** When
  `appcontext.GetUserFromContext` returns a user, the
  persisted member's `InvitedBy` is set to the caller's user
  id; absent context leaves `InvitedBy` nil.
- **AC-3 — Remove returns typed not-found on miss.** A
  `RemoveMember` against a (tenant, user) pair with no
  matching row returns `member not found` and does not
  increment the metric.
- **AC-4 — Update role refuses missing member.** An
  `UpdateMemberRole` against a missing member returns the
  wrapped not-found error from the repository read.
- **AC-5 — Get returns nil on miss.** `GetMember` against a
  missing pair returns `(nil, nil)` — the admin UI probe
  cannot raise.
- **AC-6 — List filters honour empty-slice semantics.** A
  `MemberFilter{Status: nil, Role: nil}` returns every
  member of the tenant; a `Status: []string{"active"}`
  filter applies an `Eq` clause; a `Status: []string{""}`
  filter applies no clause (the empty string is treated as
  "no value provided").
- **AC-7 — List pagination derives page from offset/limit.**
  When `Offset > 0` and `Limit > 0`, the resulting
  `Page = Offset/Limit + 1`; both default to the
  admin-UI's normalised page size when the caller omits
  them.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestAddMember_Success` and `TestAddMember_TenantNotFound` — the latter exercises the tenant-existence verification before persist. |
| AC-2 | Inspection | `service_members.go::AddMember` lines 45–48 — the `appcontext.GetUserFromContext` branch sets `member.InvitedBy`. Dedicated context-capture test pending. |
| AC-3 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestRemoveMember_NotFound` — typed `member not found` return; `TestRemoveMember_Success` and `TestRemoveMember_DatabaseError` cover the success and error branches. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestUpdateMemberRole_MemberNotFound` — wrapped not-found error; `TestUpdateMemberRole_Success` covers the happy path. |
| AC-5 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestGetMember_NotFound` — `(nil, nil)` on miss; `TestGetMember_Success` and `TestGetMember_UsesCrossTenantAccess` cover the resolution paths. |
| AC-6 | Inspection | `service_members.go::firstStringFilter` lines 149–154 — empty slice returns nil (no Eq clause). `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestListMembers_Success` covers the populated-filter branch. Dedicated empty-filter regression test pending. |
| AC-7 | Inspection | `service_members.go::ListMembers` lines 124–130 — `Page = (Offset/Limit) + 1` derivation. Dedicated pagination-derivation test pending. |

## Edge cases & unhappy paths

- **Duplicate add.** A second `AddMember` for the same
  (tenant, user) pair returns the repository's uniqueness
  error verbatim; the service does not pre-empt.
- **Email-cased invite.** The `UserID` slot carries the
  email exactly as supplied; downstream resolution to the
  canonical user record happens at the boundary reader.
- **Concurrent role update.** Last-write-wins; the read →
  mutate → write path can lose a racing change.
- **Remove of self by tenant owner.** The repository allows
  it; the service does not gate. Owner-of-last-resort
  protection is REQ-AUTH-051's concern (cross-tenant
  policy).
- **List with `Limit = 0`.** Falls through to the
  admin-UI normalised default page size; callers cannot
  opt into "no pagination" via this surface.

## Risk

- **Likelihood:** High — exercised on every team-management
  flow.
- **Impact:** High — a defective add or remove breaks the
  tenant-isolation guarantee for the affected user-tenant
  pair.
- **Mitigations:** Tenant-existence verification (AC-1),
  typed not-found errors on every miss (AC-3, AC-4),
  admin-UI probe semantics for `GetMember` (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Every operation is
  tenant-scoped; the (tenant_id, user_id) pair is the
  uniqueness key.
- **REQ-004 — Audit per mutation.** Add / remove / update
  emit catalogued `tenant.member.*` events upstream.
- **REQ-009 — Observability.** AC-1 + AC-3 emit metrics on
  the success path.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1..AC-4 — every membership transition is auditable. |
| SOC2 CC6.2 (Provisioning) | AC-1 + AC-2 — invite + inviter trail. |
| ISO27001 A.9.2.2 (User access provisioning) | AC-1 — formal provisioning event. |
| ISO27001 A.9.2.6 (Removal/adjustment of access rights) | AC-3 + AC-4 — remove + role update events. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_members.go::AddMember, RemoveMember, UpdateMemberRole, GetMember, ListMembers`.

## Related requirements

- [REQ-TENANT-002 — Member management feature](./REQ-TENANT-002-member-management.md)
- [REQ-TENANT-010 — Tenant create](./REQ-TENANT-010-tenant-create.md) — the first member is seeded by the create flow.
- [REQ-AUTH-040 — Permission check](./REQ-AUTH-040-permission-check.md) — the governed decision that uses this exact tenant scope without treating membership metadata as a grant.
