# Phase 3: Architecture Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 730-line sidebar god module, unify duplicate logic, introduce an event bus, and extract shared helpers to reduce coupling and duplication.

**Architecture:** Bottom-up extraction order. First extract small helpers (A4-A7), then introduce the event bus (A3), then split the sidebar (A1), and finally unify loadProject (A2). Each task is independently verifiable via `node build.js`.

**Tech Stack:** Vanilla JS ES modules, no test framework (verify via build + browser)

**Note:** This project has no test framework. Verification is done via `node build.js` (must compile) and manual browser check. Each task ends with a build verification step.

---

### Task 1: Extract snapshot helper in state.js (A4)

**Files:**
- Modify: `src/js/state.js:52-104`

The snapshot creation logic `{ nodes, connections, nextId, groups, hiddenSectors }` is duplicated 3 times (saveSnapshot, undo, redo). Extract a `createSnapshot()` function.

**Step 1: Add createSnapshot() function**

In `src/js/state.js`, add after `genId()` (line 49):

```js
/** Create a JSON snapshot of the current reversible state */
function createSnapshot() {
  return JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
    groups: state.groups,
    hiddenSectors: [...state.hiddenSectors],
  });
}
```

**Step 2: Refactor saveSnapshot to use createSnapshot**

```js
export function saveSnapshot() {
  state.undoStack.push(createSnapshot());
  state.redoStack = [];
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
}
```

**Step 3: Refactor undo to use createSnapshot**

```js
export function undo(fullRender, autoSave) {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());
  const snap = JSON.parse(state.undoStack.pop());
  applySnapshot(snap);
  fullRender();
  autoSave();
}
```

**Step 4: Add applySnapshot helper and refactor redo**

```js
function applySnapshot(snap) {
  state.nodes = snap.nodes;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  if (snap.groups) state.groups = snap.groups;
  if (snap.hiddenSectors) state.hiddenSectors = new Set(snap.hiddenSectors);
  state.selectedIds.clear();
  rebuildIndex();
}

export function redo(fullRender, autoSave) {
  if (!state.redoStack.length) return;
  state.undoStack.push(createSnapshot());
  const snap = JSON.parse(state.redoStack.pop());
  applySnapshot(snap);
  fullRender();
  autoSave();
}
```

**Step 5: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 6: Commit**

```bash
git add src/js/state.js
git commit -m "refactor(A4): extract createSnapshot/applySnapshot helpers in state.js"
```

---

### Task 2: Extract bounding box helper (A5)

**Files:**
- Modify: `src/js/utils.js` (add function)
- Modify: `src/js/export-png.js:17-26` (use helper)
- Modify: `src/js/transform.js:35-44` (use helper)
- Modify: `src/js/minimap.js:25-32` (use helper)

The same bounding box calculation appears in 3 files. Extract to `utils.js`.

**Step 1: Add getNodesBoundingBox to utils.js**

Append to `src/js/utils.js`:

```js
/**
 * Calculate bounding box of all nodes.
 * @param {Array} nodes - array of node objects with x, y
 * @param {HTMLElement} [nodesLayer] - optional DOM layer for measuring actual element sizes
 * @param {number} [pad=80] - padding around the bounding box
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }} or null if no nodes
 */
export function getNodesBoundingBox(nodes, nodesLayer, pad = 80) {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const el = nodesLayer?.querySelector(`[data-id="${n.id}"]`);
    const w = el ? el.offsetWidth : (n.width || 140);
    const h = el ? el.offsetHeight : (n.height || 60);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}
```

**Step 2: Refactor export-png.js to use helper**

In `src/js/export-png.js`, add import:
```js
import { getContrastColor, wrapText, roundRect, getNodesBoundingBox } from './utils.js';
```

Replace lines 17-29 with:
```js
  const nodesLayer = getNodesLayer();
  const box = getNodesBoundingBox(state.nodes, nodesLayer);
  if (!box) { showToast('Keine Elemente zum Exportieren'); return; }
  const { minX, minY, maxX, maxY } = box;
  const canvasW = maxX - minX;
  const canvasH = maxY - minY;
```

**Step 3: Refactor transform.js zoomFit to use helper**

In `src/js/transform.js`, add import:
```js
import { getNodesBoundingBox } from './utils.js';
```

Replace lines 35-49 with:
```js
  const nodesLayer = getNodesLayer();
  const box = getNodesBoundingBox(state.nodes, nodesLayer);
  if (!box) return;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
```

**Step 4: Refactor minimap.js to use helper**

In `src/js/minimap.js`, add import:
```js
import { getNodesBoundingBox } from './utils.js';
```

Replace the bounding box calc (lines 25-35) with:
```js
  const box = getNodesBoundingBox(state.nodes, null, 100);
  if (!box) return;
  const { minX, minY, maxX, maxY } = box;
  const worldW = (maxX - minX) || 1;
  const worldH = (maxY - minY) || 1;
```

Note: minimap uses pad=100, not the default 80.

**Step 5: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 6: Commit**

```bash
git add src/js/utils.js src/js/export-png.js src/js/transform.js src/js/minimap.js
git commit -m "refactor(A5): extract getNodesBoundingBox helper to utils.js"
```

---

### Task 3: Extract project serialization helper (A6)

**Files:**
- Modify: `src/js/utils.js` (add function)
- Modify: `src/js/sidebar.js:597-609,689-703` (use helper)

Project data shape `{ version, meta, nodes, connections, nextId }` is built manually in `saveProject()` and `downloadProject()`.

**Step 1: Add serializeProject to utils.js**

Append to `src/js/utils.js`:

```js
/** Build a project data object from current state for save/export */
export function serializeProject(state, title) {
  return {
    version: 2,
    meta: {
      title: title || state.projectTitle || '',
      theme: state.theme,
      connectionStyle: state.connectionStyle,
      gridEnabled: state.gridEnabled,
    },
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  };
}
```

**Step 2: Update sidebar.js imports**

Add `serializeProject` to the import from `./utils.js`:
```js
import { esc, safeColor, showToast, validateProjectJSON, serializeProject } from './utils.js';
```

**Step 3: Refactor saveProject in sidebar.js**

Replace lines 597-609:
```js
function saveProject(name) {
  const projectData = serializeProject(state, name);
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    saved[slug] = projectData;
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    state.projectTitle = name;
  } catch { /* quota exceeded */ }
}
```

**Step 4: Refactor downloadProject in sidebar.js**

Replace lines 689-710:
```js
function downloadProject() {
  const name = state.projectTitle || 'projekt';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const data = serializeProject(state, name);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 5: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 6: Commit**

```bash
git add src/js/utils.js src/js/sidebar.js
git commit -m "refactor(A6): extract serializeProject helper to utils.js"
```

---

### Task 4: Use consistent ID generation (A7)

**Files:**
- Modify: `src/js/sidebar.js:294` (replace Date.now() with genId())

**Step 1: Add genId import to sidebar.js**

Update the state import line:
```js
import { state, nodeIndex, saveSnapshot, rebuildIndex, genId } from './state.js';
```

**Step 2: Replace Date.now() with genId()**

In `showGroupEditRow()`, change line 294:
```js
// Before:
const id = Date.now();
// After:
const id = genId();
```

**Step 3: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 4: Commit**

```bash
git add src/js/sidebar.js
git commit -m "refactor(A7): use genId() for group IDs instead of Date.now()"
```

---

### Task 5: Introduce lightweight event bus (A3)

**Files:**
- Modify: `src/js/state.js` (add event bus API)
- Modify: `src/js/main.js` (emit events instead of passing fullRender)
- Modify: `src/js/interactions.js` (subscribe to bus)
- Modify: `src/js/sidebar.js` (subscribe to bus)
- Modify: `src/js/keyboard.js` (subscribe to bus)
- Modify: `src/js/toolbar.js` (subscribe to bus)

**Step 1: Add event bus to state.js**

Add at the end of `src/js/state.js`:

```js
// ─── Event Bus ───
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function emit(event, ...args) {
  if (listeners.has(event)) {
    for (const fn of listeners.get(event)) fn(...args);
  }
}
```

**Step 2: Wire fullRender to event bus in main.js**

In `src/js/main.js`, add import:
```js
import { state, rebuildIndex, nodeIndex, saveSnapshot, on, emit } from './state.js';
```

After the `fullRender()` function definition (~line 37), register it:
```js
on('render', fullRender);
```

Also update undo/redo: in main.js the `editor:render` listener already calls `fullRender()`. The event bus is for module-internal use; the DOM `editor:render` event can stay for now as a bridge.

**Step 3: Update interactions.js to use event bus**

In `src/js/interactions.js`, add `emit` to the state import:
```js
import { state, nodeIndex, genId, saveSnapshot, rebuildIndex, emit } from './state.js';
```

Remove the `fullRenderFn` variable (line 28). Replace all calls to `fullRenderFn()` with `emit('render')`.

In `initInteractions(fullRender)`, remove the `fullRenderFn = fullRender` assignment. The function signature can keep the parameter for backward compat during transition but it's unused.

Actually — cleaner: change the signature to `initInteractions()` (no args). Update `main.js` call from `initInteractions(fullRender)` to `initInteractions()`.

**Step 4: Update keyboard.js to use event bus**

In `src/js/keyboard.js`, add `emit` to the state import:
```js
import { state, undo, redo, emit } from './state.js';
```

Remove `fullRenderFn` variable. Replace `fullRenderFn()` calls with `emit('render')`.

Change `initKeyboard(setTool, fullRender)` to `initKeyboard(setTool)` — drop the fullRender param.

Update `main.js`: `initKeyboard(setTool)` instead of `initKeyboard(setTool, fullRender)`.

**Step 5: Update toolbar.js to use event bus**

In `src/js/toolbar.js`, add `emit` to the state import:
```js
import { state, undo, redo, emit } from './state.js';
```

Remove `fullRenderFn` variable. Replace `fullRenderFn()` calls with `emit('render')`.

Change `initToolbar(fullRender)` to `initToolbar()`. Update `main.js` accordingly.

**Step 6: Update sidebar.js to use event bus**

In `src/js/sidebar.js`, add `emit` to the state import:
```js
import { state, nodeIndex, saveSnapshot, rebuildIndex, genId, emit } from './state.js';
```

Remove `fullRenderFn` variable. Replace `fullRenderFn()` calls with `emit('render')`.

Change `initSidebar(fullRender)` to `initSidebar()`. Update `main.js` accordingly.

**Step 7: Update undo/redo to use event bus**

In `src/js/state.js`, refactor undo/redo to emit instead of taking callbacks:

```js
export function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.undoStack.pop()));
  emit('render');
  emit('save');
}

export function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.redoStack.pop()));
  emit('render');
  emit('save');
}
```

Then in `main.js`, register autoSave on the save event:
```js
on('save', autoSave);
```

Update all callers of `undo(fullRender, autoSave)` to just `undo()`:
- `keyboard.js`: `undo()` and `redo()`
- `toolbar.js`: `undo()` and `redo()`

**Step 8: Clean up main.js init calls**

The init sequence in main.js becomes:
```js
on('render', fullRender);
on('save', autoSave);

initToolbar();
initInteractions();
initKeyboard(setTool);
initSidebar();
```

**Step 9: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 10: Open browser and verify**

Open `dist/index.html`, test:
- Create/move nodes (render works)
- Undo/redo (Ctrl+Z/Y)
- Sidebar toggle (P key)
- Tool switching (V/C keys)
- Settings changes in sidebar

**Step 11: Commit**

```bash
git add src/js/state.js src/js/main.js src/js/interactions.js src/js/keyboard.js src/js/toolbar.js src/js/sidebar.js
git commit -m "refactor(A3): introduce event bus in state.js, replace callback threading"
```

---

### Task 6: Split sidebar.js into domain modules (A1)

**Files:**
- Create: `src/js/project-manager.js` (save/load/delete/import/download/new)
- Create: `src/js/settings-panel.js` (settings tab rendering + event wiring)
- Modify: `src/js/sidebar.js` (thin UI shell: tabs, connections, groups)
- Modify: `src/js/main.js` (update imports if needed)

**Step 1: Create project-manager.js**

Extract from sidebar.js: `getAllProjects`, `saveProject`, `deleteSavedProject`, `loadProject`, `applyProject`, `importProjectFile`, `downloadProject`, `newBlankProject`, and `SAVED_PROJECTS_KEY`.

```js
/**
 * Project Management — save/load/delete/import/download
 */
import { state, rebuildIndex, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, showToast, validateProjectJSON, serializeProject } from './utils.js';

const SAVED_PROJECTS_KEY = 'network-editor-saved-projects';

export function getAllProjects() {
  const projects = [];
  if (window.__EMBEDDED_PROJECTS__) {
    for (const [key, data] of Object.entries(window.__EMBEDDED_PROJECTS__)) {
      projects.push({ key, title: data.meta?.title || key, source: 'embedded', data });
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    for (const [key, data] of Object.entries(saved)) {
      projects.push({ key, title: data.meta?.title || key, source: 'saved', data });
    }
  } catch { /* corrupt data */ }
  return projects;
}

export function saveProject(name) {
  const projectData = serializeProject(state, name);
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    saved[slug] = projectData;
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    state.projectTitle = name;
  } catch { /* quota exceeded */ }
}

export function deleteSavedProject(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    delete saved[key];
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
  } catch { /* ignore */ }
}

export function applyProject(project, name) {
  state.nodes = project.nodes || [];
  state.connections = project.connections || [];
  state.nextId = project.nextId || 1;
  state.groups = [];
  state.hiddenSectors = new Set();
  state.projectTitle = project.meta?.title || name;
  state.selectedIds.clear();
  state.undoStack = [];
  state.redoStack = [];

  if (project.meta) {
    if (project.meta.theme) {
      state.theme = project.meta.theme;
      document.documentElement.setAttribute('data-theme', state.theme);
    }
    if (project.meta.connectionStyle) state.connectionStyle = project.meta.connectionStyle;
    if (project.meta.gridEnabled !== undefined) state.gridEnabled = project.meta.gridEnabled;
  }

  rebuildIndex();
  emit('render');
  autoSave();
}

export function loadProjectEntry(projectEntry) {
  applyProject(projectEntry.data, projectEntry.key);
}

export function importProjectFile(refreshCallback) {
  const input = document.getElementById('file-input');
  const handler = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(reader.result);
        const check = validateProjectJSON(project);
        if (!check.valid) {
          showToast('Ungueltige Datei: ' + check.error);
          return;
        }
        const name = project.meta?.title || file.name.replace('.json', '');
        applyProject(project, name);
        saveProject(name);
        if (refreshCallback) refreshCallback();
      } catch { showToast('Fehler beim Import — ungueltige JSON-Datei'); }
    };
    reader.readAsText(file);
    input.value = '';
    input.removeEventListener('change', handler);
  };
  input.addEventListener('change', handler);
  input.click();
}

export function downloadProject() {
  const name = state.projectTitle || 'projekt';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const data = serializeProject(state, name);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function newBlankProject() {
  state.nodes = [];
  state.connections = [];
  state.nextId = 1;
  state.groups = [];
  state.hiddenSectors = new Set();
  state.projectTitle = '';
  state.selectedIds.clear();
  state.undoStack = [];
  state.redoStack = [];
  state.panX = window.innerWidth / 2 - 200;
  state.panY = window.innerHeight / 2 - 100;
  state.zoom = 1;
  rebuildIndex();
  emit('render');
  autoSave();
}
```

**Step 2: Create settings-panel.js**

Extract `renderSettingsTab` and all its event wiring. This module exports a single `renderSettingsTab(contentEl)` function.

```js
/**
 * Settings Panel — connection style, grid, theme, project list
 */
import { state, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor } from './utils.js';
import {
  getAllProjects, saveProject, deleteSavedProject,
  loadProjectEntry, importProjectFile, downloadProject, newBlankProject
} from './project-manager.js';

// SVG icons (inline, small)
const iconSave = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const iconDownload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const iconUpload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
const iconFile = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

export function renderSettingsTab(contentEl, refreshSidebarFn) {
  // ... (the full renderSettingsTab function body from sidebar.js lines 372-572,
  //       replacing fullRenderFn() with emit('render'),
  //       and using imported project-manager functions)
}
```

Note: The full function body is the existing `renderSettingsTab()` from sidebar.js. The key changes:
- Import project management functions from `project-manager.js`
- Replace `fullRenderFn()` with `emit('render')`
- Accept `contentEl` and `refreshSidebarFn` as parameters instead of closures

**Step 3: Update sidebar.js to import from new modules**

Remove all project management functions and `renderSettingsTab` from sidebar.js. Import what's needed:

```js
import { state, nodeIndex, saveSnapshot, rebuildIndex, genId, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor } from './utils.js';
import { renderSettingsTab } from './settings-panel.js';
import { applyVisibility } from './sidebar.js'; // self-reference for export

// Keep: initSidebar, toggleSidebar, refreshSidebar, renderConnectionsTab,
//       renderGroupsTab, applyVisibility, and their helper functions
```

The `refreshSidebar()` function calls `renderSettingsTab(contentEl, refreshSidebar)` for the settings tab.

**Step 4: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 5: Open browser and verify**

Test in `dist/index.html`:
- Sidebar opens, all 3 tabs render correctly
- Settings: project list, save/load/delete, import/export all work
- Settings: connection style, grid, theme changes apply
- Connections tab: list, hover, click, delete all work
- Groups tab: sector toggles, custom groups all work

**Step 6: Commit**

```bash
git add src/js/project-manager.js src/js/settings-panel.js src/js/sidebar.js
git commit -m "refactor(A1): split sidebar into sidebar-ui, project-manager, settings-panel"
```

---

### Task 7: Unify duplicate loadProject logic (A2)

**Files:**
- Modify: `src/js/project.js` (merge into single loadProject)
- Modify: `src/js/project-manager.js` (use unified loadProject)
- Modify: `src/js/main.js` (update import if needed)

The two `loadProject` implementations diverge:
- `project.js:loadProject` — applies theme via `applyTheme()`, renders legend, does NOT reset groups/undoStack
- `project-manager.js:applyProject` — resets groups/undoStack/hiddenSectors, sets theme via DOM attr, does NOT render legend

**Step 1: Create unified loadProject in project.js**

```js
import { state, rebuildIndex, emit } from './state.js';
import { applyTheme } from './theme.js';
import { safeColor } from './utils.js';

/**
 * Load a project JSON object into state. Single source of truth.
 * @param {object} project - project data with nodes, connections, meta
 * @param {object} [opts] - options
 * @param {string} [opts.name] - fallback project name
 * @param {boolean} [opts.resetState=true] - reset groups/undo/selection (false for initial URL load)
 */
export function loadProject(project, opts = {}) {
  const { name = '', resetState = true } = opts;

  state.nodes = project.nodes || [];
  state.connections = project.connections || [];
  state.nextId = project.nextId || 1;
  state.projectTitle = project.meta?.title || name;

  if (resetState) {
    state.groups = [];
    state.hiddenSectors = new Set();
    state.selectedIds.clear();
    state.undoStack = [];
    state.redoStack = [];
  }

  if (project.meta) {
    if (project.meta.theme) applyTheme(project.meta.theme);
    if (project.meta.connectionStyle) state.connectionStyle = project.meta.connectionStyle;
    if (project.meta.gridEnabled !== undefined) state.gridEnabled = project.meta.gridEnabled;
    if (project.meta.legend) renderLegend(project.meta.legend);
  }

  rebuildIndex();
}
```

**Step 2: Update loadFromURL to use unified loadProject**

```js
export async function loadFromURL() {
  // ... same validation logic ...
  // Pass resetState: false for initial load (no existing state to clear)
  loadProject(project, { resetState: false });
  return true;
}
```

**Step 3: Update project-manager.js to use unified loadProject**

```js
import { loadProject } from './project.js';

export function applyProject(project, name) {
  loadProject(project, { name, resetState: true });
  emit('render');
  autoSave();
}
```

This replaces the entire `applyProject` body — it now delegates to the single `loadProject` and adds the render/save that the sidebar needs.

**Step 4: Verify build**

Run: `node build.js`
Expected: "Built dist/index.html successfully"

**Step 5: Browser verification**

Test:
- Load page with `?project=netzwerk-jb-march` — legend renders, theme applies
- Load a different project from sidebar — state resets properly, no leftover groups
- Create new blank project — clean slate
- Import JSON file — loads correctly

**Step 6: Commit**

```bash
git add src/js/project.js src/js/project-manager.js
git commit -m "refactor(A2): unify duplicate loadProject logic into single source of truth"
```

---

## Summary

| Task | ID | Est. | Description |
|------|----|------|-------------|
| 1 | A4 | 5min | Extract createSnapshot/applySnapshot in state.js |
| 2 | A5 | 10min | Extract getNodesBoundingBox to utils.js |
| 3 | A6 | 5min | Extract serializeProject to utils.js |
| 4 | A7 | 2min | Use genId() for group IDs |
| 5 | A3 | 20min | Introduce event bus, remove callback threading |
| 6 | A1 | 25min | Split sidebar into 3 modules |
| 7 | A2 | 10min | Unify loadProject logic |

**Total: 7 tasks, 7 commits**
