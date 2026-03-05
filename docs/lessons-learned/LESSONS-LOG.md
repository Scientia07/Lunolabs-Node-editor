# Lessons Learned Log — Netzwerk-Editor

---

## Session: Sidebar Panel & Project Management — 2026-03-04

### [ARCHITECTURE] Visibility toggling should modify DOM display, not remove from state
Hiding nodes by setting `display: none` on DOM elements (rather than filtering them out of `state.nodes`) keeps undo/redo, persistence, and export working without special-casing hidden nodes. The visibility layer sits entirely in the rendering pipeline, not the data model.

### [TOOLING] Build must write to every file users might open
When a project has both `dist/index.html` (build output) and a root `index.html` (convenience copy), both must be updated by the build script. Users will open whichever they find first, and a stale root file causes confusion ("I can't see the sidebar"). Always `writeFileSync` to all output locations.

### [CODE-PATTERN] Embed data as window globals for single-file distribution
Using `window.__EMBEDDED_PROJECTS__` to inject JSON data at build time makes the single HTML file fully self-contained. Code checks embedded data first, then falls back to `fetch()` for dev mode. This avoids CORS issues with `file://` protocol and makes sharing trivial — just send one HTML file.

### [PROCESS] Keyboard shortcut guards must cover all input types
The original keyboard handler only checked `e.target.isContentEditable`, which missed `<input>`, `<select>`, and `<textarea>` elements added by the sidebar. Always guard with `e.target.tagName === 'INPUT' || 'SELECT' || 'TEXTAREA'` in addition to `isContentEditable`.

### [INSIGHT] Playwright MCP is invaluable for verifying vanilla JS UIs
Without a test framework, using Playwright via MCP to navigate, click, and screenshot the app provided concrete visual verification. The accessibility tree snapshot also catches structural issues (like sidebar tabs hidden behind toolbars) that screenshots alone might miss.

---

## Session: Security Hardening, Performance & Quality Fixes — 2026-03-05

### [ARCHITECTURE] Centralize security helpers from day one
Having `esc()` duplicated in sidebar.js and ad-hoc escaping in renderer.js meant inconsistent coverage — one missed `"` escaping, another missed `'`. A single shared `esc()` in utils.js prevents drift. Same applies to `safeColor()` for style-attribute injection.

### [PERFORMANCE] DOM element caching eliminates the biggest bottleneck in vanilla JS editors
Replacing `querySelector(\`[data-id="${id}"]\`)` with a `Map<id, HTMLElement>` cache reduced per-frame DOM scans from 88-650 to zero. This single change (P1) had more impact than all other performance fixes combined.

### [CODE-PATTERN] Extract shared geometry helpers early
The bounding box calculation was duplicated in export-png, transform (zoomFit), and minimap — each with slightly different fallback dimensions. A shared `getNodesBoundingBox()` with a callback accommodates all three use cases without divergence.

### [PROCESS] Parallel agent workflows need API signature coordination
When multiple agents modify the same utility function simultaneously, they can land on incompatible signatures. Pre-agreeing on function signatures before parallel work prevents merge conflicts.

### [TOOLING] esbuild transformSync handles CSS minification with zero extra deps
Since the project already uses esbuild for JS bundling, piping concatenated CSS through `transformSync({loader:'css', minify:true})` saved 22% (28.4KB to 22.2KB) with one line of code.

### [PERFORMANCE] Debounced autoSave needs a beforeunload flush
Debouncing `autoSave` to 500ms prevents `JSON.stringify` on every drag tick (~50KB for 130 nodes), but risks data loss if the tab closes during the debounce window. Always pair with `window.addEventListener('beforeunload', autoSaveNow)`. Export both `autoSave` (debounced) and `autoSaveNow` (immediate) from the persistence module.

### [PERFORMANCE] Cache getComputedStyle for CSS custom properties in hot loops
`getComputedStyle()` forces a style recalculation. For properties that only change on theme switch or resize (`--grid-major`, `--minimap-w`), cache at init and re-read on those events only. This avoids layout thrashing when grid/minimap redraws happen 60x/sec during pan.

### [PERFORMANCE] Targeted selection rendering via diff tracking
Instead of iterating all DOM elements to toggle `.selected`, track `prevSelectedIds` and compute toAdd/toRemove sets. Reduces 130-node class toggles to 1-2 targeted operations. The pattern generalizes to any sparse state-to-DOM synchronization.

### [CODE-PATTERN] Lazy undo snapshot for live-preview popups
When a popup applies changes immediately (no Apply button), call `saveSnapshot()` only once on the first change — not on every slider tick. Use a `_snapshotTaken` boolean reset on popup open. This gives a single Ctrl+Z to revert the entire editing session while avoiding 50+ redundant snapshots per interaction.

### [ARCHITECTURE] Popup lifecycle requires exhaustive dismiss tracking
A floating popup tied to node selection must be dismissed in every code path that invalidates its context: ESC, Delete, Undo, Redo, connection click, rubber-band select, tool switch. Missing even one path leaves a stale popup with a dangling node reference. Treat `hidePopup()` calls as a first-class integration concern.

### [PROCESS] Local skills encode tribal knowledge for vanilla JS projects
Framework-less projects have no convention to lean on. Codifying patterns like the module init order, popup lifecycle, and node type registry as `.claude/skills/` files means new agents discover project-specific patterns automatically instead of reverse-engineering them from 10+ files.
