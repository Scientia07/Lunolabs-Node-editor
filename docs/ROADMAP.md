# Roadmap — Netzwerk-Editor

**Last Updated**: 2026-03-06
**Master PRD**: `docs/prd/2026-03-04-master-prd-netzwerk-editor.md`
**Research**: `docs/research/INDEX.md`

---

## Legend

- `[x]` Done
- `[ ]` Pending
- `[~]` Partial / In Progress
- Phases are ordered by priority — implement top to bottom

---

## Phase 7: Node Metadata System (Foundation) ✅ DONE

> **Completed**: 2026-03-05
> **Plan**: `docs/plans/archive/2026-03-05-metadata-system.md`

| # | Task | Files | Status |
|---|------|-------|--------|
| M1 | Add `meta` object to node data model | `state.js` | ✅ Done (auto — plain objects) |
| M2 | Serialize meta in JSON export | `utils.js` | ✅ Done (auto — serializeProject passes nodes through) |
| M3 | Load meta from JSON import | `persistence.js`, `project.js` | ✅ Done (auto — backward-compatible) |
| M4 | Render `data-tier` attribute on company nodes | `renderer.js` | ✅ Done — `getTier()` derives from relevancy |
| M5 | Relevancy → opacity auto-mapping | `renderer.js` | ✅ Done — `effectiveOpacity` logic |
| M6 | Predefined field suggestions | `constants.js` | ✅ Done — `SUGGESTED_META_FIELDS` (8 fields) |

**Design decision:** Tier is *derived* from relevancy (`>5 = nah`, `<=5 = satellit`), not a separate toggle. This simplifies the UI to a single slider.

---

## Phase 7B: Sidebar Details Tab (UI) ✅ DONE

> **Completed**: 2026-03-05

| # | Task | Files | Status |
|---|------|-------|--------|
| D1 | Add "Details" tab to sidebar HTML | `index.html` | ✅ Done |
| D2 | Render Details tab content | `sidebar.js` | ✅ Done — `renderDetailsTab()` |
| D3 | Tier badge (derived from relevancy) | `sidebar.js` | ✅ Done — Nah/Satellit badge, auto-derived |
| D4 | Relevancy slider (1-10) | `sidebar.js` | ✅ Done — live preview + undo on change |
| D5 | Contact fields (predefined) | `sidebar.js` | ✅ Done — 7 fields from SUGGESTED_META_FIELDS |
| D6 | Custom metadata fields | `sidebar.js` | ✅ Done — add/edit/delete key-value pairs |
| D7 | Multi-select batch editing | `sidebar.js` | ✅ Done — batch relevancy slider |
| D8 | Sidebar styles for Details tab | `sidebar.css` | ✅ Done |

---

## Phase 7C: Visual Tier System (Gradient Wash) ✅ DONE

> **Completed**: 2026-03-05

| # | Task | Files | Status |
|---|------|-------|--------|
| V1 | Satellite CSS class | `nodes.css` | ✅ Done — `.node-company--satellite` with `::before` gradient |
| V2 | Apply satellite class in renderer | `renderer.js` | ✅ Done — `--sector-rgb` CSS var from parent sector |
| V3 | Parse sector color to RGB | `utils.js` | ✅ Done — `hexToRgb()` helper |
| V4 | Dark theme variant | `nodes.css` | ✅ Done — 20%/6% opacity in dark theme |

---

## Phase 8: CSV Export ✅ DONE

> **Depends on**: Phase 7 (meta must exist to export)
> **Research**: `docs/research/02-csv-import-export/`
> **PRD Section**: 4.6

| # | Task | Files | Status |
|---|------|-------|--------|
| E1 | Create `csv-export.js` module | `csv-export.js` | Done |
| E2 | Semicolon delimiter + UTF-8 BOM | `csv-export.js` | Done |
| E3 | Dynamic columns from custom meta | `csv-export.js` | Done |
| E4 | Sector name resolution | `csv-export.js` | Done |
| E5 | Add CSV to export dropdown | `index.html`, `toolbar.js` | Done |
| E6 | Download trigger | `csv-export.js` | Done |

**Acceptance criteria:**
- [x] One-click CSV download from export menu
- [x] Opens correctly in German Excel (umlauts, semicolons, BOM)
- [x] All metadata fields appear as columns
- [x] Sector column shows human-readable sector name

---

## Phase 9: CSV Import ✅ DONE

> **Depends on**: Phase 8 (export format defines import format)
> **PRD Section**: 4.7

| # | Task | Files | Status |
|---|------|-------|--------|
| I1 | CSV parser with auto-delimiter detection | `csv-import.js` | Done |
| I2 | Import preview modal | `index.html`, `csv-import.js` | Done |
| I3 | Fuzzy header auto-mapping | `csv-import.js` | Done (German + English aliases) |
| I4 | Conflict resolution (label match) | `csv-import.js` | Done |
| I5 | Sector matching by label | `csv-import.js` | Done |
| I6 | Undo support (saveSnapshot) | `csv-import.js` | Done |
| I7 | Import dropdown (JSON + CSV) | `index.html`, `toolbar.js` | Done |
| I8 | Modal styles | `popups.css` | Done |

**Acceptance criteria:**
- [x] Import creates new nodes with metadata populated
- [x] Existing nodes matched by label get metadata updated
- [x] Preview shows data before changes
- [x] Undo reverts the entire import as one action
- [x] Handles both comma and semicolon delimiters

---

## Phase 10: Search & Filter (F1) ✅ DONE

> **Completed**: 2026-03-06
> **Plan**: `docs/plans/2026-03-05-search-filter-design.md`

| # | Task | Files | Status |
|---|------|-------|--------|
| S1 | Suche sidebar tab HTML | `index.html` | Done |
| S2 | Fuzzy matching | `search.js` | Done — lightweight char-in-order matching |
| S3 | Results list in sidebar | `search.js` | Done — color dots, type badges, highlighted chars |
| S4 | Navigate to result | `search.js` | Done — pan+zoom to node, select it |
| S5 | Dim non-matching | `renderer.js`, `nodes.css` | Done — .search-dimmed (15% opacity) |
| S6 | Search styles | `sidebar.css` | Done — input, results, highlight ring |

**Acceptance criteria:**
- [x] Ctrl+K opens search, Escape closes
- [x] Typing filters nodes in real-time
- [x] Clicking result navigates to node
- [x] Search queries metadata fields, not just labels

---

## Remaining Earlier Tasks (Lower Priority)

### Phase 5 — Scalability

| # | Task | Status |
|---|------|--------|
| SC1 | Incremental node rendering | Pending |
| SC2 | Incremental connection rendering | Pending |
| SC3 | Viewport culling | Pending |
| SC4 | Command-based undo/redo | Pending |
| SC5 | CSS minification | Done |
| SC6 | Source maps in build | Pending |

### Phase 6 — Remaining Features

| # | Task | Status |
|---|------|--------|
| F1 | Search & filter | Done (→ Phase 10) |
| F2 | Group management UX | Done |
| F4 | Export with visibility | Done |
| F5 | Legend integration | Pending |
| F6 | No-data-loss project loading | Done |

### Future

| Feature | Priority |
|---------|----------|
| SVG export | P2 |
| Auto-layout (force-directed) | P2 |
| Touch support (Pointer Events) | P2 |
| Connection labels | P2 |
| Multi-user (WebSocket/CRDT) | P3 |
| Accessibility (ARIA, keyboard nav) | P3 |

---

## Implementation Order

```
Phase 7  (Metadata)     ✅ DONE
  |
  +---> Phase 7B (Details Tab)  ✅ DONE
  |       |
  |       +---> Phase 7C (Gradient Wash)  ✅ DONE
  |
  +---> Phase 8  (CSV Export)      ✅ DONE
          |
          +---> Phase 9  (CSV Import)  ✅ DONE

Phase 10 (Search)              ✅ DONE

UI: Sidebar left-side + resize + bounce  ✅ DONE

Scalability (SC1-SC4, SC6) ← when needed for 500+ nodes
Features (F5 legend editor) ← fill in as time allows
```

---

## Document Index

| Document | Path | Purpose |
|----------|------|---------|
| Master PRD | `docs/prd/2026-03-04-master-prd-netzwerk-editor.md` | Full product requirements |
| Research Index | `docs/research/INDEX.md` | Research findings by topic |
| Metadata Fields | `docs/research/01-metadata-fields/` | What fields to add, Kumu/CRM analysis |
| CSV Import/Export | `docs/research/02-csv-import-export/` | Format design, Excel compatibility |
| Visual Tier System | `docs/research/03-visual-tier-system/` | Gradient wash design |
| Integration Roadmap | `docs/research/04-integration-roadmap/` | Original phased plan (superseded by this file) |
| Latest Handoff | `docs/handoffs/HANDOFF-20260306-CW10d.md` | Session context |
| Lessons Learned | `docs/lessons-learned/LESSONS-LOG.md` | Architecture & process insights |
