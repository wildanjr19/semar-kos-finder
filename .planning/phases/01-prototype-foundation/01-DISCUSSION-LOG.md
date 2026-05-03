# Phase 1: Prototype Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 1-Prototype Foundation
**Areas discussed:** Sidebar layout prep for filters, Shared types extraction, State management pattern, Code organization

---

## Sidebar layout prep for filters

| Option | Description | Selected |
|--------|-------------|----------|
| Filters above stats | Filter controls at top, existing stats/preview below | |
| Filters replace stats | Filter controls replace stats badges, preview list stays below | ✓ |
| Keep current, Phase 2 decides | Leave sidebar as-is for Phase 1 | |

**User's choice:** Filters replace stats
**Notes:** Stats become secondary or move into filter chips.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep preview list | Stays below filters, may need scrollable container | |
| Remove preview list | Remove entirely, map markers are primary browsing | |
| Make it collapsible | Starts collapsed, expands on click | ✓ |

**User's choice:** Make it collapsible
**Notes:** Saves space but keeps quick-browse capability.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible on desktop | Toggle button to collapse/expand; Phase 3 adapts for mobile | ✓ |
| Always visible on desktop | Fixed open; Phase 3 handles mobile separately | |
| Auto-collapse on small desktop | Auto-collapses at narrow viewport | |

**User's choice:** Collapsible on desktop
**Notes:** Phase 3 will adapt this pattern for mobile bottom sheet.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar scrolls independently | Sidebar has own scroll, map stays fixed | |
| Entire page scrolls | Map and sidebar scroll together | |
| You decide | Agent chooses based on best practices | ✓ |

**User's choice:** You decide
**Notes:** Agent has discretion on scroll behavior.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Icon button only | Only toggle button at edge | |
| Mini stats bar | Slim strip showing count + toggle | |
| Floating action button | FAB-style toggle over map | ✓ |

**User's choice:** Floating action button
**Notes:** Modern mobile-like pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed width (e.g., 360px) | Consistent width | |
| Adapt to content | Grows/shrinks based on content | |
| Fixed with responsive breakpoint | Fixed on desktop, full-width on narrow | ✓ |

**User's choice:** Fixed with responsive breakpoint
**Notes:** Prepares for Phase 3 mobile behavior.

---

## Shared types extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Extract in Phase 1 | Create shared types file now, both components import | ✓ |
| Defer to Phase 2 | Keep duplicates, Phase 2 extracts | |
| Extract types only, not utilities | Shared types file but keep helpers duplicated | |

**User's choice:** Extract in Phase 1
**Notes:** Clean foundation for Phase 2 filter components.

---

| Option | Description | Selected |
|--------|-------------|----------|
| frontend/types/kos.ts | Dedicated types directory | ✓ |
| frontend/lib/types.ts | Utility/types directory | |
| frontend/components/types.ts | Co-located with components | |

**User's choice:** frontend/types/kos.ts
**Notes:** Clear separation, common convention.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both files | Refactor Map.tsx and CleanMapPrototype.tsx | ✓ |
| Prototype only | Only CleanMapPrototype.tsx uses shared types | |
| Prototype now, Map later | CleanMapPrototype now, Map.tsx when integrating | |

**User's choice:** Both files
**Notes:** Eliminates all duplication.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Extract helpers too | Create shared helpers file | ✓ |
| Keep helpers duplicated | Only extract types | |
| Extract only formatting helpers | Extract pure formatting, keep UI helpers inline | |

**User's choice:** Extract helpers too
**Notes:** Create frontend/lib/kos-helpers.ts.

---

## State management pattern

| Option | Description | Selected |
|--------|-------------|----------|
| React Context + useState | Create KosFilterContext at page level | |
| Component props + lifting state | State in page component, passed down via props | ✓ |
| URL query params (prep for v2) | Store filter state in URL from start | |

**User's choice:** Component props + lifting state
**Notes:** Simple, explicit data flow. No new dependencies.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Create empty state now | Phase 1 creates page-level state with empty defaults | |
| Restructure only | Reorganize hierarchy, no actual filter state in Phase 1 | |
| You decide | Agent decides based on cleanest component split | ✓ |

**User's choice:** You decide
**Notes:** Agent discretion.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Lift data fetching | Page fetches data and passes down | |
| Keep in component | CleanMapPrototype continues fetching | |
| You decide | Agent decides based on component split | ✓ |

**User's choice:** You decide
**Notes:** Agent discretion.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to page | Page controls sidebar visibility | |
| Keep local | Sidebar manages its own state | |
| You decide | Agent decides based on map reaction needs | ✓ |

**User's choice:** You decide
**Notes:** Agent discretion.

---

## Code organization

| Option | Description | Selected |
|--------|-------------|----------|
| Map + Sidebar only | Extract just two top-level components | |
| Map + Sidebar + Popup | Also extract popup content | |
| Full decomposition | Extract Map, Sidebar, Popup, RouteControls, StatsBar, PreviewList, LoadingState, ErrorState | ✓ |

**User's choice:** Full decomposition
**Notes:** Most maintainable, sets up Phase 2 well.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to CSS modules | Extract styles to .module.css files | ✓ |
| Keep inline styles | Faster iteration for prototype | |
| Hybrid approach | Dynamic inline, static layout to CSS modules | |

**User's choice:** Convert to CSS modules
**Notes:** Better maintainability, aligns with admin/ conventions.

---

| Option | Description | Selected |
|--------|-------------|----------|
| frontend/components/prototype/ | Dedicated prototype subdirectory | |
| frontend/app/prototype/clean-map/components/ | Co-located with page | ✓ |
| frontend/components/ (flat) | Flat structure | |

**User's choice:** frontend/app/prototype/clean-map/components/
**Notes:** Next.js App Router convention, scoped to prototype.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor Map.tsx too | Apply same decomposition to production map | ✓ |
| Prototype only | Only refactor CleanMapPrototype.tsx | |
| Minimal Map.tsx changes | Only update types/helpers, skip decomposition | |

**User's choice:** Refactor Map.tsx too
**Notes:** Consistent codebase, eliminate tech debt.

---

## Agent's Discretion

- Scroll behavior (sidebar independent scroll vs entire page scroll)
- Whether to create empty lifted state structure in Phase 1 or defer to Phase 2
- Whether to lift data fetching to page level in Phase 1
- Whether to lift sidebar open/closed state to page level

## Deferred Ideas

None — discussion stayed within phase scope.
