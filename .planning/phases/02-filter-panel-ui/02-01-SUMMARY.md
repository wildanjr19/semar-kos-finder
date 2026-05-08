---
phase: 02-filter-panel-ui
plan: 01
subsystem: ui
tags: [shadcn, tailwind, react, nextjs, typescript]

requires:
  - phase: 01-prototype-foundation
    provides: page composition with lifted state, Sidebar children API, KosClean types, prototype components
provides:
  - shadcn/ui + Tailwind CSS v4 foundation with teal theme
  - 8 shadcn UI components for filter controls
  - FilterState type and DEFAULT_FILTER_STATE at page level
  - Campus list data fetch from /api/master-uns
  - StatsBar removed from prototype sidebar
affects: [02-filter-panel-ui plans 02-02, 02-03]

tech-stack:
  added:
    - shadcn/ui (Radix-based component library)
    - Tailwind CSS v4
    - lucide-react (icons)
    - class-variance-authority, clsx, tailwind-merge
    - tw-animate-css
  patterns:
    - Teal primary color theme via @theme inline CSS variables
    - @/* path alias for shadcn component imports
    - shadcn components use @/components/ui/ import paths via aliases.json
    - globals.css with @import "tailwindcss" and @import "tw-animate-css"

key-files:
  created:
    - frontend/app/globals.css
    - frontend/lib/utils.ts
    - frontend/postcss.config.mjs
    - frontend/components.json
    - frontend/components/ui/accordion.tsx
    - frontend/components/ui/checkbox.tsx
    - frontend/components/ui/select.tsx
    - frontend/components/ui/input.tsx
    - frontend/components/ui/command.tsx
    - frontend/components/ui/popover.tsx
    - frontend/components/ui/badge.tsx
    - frontend/components/ui/label.tsx
    - frontend/components/ui/dialog.tsx (popover peer dependency)
  modified:
    - frontend/tsconfig.json (added @/* path alias)
    - frontend/package.json (added 8 dependencies)
    - frontend/app/layout.tsx (added globals.css import)
    - frontend/app/prototype/clean-map/page.tsx (removed StatsBar, added FilterState + filter state + campus fetch)
    - frontend/app/prototype/clean-map/components/index.ts (removed StatsBar export)

key-decisions:
  - "Used `npm exec shadcn` instead of `npx shadcn` due to npm v11+ CLI behavior changes"
  - "Manually created components.json and globals.css because shadcn v4 init couldn't auto-detect the Next.js framework version"
  - "FilterState defined inline in page.tsx (not in types/kos.ts) to keep filter UI types colocated with the page that owns the state"
  - "Campus list fetched with separate useEffect parallel to existing loadDestinations, sharing the same /api/master-uns endpoint"

requirements-completed: [UX-03]

duration: 18min
completed: 2026-05-08
---

# Phase 2 Plan 01: shadcn/Tailwind foundation, StatsBar removal, filter state scaffolding

**shadcn/ui + Tailwind CSS v4 initialized with teal primary (#0f766e), path alias configured, 8 filter components installed, StatsBar removed, and FilterState type scaffolded at page level with campus data fetch.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-08T07:44:15Z
- **Completed:** 2026-05-08T08:02:15Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Installed Tailwind CSS v4, shadcn/ui with 8 components (Accordion, Checkbox, Select, Input, Command, Popover, Badge, Label) + dialog (peer dep)
- Configured `@/*` path alias for shadcn imports in tsconfig.json
- Created globals.css with Tailwind directives and teal @theme block matching UI-SPEC §Color
- Removed StatsBar component from page.tsx sidebar children and index.ts barrel exports
- Defined `FilterState` type with 12 fields matching all 8 KosClean filter categories
- Added `DEFAULT_FILTER_STATE`, `filterState` useState, campusList useState, and campus-name fetch useEffect to page.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure path alias, install Tailwind, init shadcn** — `f3c1be9` (feat)
2. **Task 2: Add shadcn components, customize teal theme** — Bundled in Task 1 commit (components installed during same execution flow, no separate changes needed)
3. **Task 3: Import globals.css, remove StatsBar, add filter state scaffolding** — `df50cfe` (feat)

## Files Created/Modified

- `frontend/tsconfig.json` — Added `@/*` path alias in compilerOptions
- `frontend/postcss.config.mjs` — PostCSS config with @tailwindcss/postcss plugin
- `frontend/app/globals.css` — Tailwind v4 directives + teal @theme inline block
- `frontend/lib/utils.ts` — `cn()` utility with clsx + tailwind-merge
- `frontend/components.json` — shadcn configuration with @/ paths
- `frontend/components/ui/` — 9 shadcn components (accordion, badge, checkbox, command, dialog, input, label, popover, select)
- `frontend/app/layout.tsx` — Added `import "./globals.css"`
- `frontend/app/prototype/clean-map/page.tsx` — Removed StatsBar, added FilterState type, DEFAULT_FILTER_STATE, filter state + campus list state + campus useEffect
- `frontend/app/prototype/clean-map/components/index.ts` — Removed StatsBar export

## Decisions Made

- Used `npm exec shadcn` instead of `npx shadcn` because npm v11+ resolved `npx shadcn` to a missing npm script rather than a remote package
- Manually created components.json and globals.css because shadcn v4 `init` couldn't auto-detect the Next.js framework version with this project's configuration
- FilterState type defined inline in page.tsx rather than exported from types/kos.ts — colocated with its only consumer, keeps type changes scoped
- Campus list fetch uses a dedicated useEffect (parallel to existing loadDestinations) extracting building names from the same /api/master-uns response

## Deviations from Plan

None — plan executed as written. Minor CLI adaptation (`npm exec shadcn` instead of `npx shadcn@latest`) was necessary due to npm v11+ behavior but does not change the outcome.

## Issues Encountered

- `npx shadcn@latest init -y --defaults` failed because shadcn v4 couldn't auto-detect this project's Next.js framework. Workaround: created components.json, lib/utils.ts, and globals.css manually, then used `npm exec shadcn add` to install components. This is the recommended manual installation path per shadcn docs.
- `npx shadcn@latest add` didn't work (npm 11+ resolved it as an npm script). Workaround: used `npm exec shadcn add` instead.

## Stubs

None — all created files are fully functional `@theme` CSS, component config, and type definitions. No data-placeholder stubs.

## Threat Surface Scan

No new threat surface introduced — all work is client-side UI only (CSS, types, component installation). No new network endpoints, auth paths, or file access patterns.

## Next Phase Readiness

- Ready for Plan 02-02: FilterPanel component with SearchBar, LocationSelector, Room (Kamar) + Billing (Pembayaran) accordion sections
- FilterState type, campusList state, and filterState useState are already wired at page level — Plan 02-02 just needs to pass them as props to FilterPanel

---

*Phase: 02-filter-panel-ui*
*Completed: 2026-05-08*
