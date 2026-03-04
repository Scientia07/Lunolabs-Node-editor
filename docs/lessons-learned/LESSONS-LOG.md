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
