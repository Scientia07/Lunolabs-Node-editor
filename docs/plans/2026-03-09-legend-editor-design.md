# F5 Legend Integration — Design

**Date**: 2026-03-09
**Status**: Approved

---

## Concept

Auto-generated legend from sector node colors. No manual editing needed.
Toggleable via Settings tab for export control.

## Data Flow

1. On every `emit('render')`, scan `state.nodes` for `type === 'sector'`
2. Collect unique `{ label, color }` pairs, sorted alphabetically
3. Render into `#legend` div (bottom-right corner)
4. **No persistence** — legend is derived, not stored in `meta.legend`

## UI

- **Position**: Fixed bottom-right (`right: 16px; bottom: 16px`)
- **Appearance**: Current styling (surface bg, rounded, shadow, color dots + labels)
- **Settings toggle**: "Legende anzeigen" checkbox
- **State**: `state.showLegend` (boolean, default `true`, persisted in project meta + localStorage)

## Export Behavior

- PNG export: legend included if `showLegend === true`
- JSON export: `meta.legend` no longer saved
- Legacy JSON with `meta.legend` → ignored (sectors are source of truth)

## Files to Change

| File | Change |
|------|--------|
| `project.js` | Replace `renderLegend()`/`clearLegend()` with `updateLegend()` deriving from sectors |
| `state.js` | Add `showLegend: true` |
| `settings-panel.js` | Add "Legende anzeigen" checkbox |
| `panels.css` | Move legend to bottom-right |
| `renderer.js` | Call `updateLegend()` on render |
| `persistence.js` | Persist `showLegend` in save/load |
| `export-png.js` | Respect `showLegend` flag |
