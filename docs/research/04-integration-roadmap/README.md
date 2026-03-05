# Integration Roadmap: Metadata, Visual Tiers & CSV

**Date**: 2026-03-05
**Researcher**: Claude Opus 4.6
**Status**: Draft — awaiting user approval

## Overview

Phased implementation plan that combines all research findings into the Netzwerk-Editor. Each phase is independently shippable.

## Phase A: Node Metadata System (Foundation)

**Priority**: Highest — everything else depends on this
**Estimated scope**: ~4 files changed

### What
- Add `meta` object to node data model
- Predefined suggested fields: `tier`, `contact`, `email`, `phone`, `tags`, `notes`
- Free-form key-value pairs beyond suggested fields
- Persist via existing autoSave/localStorage

### Files affected
- `state.js` — ensure `meta` survives undo/redo snapshots
- `renderer.js` — pass `meta.tier` to DOM as data attribute
- `utils.js` — add `serializeProject()` support for meta
- `persistence.js` — no changes needed (meta is just another node property)

### Data model
```js
// On any node
node.meta = {
  tier: "nah",           // "nah" | "satellit"
  relevancy: 8,          // 1-10, auto-maps to opacity (node.opacity overrides)
  contact: "Max Muster",
  email: "max@example.ch",
  phone: "+41 79 123 45 67",
  tags: "Praevention, Beratung",
  notes: "Langjaerig",
  // + any user-defined keys
}

// Opacity resolution order:
// 1. node.opacity (manual override from popup slider) — wins if set
// 2. node.meta.relevancy / 10 — auto-calculated
// 3. default: 1.0 (fully visible)
```

### Acceptance criteria
- Meta data is saved and survives page reload
- Meta data is included in JSON export
- Undo/redo preserves meta changes
- Existing projects without meta load without errors

---

## Phase B: Sidebar Details Tab

**Priority**: High — the UI for editing metadata
**Estimated scope**: ~3 files changed

### What
- New 4th sidebar tab: "Details"
- Shows metadata for the currently selected node (single selection)
- Tier toggle: two buttons `[Nah]` `[Satellit]`
- Contact fields: input rows for each Tier 1 field
- Custom fields: key-value list with add/delete
- Multi-select: show count, allow batch-setting tier

### Files affected
- `index.html` — add 4th tab button + tab pane
- `sidebar.js` — add `renderDetailsTab()` function
- `sidebar.css` — styles for details tab inputs

### UI mockup
```
[Verbindungen] [Gruppen] [Details] [Einstellungen]

   Schulpsych. Dienst
   ──────────────────────────
   Beziehung    [Nah] [Satellit]

   Kontaktperson  [Max Muster        ]
   E-Mail         [max@example.ch     ]
   Telefon        [+41 79 123 45 67   ]
   Tags           [Praevention, Berat ]
   Notizen        [Langjaerig...      ]
   ──────────────────────────
   Website        [https://example.ch ]
   Seit           [2018-01-01         ]
   ──────────────────────────
   + Feld hinzufuegen

   Eigene Felder:
   [budget    ] : [50000       ] [x]
```

### Acceptance criteria
- Selecting a node shows its metadata in the Details tab
- Editing a field updates `node.meta` immediately (with undo support)
- Adding/deleting custom fields works
- Tab only shows when a node is selected (or shows "Kein Element ausgewaehlt")

---

## Phase C: Visual Tier System (Gradient Wash)

**Priority**: High — the visual payoff
**Estimated scope**: ~2 files changed

### What
- Company nodes with `meta.tier === "satellit"` get gradient wash styling
- Wash color derived from parent sector's color at 12-18% opacity
- Slightly reduced text opacity (0.75) and font size (-1px)
- Works in both light and dark themes

### Files affected
- `renderer.js` — add satellite class + inline sector color as CSS variable
- `nodes.css` — new `.node-company--satellite` styles

### CSS
```css
.node-company--satellite {
  background: linear-gradient(135deg,
    rgba(var(--sector-rgb), 0.15),
    rgba(var(--sector-rgb), 0.05));
  border-radius: 20px;
  padding: 3px 10px;
  opacity: 0.75;
  font-size: 0.92em;
}
```

### Acceptance criteria
- Satellite nodes are visually distinct from close nodes
- Toggling tier in sidebar immediately updates the visual
- Dark theme: wash is visible but not overpowering
- Light theme: wash is subtle but clearly distinguishable

---

## Phase D: CSV Export

**Priority**: Medium — first half of CSV feature
**Estimated scope**: ~1 new file

### What
- Export all nodes as semicolon-delimited CSV
- UTF-8 with BOM for German Excel compatibility
- Columns: Label, Type, Sektor, Beziehung, Kontaktperson, E-Mail, Telefon, Tags, Notizen, + any custom meta keys
- Include X, Y coordinates for layout preservation
- Download as `netzwerk-export-YYYY-MM-DD.csv`

### Files affected
- New: `csv-export.js`
- `project-manager.js` — add export CSV button wiring
- `index.html` — add CSV option to export dropdown

### Format
```csv
Label;Type;Sektor;Beziehung;Kontaktperson;E-Mail;Telefon;Tags;Notizen;X;Y
"Schulpsych. Dienst";company;"Beratung & Therapie";nah;"Max Muster";"max@example.ch";"+41 79 123 45 67";"Praevention, Beratung";"Langjaerig";640;552
```

### Acceptance criteria
- One-click CSV download from export menu
- Opens correctly in German Excel (umlauts, semicolons)
- All metadata fields are included as columns
- Dynamic columns: custom meta keys become additional columns

---

## Phase E: CSV Import

**Priority**: Medium — second half of CSV feature
**Estimated scope**: ~2 new files

### What
- Import CSV file via file picker
- Auto-detect delimiter (comma or semicolon)
- Preview first 5 rows before importing
- Auto-map column headers to known fields
- Conflict handling: existing label = update metadata, new label = create node
- Sector matching by label name

### Files affected
- New: `csv-import.js`
- New or extend: `csv-import.css` (preview modal styles)
- `index.html` — import button/modal markup
- `project-manager.js` — wire import button

### Import flow
```
[Select CSV] -> [Preview table] -> [Column mapping] -> [Import]
                  5 rows shown      auto-mapped         with conflict handling
```

### Acceptance criteria
- Import creates new nodes with metadata populated
- Existing nodes (matched by label) get metadata updated, not duplicated
- Preview shows data before any changes are made
- Undo reverts the entire import as one action

---

## Phase Order & Dependencies

```
Phase A (metadata model)
  |
  +---> Phase B (sidebar UI)
  |       |
  |       +---> Phase C (gradient wash)  -- needs tier toggle from B
  |
  +---> Phase D (CSV export)
          |
          +---> Phase E (CSV import)     -- needs export format defined first
```

**Recommended order**: A -> B -> C -> D -> E

Phases D and E can run in parallel with B and C if needed, since they only depend on A (the metadata model).
