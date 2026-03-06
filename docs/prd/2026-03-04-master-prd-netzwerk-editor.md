# Master PRD: Netzwerk-Editor

**Date**: 2026-03-04 (created) | 2026-03-06 (last updated)
**Status**: Living Document
**Owner**: Jugendbuero March / LunoLabs
**Version**: 3.0

---

## 1. Problem Statement

The Jugendbuero March needs an interactive network visualization tool to map ~100+ partner organizations across 10 categories (Oeffentliche Hand, Jugendarbeit, Bildung, etc.). The tool must show **relationship importance** visually (close vs satellite partners), allow **metadata** per partner (contact info, tags, notes), and support **CSV import/export** for data exchange with Excel and other tools.

### What Exists Today (v2.1)

A fully modular vanilla JS editor with:
- 6 node types (center, sector, company, sticky, rect, circle, textbox)
- Node properties popup (color/gradient, shape, font, opacity)
- Connection properties popup (color, style, dash, thickness, outline, hidden)
- Drag-to-create from anchors
- Left-side sidebar (resizable, 200-600px) with connections, groups, details, search, and settings tabs
- Dark/light theme, minimap, legend
- JSON import/export, PNG export
- Single-file build (`dist/index.html`) works from `file://`

### What's Missing

- **No metadata on nodes** — nodes only hold label, color, position
- **No relationship tiers** — all 107 company labels look identical
- **No CSV import/export** — can't exchange data with Excel
- **No search** — impossible to find nodes in large networks
- **No relevancy scoring** — no way to visually de-emphasize less important partners

---

## 2. Goals

| Priority | Goal | Success Metric |
|----------|------|----------------|
| P0 | Node metadata system (flexible key-value) | Store at least 6 fields per node, persist across reload |
| P0 | Visual tier system (close/satellite gradient wash) | Satellite nodes visually distinct from close partners |
| P0 | Relevancy → opacity mapping | Relevancy 1-10 auto-maps to opacity, manual override possible |
| P0 | Sidebar Details tab for metadata editing | Select node → see/edit all metadata in sidebar |
| P1 | CSV export (semicolon-delimited, German Excel) | One-click download, opens correctly in Excel |
| P1 | CSV import with preview | Import CSV, preview before applying, conflict handling |
| P1 | Search & filter nodes (Ctrl+K) | Find any node in <2 seconds |
| P2 | SVG export | Scalable vector output for print |
| P2 | Auto-layout (force-directed) | One-click layout for initial placement |
| P2 | Touch support (tablet) | Usable on iPad with finger/pencil |
| P3 | Multi-user (CRDT/WebSocket) | 2+ concurrent editors |

---

## 3. User Personas

### Jugendarbeiter:in (Primary)
- Uses the tool on a laptop/tablet during team meetings
- Needs to quickly find a partner org and see its connections
- Updates the network 1-2x per month
- Wants to see at a glance which partners are close vs peripheral

### Vorstand / Management (Secondary)
- Exports PNGs/SVGs for annual reports and presentations
- Reads the network but rarely edits
- Needs print-friendly output
- Wants CSV export to combine network data with other databases

---

## 4. Feature Specifications

### 4.1 Unified Codebase (P0) -- DONE
Single application with theme toggle, data loaded from JSON or embedded config.

### 4.2 Search & Filter (P1) -- DONE
- Search bar in toolbar (Ctrl+K to focus)
- Fuzzy matching on node labels + metadata fields
- Highlight matching nodes, dim non-matching
- Click result to pan+zoom to node

### 4.3 Node Metadata System (P0) -- DONE
Flexible `meta` object on every node. Predefined suggested fields with free-form extension.

**Suggested fields:**

| Key | Label (DE) | Type | Purpose |
|-----|-----------|------|---------|
| `tier` | Beziehung | enum: `nah`, `satellit` | Drives gradient wash visual |
| `relevancy` | Relevanz | number 1-10 | Auto-maps to opacity (overridable) |
| `contact` | Kontaktperson | string | Primary contact name |
| `email` | E-Mail | string | Contact email |
| `phone` | Telefon | string | Contact phone |
| `tags` | Tags | string (comma-sep) | Flexible categorization |
| `notes` | Notizen | text (multiline) | Free-text notes |
| `website` | Website | url | Partner website |
| `since` | Seit | date | Partnership start date |

**Data model:**
```js
node.meta = {
  tier: "nah",
  relevancy: 8,
  contact: "Max Muster",
  email: "max@example.ch",
  // ... any user-defined keys
}
```

**Relevancy → Opacity logic:**
```js
effectiveOpacity = node.opacity != null
  ? node.opacity                          // manual override wins
  : (node.meta?.relevancy ?? 10) / 10    // auto from relevancy
```

### 4.4 Sidebar Details Tab (P0) -- DONE
New 4th tab in sidebar: "Details". Shows/edits metadata for selected node.
- Tier toggle: `[Nah] [Satellit]`
- Relevancy slider (1-10)
- Contact fields (input rows)
- Custom fields (add/edit/delete key-value pairs)
- Multi-select: batch-set tier/relevancy

### 4.5 Visual Tier System — Gradient Wash (P0) -- DONE
Company nodes with `meta.tier === "satellit"` receive:
- Soft gradient wash background using parent sector color at 12-18% opacity
- Slightly reduced text opacity (0.75) and font size (-1px)
- Works in both light and dark themes

### 4.6 CSV Export (P1) -- NEW
- Semicolon-delimited CSV (German Excel default)
- UTF-8 with BOM for Excel compatibility
- Columns: Label, Type, Sektor, + all meta fields + X, Y
- Dynamic columns for custom meta keys
- One-click download from export dropdown

### 4.7 CSV Import (P1) -- NEW
- File picker → auto-detect delimiter
- Preview first 5 rows before import
- Auto-map column headers to known fields
- Conflict handling: existing label = update, new = create
- Entire import undoable as one action

### 4.8 Connection Properties Popup (P1) -- DONE
Per-connection color, style, dash, thickness, outline, hidden.

### 4.9 Drag-to-Create from Anchors (P1) -- DONE
Drag from anchor → popup → Sektor/Eintrag.

### 4.10 SVG Export (P2) -- PENDING
Vector export for print/presentations.

### 4.11 Auto-Layout (P2) -- PENDING
Force-directed layout with sector gravity centers.

### 4.12 Touch Support (P2) -- PENDING
Pointer Events API for unified mouse+touch.

### 4.13 Node Grouping (P2) -- PARTIAL
Sectors hide/show in groups tab. Custom groups exist. Collapse/expand pending.

---

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Initial load | <1s on 3G |
| Render 500 nodes | 60fps pan/zoom |
| Bundle size | <100KB gzipped |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2) |
| Offline | Full functionality without network |
| Data format | JSON (primary), CSV (import/export), backwards-compatible |

---

## 6. Completion Status

### Done
- [x] Phase 1: Security (S1-S8)
- [x] Phase 2: Performance (P1-P7)
- [x] Phase 3: Architecture (A1-A7)
- [x] Phase 4: Code Quality (Q1-Q7)
- [x] SC5: CSS minification
- [x] F3: Connection endpoint editing
- [x] F7: Drag-to-create from anchors
- [x] F8: Connection properties popup
- [x] Node properties popup (color/form/font/opacity)
- [x] Unit tests (vitest: state, utils, actions, persistence)

### Recently Completed
- [x] Phase 7: Node Metadata System (M1-M6) — `node.meta`, `SUGGESTED_META_FIELDS`, `getTier()`, relevancy→opacity
- [x] Phase 7B: Sidebar Details Tab (D1-D8) — 4th tab, relevancy slider, contact fields, custom fields, batch editing
- [x] Phase 7C: Visual Tier System (V1-V4) — satellite gradient wash, `hexToRgb()`, dark theme variant
- [x] Phase 8: CSV Export — semicolon-delimited, BOM, dynamic meta columns
- [x] Phase 9: CSV Import — auto-delimiter, fuzzy header mapping, preview modal, conflict resolution
- [x] Phase 10: Search & Filter — fuzzy match, sidebar Suche tab, Ctrl+K, canvas dimming
- [x] F2: Group management UX — per-node hide, sector→child hierarchy
- [x] F4: Export with visibility — modal confirmation for hidden nodes
- [x] F6: No-data-loss project loading — `isDirty` flag + confirm dialog
- [x] Sidebar moved to left side, drag-to-resize (200-600px), bounce animation on first load

### Pending
- [ ] F5: Legend integration
- [ ] SC1-SC4, SC6: Scalability improvements
- [ ] SVG export, auto-layout, touch support

---

## 7. Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Single HTML file (bundled) | Client requirement — no server | 2026-03-04 |
| Vanilla JS (no framework) | Keep bundle small, existing codebase | 2026-03-04 |
| localStorage + JSON export | No backend needed, offline-first | 2026-03-04 |
| Flexible `meta` object (not fixed schema) | Matches Kumu pattern, no schema lock-in | 2026-03-05 |
| Tier derived from relevancy (no separate toggle) | `relevancy > 5 = nah`, `<= 5 = satellit` — one slider instead of two controls | 2026-03-05 |
| Semicolon CSV delimiter | German Excel default, avoids comma conflicts | 2026-03-05 |
| Relevancy (1-10) auto-maps to opacity | Visual importance without extra controls, manual override preserved | 2026-03-05 |
| UTF-8 BOM for CSV | Required for German Excel to read umlauts correctly | 2026-03-05 |
| Search as sidebar tab (not Spotlight overlay) | Results stay visible during canvas navigation | 2026-03-06 |
| Sidebar on left side (not right) | User preference; matches typical IDE layout | 2026-03-06 |
| Sidebar drag-to-resize via CSS custom property | `--sidebar-w` updates all dependents automatically | 2026-03-06 |

---

## 8. Research

See `docs/research/INDEX.md` for detailed research on:
- Metadata fields (Kumu, CRM tools, nonprofit patterns)
- CSV import/export (format design, best practices)
- Visual tier system (gradient wash, prior art)
- Integration roadmap (phased implementation)
