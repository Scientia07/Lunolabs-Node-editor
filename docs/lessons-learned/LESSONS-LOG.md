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

---

## Session: Phase 3 Architecture Refactoring (A1-A7) — 2026-03-05

### [ARCHITECTURE] Event bus in the state module eliminates callback threading
Replacing `fullRenderFn` callback injection (stored as module-level `let` in 4 modules) with a 15-line `on()`/`off()`/`emit()` bus in state.js removed all callback threading. The bus lives in state.js because it's already the universal shared dependency — no new imports needed. Undo/redo became parameterless, simplifying their API from `undo(fullRender, autoSave)` to just `undo()`.

### [ARCHITECTURE] Unifying duplicate logic catches hidden behavioral divergence
The two `loadProject` functions in project.js and sidebar.js had silently diverged: one used `applyTheme()` while the other set `data-theme` directly; one handled legends, the other skipped them entirely. Merging into a single `loadProject(project, opts)` with a `resetState` flag fixed both bugs. DRY isn't just about code size — it prevents behavioral drift.

### [PROCESS] Bottom-up extraction order makes big refactors safe
Extracting small helpers first (A4: snapshot, A5: bounding box, A6: serialization, A7: ID gen) reduced the diff size when the event bus (A3) and sidebar split (A1) landed later. Each of the 7 commits was independently verifiable via `node build.js`, and no commit broke the build.

### [CODE-PATTERN] Callback parameters break circular deps in module splits
When splitting sidebar.js into 3 files, settings-panel.js needed to call `refreshSidebar()` from sidebar.js. Instead of creating a circular import, `refreshSidebar` is passed as a callback parameter to `renderSettingsTab(contentEl, refreshCallback)`. Simpler than re-exporting through a third module or overusing the event bus for UI-internal concerns.

### [PROCESS] Subagent-driven development keeps context clean across sequential tasks
Dispatching fresh subagents per task (7 refactoring tasks) prevented context pollution from accumulating file reads and edits. Each agent read only the files it needed, made targeted changes, and committed. The controller provided full task text directly (no plan file reading overhead).

---

## Session: Phase 7 Metadata System Implementation — 2026-03-05

### [ARCHITECTURE] Plain JSON objects make new features free for persistence and undo
Because `state.nodes` is stored/serialized as plain objects and deep-cloned via `JSON.stringify` for undo snapshots, adding `node.meta` required zero changes to persistence, serialization, or undo/redo code. 4 of 12 implementation tasks were "verify it already works" with tests only. Lesson: when designing state shape, keeping it as plain JSON-serializable objects pays compound interest on every new feature.

### [CODE-PATTERN] Split input/change events for slider-driven state changes
Using `input` for live preview (fires on every drag tick) and `change` for undo snapshots (fires only on release) prevents flooding the undo stack while still giving immediate visual feedback. This split-event pattern generalizes to any slider, color picker, or continuous-input control that drives persistent state.

### [CODE-PATTERN] CSS custom properties as inline style bridge between JS and pseudo-elements
Setting `--sector-rgb` as an inline CSS variable on each node element lets a single `.node-company--satellite::before` rule handle all sector colors via `rgba(var(--sector-rgb), 0.15)`. This avoids generating unique CSS classes per color and cleanly separates concerns: JS sets the data, CSS handles the visual treatment.

### [INSIGHT] Deriving state is simpler than storing state
Instead of storing `meta.tier` as a separate field with a toggle control, deriving tier from relevancy via `getTier()` eliminated an entire UI control (tier toggle), prevented stale data (tier out of sync with relevancy), and simplified the Details tab to a single slider. When two pieces of state have a deterministic relationship, store one and derive the other.

---

## Session: Phase 8-9 CSV Export & Import — 2026-03-05

### [ARCHITECTURE] Plain JSON state makes CSV round-tripping trivial
Because `node.meta` is a plain object that serializes cleanly, building CSV export was just iterating keys → columns. No ORM mapping, no serialization hooks. The same property that made undo/redo free for metadata also made CSV free.

### [CODE-PATTERN] Auto-detect delimiter by counting occurrences in the header line
Instead of asking the user whether their CSV uses `;` or `,`, counting occurrences in the first line (`semis >= commas ? ';' : ','`) handles both German Excel (`;`) and international CSVs (`,`) with zero UI. Edge cases are rare in practice.

### [CODE-PATTERN] Fuzzy header mapping eliminates manual column remapping UI
Mapping common aliases (`Name → label`, `Kontakt → contact`, `Art → type`) covers 95%+ of real-world CSVs. Unknown columns auto-map to `meta.<headerName>`. This saved ~40% of the import feature effort while handling the export-edit-reimport cycle perfectly.

### [ARCHITECTURE] Toolbar dropdown evolution: single action to menu
Converting the single import button into a dropdown (JSON + CSV) mirrors the export pattern and scales cleanly. The dropdown-close logic was already in place for exports — just needed to add `import-dropdown` to the same close handlers in `interactions.js` and `context-menu.js`.

### [PROCESS] Implementing export before import validates the format
Phase 8 (export) before Phase 9 (import) meant the CSV format was exercised and tested before import had to parse it. The 13 export tests served as implicit format documentation for the import parser.

---

## Session: Phase 10 Search & Filter — 2026-03-06

### [ARCHITECTURE] Pure functions first, UI layer second
Splitting `fuzzyMatch()` and `searchNodes()` as pure functions (no DOM, no imports from other modules) made them fully testable with Vitest without mocking. The UI layer (`renderSearchTab`, `navigateToNode`) was added in a later task, building on tested primitives. This separation also means the matching logic can be reused (e.g., for a future command palette) without dragging in DOM dependencies.

### [CODE-PATTERN] CSS classes for search state, not inline styles
Using `.search-dimmed` and `.search-highlight` CSS classes instead of manipulating `el.style.opacity` directly keeps the search visual layer composable with other visual states (selection, satellite wash, hidden sectors). The `!important` on `.search-dimmed` opacity is intentional — it must override per-node relevancy opacity to create a clear visual distinction.

### [ARCHITECTURE] Sidebar tab beats toolbar overlay for persistent search
A sidebar "Suche" tab keeps results visible while navigating the canvas — users can click through results one by one without re-opening the search. A Spotlight-style overlay would dismiss on each navigation, requiring re-search. The trade-off is sidebar real estate, but with 5 tabs the UI stays clean.

### [CODE-PATTERN] Debounce-free search works fine at 130 nodes
At the current scale (131 nodes), running `searchNodes()` on every keystroke with no debounce produces instant results. The fuzzy match is O(n*m) where n=nodes and m=max(label+meta lengths), which stays under 1ms for 131 nodes. Debouncing would add latency for no benefit — only add it if the node count exceeds ~500.

### [PROCESS] Subagent-per-task keeps implementation focused
Dispatching 5 fresh subagents (one per task) prevented context pollution. Each agent read only the files it needed and made targeted changes. The controller provided full task specs inline — no plan-file reading overhead. Total wall time was ~5 minutes for the full feature.

---

## Session: Phase 11 Hierarchy Scaffold & Sidebar Bugfix — 2026-03-06

### [ARCHITECTURE] BFS layers solve hierarchy display for graphs with shared children
In a network graph, a node in layer 2 can be connected to multiple nodes in layer 1. Per-node tree collapse would need to decide which parent "owns" the collapse — ambiguous and complex. Layer-based collapse (all nodes at depth N) sidesteps this entirely. The `buildHierarchyLayers()` BFS starts from the most-connected node and groups by graph distance.

### [CODE-PATTERN] Lightweight custom events decouple render paths without full re-render
The codebase had two render paths: `emit('render')` (heavy, full DOM rebuild) and `renderSelectionState()` (lightweight, CSS class toggle). The sidebar was only subscribed to the heavy path, so selection changes never updated the Details tab. Adding `editor:selection` as a lightweight DOM event from `renderSelectionState()` — fired only when selection actually changes (`toAdd.size || toRemove.size`) — lets the sidebar react without triggering expensive canvas re-renders.

### [ARCHITECTURE] UI-only state belongs in module scope, not in the persisted state object
`collapsedLayers` (which hierarchy layers are expanded/collapsed) is transient view preference — it resets on reload and doesn't affect data. Storing it as a module-level `Set` in sidebar.js (not in `state.js`) prevents it from triggering save/undo cycles and keeps the serialized state clean.

---

## Session: F5 Legend Integration — 2026-03-09

### [ARCHITECTURE] Derive UI from existing data instead of maintaining parallel state
The legend was originally stored as `meta.legend` in project JSON — a manually curated array of `{color, label}` pairs. Switching to auto-derivation from sector nodes eliminated an entire CRUD surface (add/edit/delete legend items), prevented stale data (legend out of sync with sectors), and reduced the feature from "legend editor" to "legend toggle". When data already exists in another form, derive from it rather than maintaining a copy.

### [CODE-PATTERN] `!== false` for backward-compatible boolean defaults
Using `state.showLegend !== false` (instead of `|| true`) means existing projects/saves without the field default to `true`, while still respecting an explicit `false`. This one-liner pattern handles schema evolution for booleans that default to truthy — no migration needed.

---

## Session: Security + Performance Fixes + Connection Labels — 2026-03-09

### [SECURITY] Guard all bracket-notation property writes with a whitelist function
Any `obj[userInput] = value` is a prototype pollution vector. The fix is trivial — a 5-line `safeMetaKey()` that rejects `__proto__`, `constructor`, `prototype` — but the bug is invisible until exploited. Apply the guard at every point where user-supplied strings become object keys, not just the most obvious one.

### [PERFORMANCE] Adjacency maps turn O(n²) graph traversal into O(n+c)
When `getNodesConnectedTo(id)` scans all connections for every node in a loop (BFS, hierarchy rendering, visibility computation), the cost is O(nodes × connections). Building a `Map<nodeId, Set<nodeId>>` once per render cycle costs O(connections) and makes each lookup O(1). The key insight: rebuild at entry points (`refreshSidebar`, `getHiddenNodeIds`), not inside the lookup function.

### [PERFORMANCE] requestAnimationFrame is the right debounce for render-triggering inputs
`setTimeout` adds arbitrary latency and can still fire multiple times per frame. `requestAnimationFrame` guarantees exactly 1 render per browser paint cycle — zero wasted work, zero perceptible lag. For slider/color picker `input` events that trigger full re-renders, this is the optimal coalescing strategy.

---

## Session: Architecture Cleanup + SVG Export — 2026-03-09

### [ARCHITECTURE] Pure function extraction is the highest-ROI refactoring pattern
Moving `buildHierarchyLayers()`, `computeHiddenNodeIds()`, and `buildAdjacencyMap()` from sidebar.js to graph-utils.js required zero behavioral changes — the functions were already pure in practice, just trapped in a module with DOM concerns. Making them explicitly pure (data parameters instead of module-level state access) yielded 20 independently testable functions with zero mocking.

### [CODE-PATTERN] SVG export maps 1:1 from Canvas 2D API with two exceptions
`ctx.measureText()` has no SVG equivalent (estimated via char-width heuristic), and `ctx.shadowBlur` becomes an SVG `<filter>` element. Everything else — gradients, bezier curves, rounded rects, text anchoring — has a direct SVG counterpart. Porting export-png.js to export-svg.js was mechanical translation.

### [ARCHITECTURE] Tool-specific creation logic is a natural extraction boundary
The sector/company/sticky/shape creation handlers in onMouseDown shared no state with the surrounding mouse event routing code. Extracting them to node-creation.js reduced interactions.js by 128 LOC while making it clear where to add new node types.
