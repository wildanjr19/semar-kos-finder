# Phase 3: Responsive UX Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 3-Responsive UX Scaffolding
**Areas discussed:** result count, active chips, default chips, mobile layout, desktop sidebar, mobile preview list, accordion badges

---

## Result Count Meaning

| Option | Description | Selected |
|--------|-------------|----------|
| A | Show total loaded kos only: `X kos ditemukan` | ✓ |
| B | Show mock “filtered” count based on active UI state | |

**User's choice:** Defaults (A)
**Notes:** v1 has no wired filtering logic.

---

## Active Chips Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| A | Chips reflect selected controls, removable one-by-one, plus `Hapus semua` | ✓ |
| B | Chips display only, no removal | |

**User's choice:** Defaults (A)
**Notes:** Matches UX-01.

---

## Default Chips Hidden

| Option | Description | Selected |
|--------|-------------|----------|
| A | Hide defaults like `bulanan`, `Semua` | ✓ |
| B | Show every state | |

**User's choice:** Defaults (A)
**Notes:** Only active/non-default filters become chips.

---

## Mobile Layout

| Option | Description | Selected |
|--------|-------------|----------|
| A | Bottom sheet collapsed to handle/count, opens over bottom `70dvh` | ✓ |
| B | Full-screen drawer | |

**User's choice:** Defaults (A)
**Notes:** Keeps map visible and matches UX-04.

---

## Desktop Sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep existing collapsible sidebar, add count/chips inside | ✓ |
| B | Rework sidebar width/layout | |

**User's choice:** Defaults (A)
**Notes:** Minimal and preserves Phase 1/2 behavior.

---

## Preview List On Mobile

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep below filter panel inside bottom sheet | ✓ |
| B | Hide preview list on mobile | |

**User's choice:** Defaults (A)
**Notes:** Avoid behavior loss.

---

## Accordion Badges

| Option | Description | Selected |
|--------|-------------|----------|
| A | Add small active-count badges per section | ✓ |
| B | Skip | |

**User's choice:** Defaults (A)
**Notes:** Phase 2 deferred this to Phase 3.

---

## the agent's Discretion

- Component/file split for chips, count summary, bottom sheet handle, and badge helpers.
- Exact styling details within existing prototype visual language.

## Deferred Ideas

- Real client-side filtering and filtered result counts remain v2.
- Full-screen mobile drawer not selected.
- Desktop sidebar layout overhaul not selected.
