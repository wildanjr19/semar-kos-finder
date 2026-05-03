# Phase 2: Filter Panel UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 2-Filter Panel UI
**Areas discussed:** shadcn+Tailwind, Accordion grouping, Location filter, Stats bar fate, Filter component style

---

## shadcn + Tailwind

| Option | Description | Selected |
|--------|-------------|----------|
| Install shadcn + Tailwind v4 | Pre-built accessible filter controls. Aligns with modern Next.js standard. | ✓ |
| Continue CSS modules | Consistent with Phase 1 prototype pattern. No new deps. Hand-build every filter control. | |
| You decide | Let the agent pick based on what fits best after exploring. | |

**User's choice:** Install shadcn + Tailwind v4
**Notes:** Phase 1 explicitly deferred this decision. User confirmed installation was expected direction.

---

## Accordion grouping

| Option | Description | Selected |
|--------|-------------|----------|
| 4 sections by category | Room (Gender+AC), Billing (Price+Payment), Facilities, Rules. Search+Location standalone bar above. | ✓ |
| 3 sections | Kelengkapan (Gender+AC+Facilities), Biaya (Price+Payment), Ketentuan (Rules). | |
| 5 sections | 8 granular sections, one per filter type. | |

**User's choice:** 4 sections by category
**Notes:** Search text and Location campus selector are standalone above accordion, not inside any section.

---

## Location filter

| Option | Description | Selected |
|--------|-------------|----------|
| Campus building selector | Dropdown/searchable from master_uns. No geolocation needed. | ✓ |
| Near-me + radius | Browser geolocation + radius slider. Requires permission. | |
| Both (campus + near-me) | Both options available. Most flexible but most UI complexity. | |

**User's choice:** Campus building selector
**Notes:** No near-me geolocation. Deferred to v2 if needed.

---

## Stats bar fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove stats bar entirely | Gender breakdown will surface in Phase 3 filter chips. | ✓ |
| Collapse below accordion | Keep at bottom of sidebar, collapsible. | |
| Replace with mini count | Single line showing total kos count. | |

**User's choice:** Remove stats bar entirely
**Notes:** StatsBar component removed from page.tsx composition. No replacement in Phase 2.

---

## Filter component style

| Option | Description | Selected |
|--------|-------------|----------|
| Chips for binary/ternary | Gender, AC, Payment as chips. Checkboxes for facilities. Select/radio for rules. Inputs for price. | ✓ |
| Dropdowns/selects for everything | Uniform shadcn Select for all filters. | |
| Mixed (chips + slider + inputs) | Slider for price, chips for gender/AC, etc. Most expressive but varied. | |

**User's choice:** Chips for binary/ternary
**Notes:** Gender (3-way chip), AC (3-way chip), Payment (chip group), Facilities (per-category checkboxes), Rules (select/toggle mixed), Price (min/max inputs + period select).

---

## the agent's Discretion

- FilterPanel sub-component granularity
- Whether to use barrel exports or separate imports
- Specific shadcn component selection (Accordion vs Collapsible, Command vs Select)
- Price range default values and period options
- Filter count badges on accordion headers (deferred or included)

## Deferred Ideas

- Near-me geolocation filter — future v2
- Radius slider for proximity — future v2
- Filter count badges on accordion headers — Phase 3 styling detail
