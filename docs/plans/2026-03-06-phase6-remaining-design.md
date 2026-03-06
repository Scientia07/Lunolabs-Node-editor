# Design: Phase 6 Remaining — F2, F4, F6

**Date**: 2026-03-06
**Status**: Approved

---

## F2: Group UX — Sector Node Hierarchy with Per-Node Hide

### What
Groups tab shows each sector with its connected child nodes listed underneath. Each child node has an eye toggle to hide/show individually.

### Data Model
- New `state.hiddenNodes` = `Set<nodeId>` — individual node hide state
- Persisted in `persistence.js` alongside `hiddenSectors`
- Restored on load in `persistence.js`

### UI (Groups Tab)
```
Sektoren
|- [color] Schule        (12)  [eye]
|   |- Schulhaus A             [eye]
|   |- Lehrerverband           [eye] (hidden)
|   |- Elternrat               [eye]
|- [color] Freizeit       (8)  [eye]
|   |- Jugendtreff             [eye]
|   |- ...
```

- Sector row: existing behavior (color dot, name, count, eye toggle for whole sector)
- Child rows: indented, node label, eye toggle for individual node
- Hidden nodes shown with `hidden-group` class (dimmed)
- Sector eye hides sector + ALL children (existing). Individual eye hides just that node.

### Visibility Logic
- `applyVisibility()` in sidebar.js: add `state.hiddenNodes` to the `hiddenNodeIds` set
- Connections to/from hidden nodes also hidden (existing logic handles this)

### Files Changed
- `sidebar.js`: renderGroupsTab() — add child node rows + wire eye toggles
- `state.js`: add `hiddenNodes: new Set()` to initial state
- `persistence.js`: serialize/deserialize `hiddenNodes`
- `project.js`: reset `hiddenNodes` in loadProject()
- `sidebar.css`: indent style for child node rows

---

## F4: Export with Visibility Checkbox

### What
When exporting (JSON/PNG/CSV) and some nodes are hidden, show a popup asking whether to include hidden elements.

### Flow
1. User clicks export button
2. Check: are any nodes currently hidden? (`hiddenSectors.size > 0 || hiddenNodes.size > 0 || groups.some(g => g.hidden)`)
3. If yes: show confirm popup "Ausgeblendete Elemente einschliessen?" [Ja] [Nein]
4. If no hidden nodes: export immediately
5. "Ja" = export everything. "Nein" = filter out hidden nodes + their connections.

### Implementation
- New `getHiddenNodeIds()` utility (extract from `applyVisibility()` logic)
- `filterVisibleData(nodes, connections)` — returns filtered copies
- Wrap existing export triggers in `confirmVisibilityThenExport(exportFn)`
- Popup: reuse existing modal pattern from CSV import (popups.css)

### Files Changed
- `toolbar.js`: wrap export-json-btn, export-csv-btn, export-png-btn handlers
- `utils.js` or new helper: `getHiddenNodeIds()`, `filterVisibleData()`
- `index.html`: visibility confirm modal HTML
- `popups.css`: modal styles (minimal — reuse csv-import pattern)

---

## F6: No-Data-Loss Warning

### What
Warn before destructive navigation (load project, new blank, import) if there are unsaved changes.

### Approach: Dirty Flag
- `state.isDirty = false` — set to `true` on any state mutation
- Cleared to `false` after `autoSave()` / `saveProject()`
- Check in: `loadProject()`, `newBlankProject()`, `importProjectFile()`

### Where to Set Dirty
- `saveSnapshot()` in state.js already captures mutations — set `isDirty = true` there
- Clear in `autoSave()` and `saveProject()`

### Confirm Dialog
- `confirmIfDirty(callback)` utility:
  - If not dirty: call callback immediately
  - If dirty: `confirm("Ungespeicherte Aenderungen gehen verloren. Fortfahren?")` — native browser confirm
- Use native `confirm()` — simple, no extra UI needed, blocking

### Files Changed
- `state.js`: add `isDirty` flag
- `persistence.js`: clear isDirty in autoSave
- `project-manager.js`: wrap loadProject, newBlankProject, importProjectFile with confirmIfDirty
- `utils.js`: `confirmIfDirty()` helper

---

## Implementation Order

```
F6 (dirty flag)  — smallest, foundational
  |
F2 (group hierarchy + per-node hide)  — biggest, standalone
  |
F4 (export visibility)  — depends on hidden node logic from F2
```

## Out of Scope
- F5 (Legend editor) — skipped
- Group rename, reorder, color — future
- Blur/opacity per-node — future
