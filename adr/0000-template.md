---
title: "ADR NNNN: <one-sentence decision>"
status: Proposed
date: YYYY-MM-DD
slug: adr-NNNN-short-slug
adr_topic: <area>
type: doc
tags: [adr]
---

# ADR NNNN — <one-sentence decision>

Status: **Proposed** (YYYY-MM-DD)

> **Voice guide.** Write like a person with a point of view explaining
> to another engineer why we picked this. Use "we". Lead every section
> with prose; let bullets carry detail, not narrative. Keep precision
> — every analyzer name, every exception, every gap stays — but wrap
> it in a voice.

## The problem

Two or three paragraphs of narrative. What hurt, what we watched go
wrong, what incident or audit surfaced this. Don't open with a bullet
list — a bullet list is the "what"; this section is the "why it's
worth deciding about".

## The decision

Declarative. The single choice we made. Lead with one paragraph of
prose stating the decision plainly, then use a short bullet list or
code block only if the decision has discrete clauses that benefit
from being called out individually. If the decision boils down to
"we chose X over Y", the paragraph should say so in those words.

## What we gave up

Two to four bullets, each one sentence. Be honest. A decision worth
recording has real costs — the reader trusts the ADR more when it
names them.

- Cost 1.
- Cost 2.

## What we kept

Two to four bullets. Real benefits (not the opposite of the costs).

- Benefit 1.
- Benefit 2.

## How we enforce it

List every machine check, every review rule, every gap. Preserve file
paths and analyzer names verbatim — this section is the map from
the decision to the code that enforces it. If the enforcement is
"review only", say so; if there's a tracked follow-up to close the
gap, name it.

- `analyzer-name` (`path/to/source.go`) — what it catches.
- Gap — what isn't enforced today and what would close it.

## References

Anything a future reader should follow to understand the decision:

- Motivating commits.
- Related ADRs: `[ADR NNNN](./NNNN-slug.md)`.
- Related conventions: `[Convention C-NN](../conventions.md#c-nn-slug)`.
- External material (RFCs, blog posts, papers).

---

## Authoring notes (delete before committing)

- Number the file with the next free `NNNN-`.
- The h1 title, the frontmatter title, and the sidebar text should all
  say the same thing — a declarative sentence, not a category name.
- Keep the body under one long page-scroll where possible. Link out
  for runbooks and migration guides.
- Dates are ISO 8601 (`YYYY-MM-DD`).
- A rule that follows mechanically from another decision is probably
  a convention, not an ADR. See `conventions.md` for the distinction.
