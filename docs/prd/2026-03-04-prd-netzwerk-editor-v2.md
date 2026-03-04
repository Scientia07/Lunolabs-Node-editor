# PRD: Netzwerk-Editor v2

**Date**: 2026-03-04
**Status**: Draft
**Owner**: Jugendbüro March / LunoLabs

---

## 1. Problem Statement

The Jugendbüro March needs an interactive network visualization tool to map ~100+ partner organizations across 10 categories (Öffentliche Hand, Jugendarbeit, Bildung, etc.). The current v1 prototype works as a proof-of-concept but has critical limitations:

- **Two separate files** with ~80% duplicated code (generic editor + pre-populated network)
- **No mobile support** — mouse-only interactions
- **No search** — impossible to locate nodes in large networks
- **No metadata** — nodes only hold a label and color, no contact info, URLs, or notes
- **XSS vulnerability** in context menu rendering
- **Performance degrades** at 100+ nodes due to O(n) lookups

## 2. Goals

| Priority | Goal | Success Metric |
|----------|------|----------------|
| P0 | Merge into a single codebase with data-driven initial state | 1 HTML file or modular build |
| P0 | Fix all security bugs (XSS) | Zero innerHTML with unsanitized input |
| P0 | Search & filter nodes | Find any node in <2 seconds |
| P1 | Node metadata panel (description, URL, contact, tags) | Can store at least 5 fields per node |
| P1 | Touch support (tablet) | Usable on iPad with finger/pencil |
| P1 | Connection labels | Annotate relationship type |
| P2 | SVG export | Scalable vector output for print |
| P2 | Auto-layout toggle (force-directed) | One-click layout for initial placement |
| P2 | Node grouping / clusters | Visual grouping with collapsible sectors |
| P3 | Multi-user (CRDT/WebSocket) | 2+ concurrent editors |
| P3 | Accessibility (ARIA, keyboard nav) | WCAG 2.1 AA compliance |

## 3. User Personas

### Jugendarbeiter:in (Primary)
- Uses the tool on a laptop/tablet during team meetings
- Needs to quickly find a partner org and see its connections
- Updates the network 1-2x per month

### Vorstand / Management (Secondary)
- Exports PNGs/SVGs for annual reports and presentations
- Reads the network but rarely edits
- Needs print-friendly output

## 4. Feature Specifications

### 4.1 Unified Codebase (P0)

**Current**: Two files — `index.html` (generic dark editor) and `netzwerk-jb-march.html` (pre-populated light network) sharing ~80% logic.

**Target**: Single application with:
- Theme toggle (dark/light) via CSS custom properties (already partially done)
- Initial data loaded from external JSON file or embedded config
- URL parameter for loading specific datasets: `?data=netzwerk-jb-march`

### 4.2 Search & Filter (P0)

- Search bar in toolbar (Ctrl+K to focus)
- Fuzzy matching on node labels
- Highlight matching nodes, dim non-matching
- Click result to pan+zoom to node
- Filter by category/color (chip toggles in legend)

### 4.3 Node Detail Panel (P1)

Side panel (280px, right-side slide-in) when a node is selected:
- **Label** (editable)
- **Category** (dropdown matching sector colors)
- **Description** (textarea, markdown support optional)
- **URL** (clickable link)
- **Contact** (free text)
- **Tags** (comma-separated, filterable)
- **Connections list** (with quick-add/remove)

### 4.4 Touch Support (P1)

- Single finger = pan
- Pinch = zoom
- Tap node = select
- Long press = context menu
- Two-finger tap = deselect
- Drag node with finger after selection

### 4.5 Connection Labels (P1)

- Optional label on connections (displayed at midpoint)
- Editable via double-click on connection
- Shown/hidden with toggle button

### 4.6 SVG Export (P2)

- Full vector export of current viewport or all nodes
- Embedded fonts or system-safe fallbacks
- Legend included in export

### 4.7 Auto-Layout (P2)

- Force-directed layout algorithm (d3-force or custom)
- "Auto-arrange" button in toolbar
- Preserves sector grouping (sector acts as gravity center for its children)
- Animates transition from current to computed positions

### 4.8 Node Grouping (P2)

- Sectors can be "collapsed" to hide child nodes
- Visual hull/boundary around grouped nodes
- Expand/collapse toggle on sector node

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Initial load | <1s on 3G |
| Render 500 nodes | 60fps pan/zoom |
| Bundle size | <100KB gzipped |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2) |
| Offline | Full functionality without network (PWA optional) |
| Data format | JSON, backwards-compatible with v1 exports |

## 6. Technical Debt to Address

| # | Issue | Fix |
|---|-------|-----|
| 1 | XSS in `addCtxItem` innerHTML | Use `textContent` for labels |
| 2 | O(n) node lookups | Use `Map<id, node>` for O(1) access |
| 3 | 80 undo snapshots as full JSON strings | Implement command pattern or structural sharing |
| 4 | No input validation on JSON import | Add schema validation (zod or manual) |
| 5 | `localStorage` quota risk | Check quota, warn user, offer IndexedDB fallback |
| 6 | Memory leaks in `renderNodes` | Proper cleanup or event delegation |
| 7 | Hardcoded `160px` widths in minimap | Calculate from actual node dimensions |
| 8 | `parseInt` without radix | Add radix 10 everywhere |
| 9 | `netzwerk-jb-march.html:1405` wrong ID reference | Use `node.id` not `state.nextId - 1` |
| 10 | Connection context menu broken in netzwerk file | Fix target detection logic |

---

## 7. Integration Plan

### Phase 1: Consolidation & Bug Fixes (1-2 days)

**Goal**: Single codebase, zero bugs, same functionality as today.

1. **Extract shared code** into a modular structure:
   ```
   /src
     /styles/    → theme-light.css, theme-dark.css, shared.css
     /js/
       state.js       → State management, undo/redo
       renderer.js    → DOM rendering, connections
       interactions.js → Mouse/keyboard handlers
       export.js      → JSON/PNG export
       minimap.js     → Minimap rendering
       utils.js       → Utility functions
     /data/
       netzwerk-jb-march.json  → Initial data extracted
   index.html         → Shell that loads modules
   ```

2. **Fix all bugs** from review above (XSS, memory leaks, wrong ID refs, connection context menu)

3. **Add `Map` index** for O(1) node lookups

4. **Add JSON schema validation** on import

5. **Build step** (optional): Use esbuild/vite to bundle back into single HTML for deployment

**Deliverable**: One app that can load `netzwerk-jb-march.json` or start empty.

### Phase 2: Search, Metadata & UX (2-3 days)

1. **Search bar** with Ctrl+K shortcut and fuzzy matching
2. **Node detail panel** (side panel with metadata fields)
3. **Legend filter** (click category to show/hide)
4. **Connection labels** (optional text at midpoint)
5. **Theme toggle** (light/dark)
6. **Zoom-to-selection** shortcut

**Deliverable**: Production-ready editor with search and metadata.

### Phase 3: Touch & Export (1-2 days)

1. **Touch event handlers** (pointer events API for unified mouse+touch)
2. **SVG export** alongside PNG
3. **Print stylesheet** (`@media print`)
4. **PWA manifest** for offline use (optional)

**Deliverable**: Tablet-friendly, multi-format export.

### Phase 4: Advanced Features (3-5 days)

1. **Auto-layout** with force-directed algorithm
2. **Node grouping** with collapse/expand
3. **Performance optimization** (virtual rendering for 500+ nodes)
4. **Accessibility** audit and ARIA labels

**Deliverable**: Feature-complete v2.

### Phase 5 (Future): Collaboration

1. **Backend API** for persistence (replace localStorage)
2. **WebSocket sync** for multi-user editing
3. **Version history** with diff view
4. **Role-based access** (viewer/editor/admin)

---

## 8. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Single HTML file (bundled) for deployment | Client requirement — no server infrastructure | SPA with backend |
| Vanilla JS (no framework) | Keep bundle small, existing codebase is vanilla | React, Svelte |
| `localStorage` + JSON export for persistence | No backend needed, offline-first | Supabase, Firebase |
| Pointer Events API for touch | Unified mouse+touch, modern browser support | Separate touch handlers |
