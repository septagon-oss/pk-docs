---
id: REQ-006
title: "Migrations are forward-only and idempotent"
status: Active
date: 2026-05-06
slug: req-006-forward-only-migrations
category: data-durability
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - inspection
  - test
satisfied_by:
  adr: [ADR-0005]
  conventions: [C-01]
type: doc
tags: [requirement, data-durability]
---

# REQ 006 — Migrations are forward-only and idempotent

Status: **Active** (2026-05-06)

## Statement

The system **shall** treat every committed database migration file as
read-only after commit. Schema corrections **shall** ship as additional
migrations with higher sequence numbers; existing files **shall not**
be edited in place. Each migration **shall** apply cleanly when re-run
against an already-migrated schema (idempotent) and **shall** complete
the schema when applied to a partial state.

## Rationale

The migration runner records versions, not checksums. Editing a
committed migration after it has been applied in any environment —
local dev, staging, production — silently diverges that environment's
schema from every other environment's. The discipline holds
unconditionally: even for migrations no environment has applied yet,
because dev and staging checkouts can diverge the moment one of them
re-runs an edited version.

Idempotence sits alongside append-only because operational reality is
messy. A deployment can crash mid-migration; a tenant overlay can apply
a partial set of migrations before the operator runs the full sequence;
a recovered backup can be a few migrations behind production. Each of
those scenarios must be recoverable by running the full migration
sequence again, not by manual schema surgery.

## Acceptance criteria

- **AC-1** No pull request modifies a migration file (`*.up.sql` /
  `*.down.sql`) that already exists on the target branch's history.
  Schema corrections appear as new migration files with higher
  sequence numbers.
- **AC-2** Every migration uses `IF NOT EXISTS` / `IF EXISTS` /
  `INSERT ... ON CONFLICT DO NOTHING` so re-running it is a no-op.
- **AC-3** A test environment regularly exercises both
  "apply migrations from scratch" and "apply migrations on top of a
  partial schema"; both succeed without manual intervention.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make -C pk-modules check-migrations-append-only` rejects edits to already-tracked migration files. |
| AC-1 | Inspection | Code-review checklist item — reviewers reject any PR that modifies an already-committed migration. |
| AC-2 | Inspection | Migration template + scaffolder seed enforce idempotent SQL idioms. |
| AC-3 | Inspection | Migration replay against a clean schema is exercised end-to-end through the showroom bring-up (`pk-apps/Makefile::showroom-up`) and the pk-testkit E2E harness, both of which run all migrations from scratch on every cold start. **Verification gap: dedicated `TestMigrations_ApplyFromScratch` / `TestMigrations_ApplyOnPartialSchema` Go tests under `pk-modules/tests/` are pending.** |

## Satisfied by

- [ADR 0005 — Error-handling discipline](../adr/0005-error-handling-discipline.md) —
  the broader "no silent failures" posture this migration discipline
  is one application of.
- [Convention C-01 — Migrations are append-only](../conventions.md#c-01-migrations-are-append-only) —
  the mechanical rule reviewers enforce.

## Related requirements

(None today.)

## References

- `<module>/migrations/` directories across business modules.
- `pk-docs/sync/README.md` — the doc-sync analogue that
  borrows the same discipline.
