# Semar Kos Finder — Search & Filter Prototype

## What This Is

A search and filtering UI prototype for the Semar Kos Finder public map. The prototype lives in `frontend/prototype/clean-map` and explores how users can filter kos listings using all fields from the cleaned parsed data (`KosClean`). This is a design/UX exploration before deciding on production integration.

## Core Value

Users can quickly narrow down kos listings on the map to find options that match their preferences (price, facilities, rules, room type).

## Requirements

### Validated

- ✓ Public map renders kos markers with MapLibre GL — existing
- ✓ Directions routing via Google Routes API — existing
- ✓ Admin dashboard with JWT auth and protected routes — existing
- ✓ CRUD for kos and master UNS records — existing
- ✓ LLM parse/review/publish pipeline for structured data cleaning — existing
- ✓ FastAPI REST API with Pydantic models and Motor/MongoDB — existing
- ✓ Docker Compose multi-profile dev/staging/prod — existing
- ✓ CI/CD with GitHub Actions and GHCR — existing

### Active

- [ ] Filter UI prototype page at `frontend/prototype/clean-map`
- [ ] Prototype fetches real kos data from existing `/api/kos` endpoint
- [ ] Filter panel covers all `KosClean` fields: jenis_kos, ac_status, harga range, fasilitas categories, peraturan rules, tipe_pembayaran
- [ ] UI is a full mock with real data displayed but no active filtering logic wired
- [ ] Prototype uses existing `CleanMapPrototype.tsx` patterns and `KosClean` TypeScript types

### Out of Scope

- Backend API filtering/query params — prototype uses client-side data only; backend changes deferred until integration decision
- Integration into production public map (`frontend/app/page.tsx`) — out of scope for this milestone; prototype evaluates UX first
- Reviews & ratings — not part of this work
- Booking or inquiry flow — not part of this work
- Mobile-native app — web-only

## Context

Semar Kos Finder is an existing three-app stack (public map, admin dashboard, FastAPI backend) with MongoDB. A codebase map exists at `.planning/codebase/`. The public map currently shows all kos markers without filtering. The admin side has an LLM-driven data cleaning pipeline that produces structured `KosClean` documents. This prototype explores how to expose that rich structured data to public map users through filters.

## Constraints

- **Tech stack**: Must use existing Next.js 16, React 19, MapLibre GL, TypeScript. No new dependencies without justification.
- **Data contract**: Must align with existing `KosClean` Pydantic model and TypeScript interfaces.
- **Backend**: No backend changes for this prototype phase.
- **Scope**: UI mock only — interactive filtering logic is not required for prototype completion.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prototype-first in isolated folder | De-risk UX before modifying production map | — Pending |
| Client-side filtering approach | No backend changes needed for prototype | — Pending |
| UI mock without wired logic | Focus on layout and information architecture first | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 after initialization*
