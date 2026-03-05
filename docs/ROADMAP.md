# Roadmap — Netzwerk-Editor

**Last Updated**: 2026-03-05
**Master PRD**: `docs/prd/2026-03-04-master-prd-netzwerk-editor.md`
**Research**: `docs/research/INDEX.md`

---

## Legend

- `[x]` Done
- `[ ]` Pending
- `[~]` Partial / In Progress
- Phases are ordered by priority — implement top to bottom

---

## Phase 7: Node Metadata System (Foundation)

> **Depends on**: nothing (can start immediately)
> **Research**: `docs/research/01-metadata-fields/`
> **PRD Section**: 4.3

| # | Task | Files | Description |
|---|------|-------|-------------|
| M1 | Add `meta` object to node data model | `state.js` | Ensure meta survives undo/redo snapshots (createSnapshot/applySnapshot) |
| M2 | Serialize meta in JSON export | `utils.js` | Update `serializeProject()` to include `node.meta` |
| M3 | Load meta from JSON import | `persistence.js`, `project.js` | Backward-compatible: missing meta = empty object |
| M4 | Render `data-tier` attribute on company nodes | `renderer.js` | `el.dataset.tier = n.meta?.tier \|\| 'nah'` |
| M5 | Relevancy → opacity auto-mapping | `renderer.js` | `effectiveOpacity = node.opacity ?? (node.meta?.relevancy ?? 10) / 10` |
| M6 | Predefined field suggestions | `constants.js` | `SUGGESTED_META_FIELDS` array with key, label, type, placeholder |

**Acceptance criteria:**
- [ ] `node.meta` is saved to localStorage and JSON export
- [ ] Existing projects without meta load without errors
- [ ] Undo/redo preserves meta changes
- [ ] Relevancy auto-maps to opacity; manual opacity overrides it

---

## Phase 7B: Sidebar Details Tab (UI)

> **Depends on**: Phase 7 (M1-M6)
> **PRD Section**: 4.4

| # | Task | Files | Description |
|---|------|-------|-------------|
| D1 | Add "Details" tab to sidebar HTML | `index.html` | 4th tab button + tab pane |
| D2 | Render Details tab content | `sidebar.js` | `renderDetailsTab()`: tier toggle, relevancy slider, contact fields, custom fields |
| D3 | Tier toggle (Nah / Satellit) | `sidebar.js` | Two-button toggle, updates `node.meta.tier`, triggers render |
| D4 | Relevancy slider (1-10) | `sidebar.js` | Range input, updates `node.meta.relevancy`, live opacity preview |
| D5 | Contact fields (predefined) | `sidebar.js` | Input rows for contact, email, phone, tags, notes, website, since |
| D6 | Custom metadata fields | `sidebar.js` | Key-value list with add/delete buttons |
| D7 | Multi-select batch editing | `sidebar.js` | When multiple nodes selected: batch-set tier and relevancy |
| D8 | Sidebar styles for Details tab | `sidebar.css` | Input rows, toggle buttons, field list styling |

**Acceptance criteria:**
- [ ] Selecting a node shows its metadata in Details tab
- [ ] Editing a field updates `node.meta` with undo support
- [ ] Adding/removing custom fields works
- [ ] Empty state shows "Kein Element ausgewaehlt"
- [ ] Multi-select shows batch controls

---

## Phase 7C: Visual Tier System (Gradient Wash)

> **Depends on**: Phase 7 (M4 for data-tier attribute)
> **Research**: `docs/research/03-visual-tier-system/`
> **PRD Section**: 4.5

| # | Task | Files | Description |
|---|------|-------|-------------|
| V1 | Satellite CSS class | `nodes.css` | `.node-company--satellite` with gradient wash, reduced opacity, smaller font |
| V2 | Apply satellite class in renderer | `renderer.js` | Add class when `meta.tier === 'satellit'`, set `--sector-rgb` CSS variable from parent sector color |
| V3 | Parse sector color to RGB | `utils.js` | `hexToRgb(hex)` helper for CSS variable injection |
| V4 | Dark theme variant | `nodes.css` | Adjust wash opacity for dark background (slightly higher: 20-25%) |

**Acceptance criteria:**
- [ ] Satellite nodes have visible gradient wash in sector color
- [ ] Close nodes look unchanged (current style)
- [ ] Toggling tier in sidebar immediately updates the visual
- [ ] Works in both light and dark themes

---

## Phase 8: CSV Export

> **Depends on**: Phase 7 (meta must exist to export)
> **Research**: `docs/research/02-csv-import-export/`
> **PRD Section**: 4.6

| # | Task | Files | Description |
|---|------|-------|-------------|
| E1 | Create `csv-export.js` module | NEW `csv-export.js` | Build CSV string from state.nodes with all meta fields as columns |
| E2 | Semicolon delimiter + UTF-8 BOM | `csv-export.js` | `\uFEFF` prefix, `;` separator, proper quoting |
| E3 | Dynamic columns from custom meta | `csv-export.js` | Scan all nodes for union of meta keys, create columns |
| E4 | Sector name resolution | `csv-export.js` | Map `parentId` → parent sector label for human-readable "Sektor" column |
| E5 | Add CSV to export dropdown | `index.html`, `project-manager.js` | "CSV exportieren" option in export menu |
| E6 | Download trigger | `csv-export.js` | Blob + download link, filename: `netzwerk-export-YYYY-MM-DD.csv` |

**Acceptance criteria:**
- [ ] One-click CSV download from export menu
- [ ] Opens correctly in German Excel (umlauts, semicolons, BOM)
- [ ] All metadata fields appear as columns
- [ ] Sector column shows human-readable sector name

---

## Phase 9: CSV Import

> **Depends on**: Phase 8 (export format defines import format)
> **PRD Section**: 4.7

| # | Task | Files | Description |
|---|------|-------|-------------|
| I1 | Create `csv-import.js` module | NEW `csv-import.js` | Parse CSV with auto-delimiter detection (`,` or `;`) |
| I2 | Import preview modal | `index.html`, `csv-import.js` | Show first 5 rows in table before applying |
| I3 | Column auto-mapping | `csv-import.js` | Map headers to known fields (Label→label, Beziehung→meta.tier, etc.) |
| I4 | Conflict resolution | `csv-import.js` | Existing label = update metadata; new label = create company node |
| I5 | Sector matching | `csv-import.js` | Match "Sektor" column to existing sector labels, or create new |
| I6 | Undo support | `csv-import.js` | `saveSnapshot()` before import → entire import undoable |
| I7 | Add import button | `index.html`, `project-manager.js` | "CSV importieren" option or button |
| I8 | Import modal styles | `panels.css` or `sidebar.css` | Preview table, mapping dropdowns, confirm/cancel buttons |

**Acceptance criteria:**
- [ ] Import creates new nodes with metadata populated
- [ ] Existing nodes matched by label get metadata updated
- [ ] Preview shows data before changes
- [ ] Undo reverts the entire import as one action
- [ ] Handles both comma and semicolon delimiters

---

## Phase 10: Search & Filter (F1)

> **Depends on**: Phase 7 (search should query metadata too)
> **PRD Section**: 4.2

| # | Task | Files | Description |
|---|------|-------|-------------|
| S1 | Search bar HTML | `index.html` | Input in toolbar or overlay, Ctrl+K shortcut |
| S2 | Fuzzy matching | NEW `search.js` | Match on label + meta.contact + meta.tags + meta.notes |
| S3 | Results dropdown | `search.js` | Show top 10 matches with node type icon + sector color |
| S4 | Navigate to result | `search.js` | Pan+zoom to node, select it, open Details tab |
| S5 | Dim non-matching | `search.js` | Reduce opacity of non-matching nodes while search active |
| S6 | Search styles | `toolbar.css` | Search input, results dropdown styling |

**Acceptance criteria:**
- [ ] Ctrl+K opens search, Escape closes
- [ ] Typing filters nodes in real-time
- [ ] Clicking result navigates to node
- [ ] Search queries metadata fields, not just labels

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
| F1 | Search & filter | Pending (→ Phase 10) |
| F2 | Group management UX | Pending |
| F4 | Export with visibility | Pending |
| F5 | Legend integration | Pending |
| F6 | No-data-loss project loading | Pending |

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
Phase 7  (Metadata)     ← START HERE
  |
  +---> Phase 7B (Details Tab)
  |       |
  |       +---> Phase 7C (Gradient Wash)
  |
  +---> Phase 8  (CSV Export)
          |
          +---> Phase 9  (CSV Import)

Phase 10 (Search) ← can start after Phase 7, parallel with 8/9

Scalability (SC1-SC4, SC6) ← when needed for 500+ nodes
Features (F2, F4-F6) ← fill in as time allows
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
| Latest Handoff | `docs/handoffs/HANDOFF-20260305-CW10.md` | Session context |
| Lessons Learned | `docs/lessons-learned/LESSONS-LOG.md` | Architecture & process insights |
