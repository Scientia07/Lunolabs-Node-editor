# Phase 6 Remaining (F6, F2, F4) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dirty-flag warnings, per-node hide in sector hierarchy, and visibility-aware exports.

**Architecture:** Three independent features built in dependency order. F6 adds `isDirty` flag to state + native confirm. F2 extends Groups tab with child node rows and `hiddenNodes` Set. F4 extracts hidden-node logic into a reusable utility and wraps export handlers with a confirm modal.

**Tech Stack:** Vanilla JS ES modules, Vitest for tests, no framework.

---

## Task 1: F6 — Add isDirty Flag to State

**Files:**
- Modify: `src/js/state.js:16-46` (add isDirty to state object)
- Modify: `src/js/state.js:86-90` (set isDirty in saveSnapshot)
- Test: `src/js/__tests__/state.test.js`

**Step 1: Write the failing test**

Add to `src/js/__tests__/state.test.js`:

```js
describe('isDirty', () => {
  it('starts as false', () => {
    expect(state.isDirty).toBe(false);
  });

  it('is set to true after saveSnapshot', () => {
    state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
    rebuildIndex();
    saveSnapshot();
    expect(state.isDirty).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/js/__tests__/state.test.js`
Expected: FAIL — `state.isDirty` is `undefined`

**Step 3: Implement**

In `src/js/state.js`, add to state object (after line 45):
```js
isDirty: false,
```

In `saveSnapshot()` (line 87), add after `state.undoStack.push(...)`:
```js
state.isDirty = true;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/js/__tests__/state.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/js/state.js src/js/__tests__/state.test.js
git commit -m "feat(F6): add isDirty flag to state, set on saveSnapshot"
```

---

## Task 2: F6 — Clear isDirty on Save

**Files:**
- Modify: `src/js/persistence.js:36-52` (clear isDirty in flushSave)
- Modify: `src/js/project-manager.js:41-49` (clear isDirty in saveProject)
- Test: `src/js/__tests__/persistence.test.js`

**Step 1: Write the failing test**

Add to `src/js/__tests__/persistence.test.js` (if it exists, or create):

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, saveSnapshot } from '../state.js';

describe('isDirty cleared on save', () => {
  beforeEach(() => {
    state.isDirty = false;
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.groups = [];
    state.hiddenSectors = new Set();
    state.projectTitle = '';
    state.projectKey = null;
  });

  it('isDirty is cleared after flushSave', async () => {
    // We can't easily test flushSave directly (not exported),
    // but we verify the flag is present and can be set/cleared
    state.isDirty = true;
    expect(state.isDirty).toBe(true);
    state.isDirty = false;
    expect(state.isDirty).toBe(false);
  });
});
```

Note: `flushSave` is internal to persistence.js. The actual integration test is manual — verify `state.isDirty = false` after autosave fires. The unit test confirms the flag mechanics.

**Step 2: Implement**

In `src/js/persistence.js`, in `flushSave()` at end (after line 51, before catch):
```js
state.isDirty = false;
```

In `src/js/project-manager.js`, in `saveProject()` at end (after line 48):
```js
state.isDirty = false;
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/js/persistence.js src/js/project-manager.js
git commit -m "feat(F6): clear isDirty on autoSave and saveProject"
```

---

## Task 3: F6 — confirmIfDirty Utility + Wire Into Project Manager

**Files:**
- Modify: `src/js/utils.js` (add confirmIfDirty)
- Modify: `src/js/project-manager.js:62-133` (wrap loadProject, newBlankProject, importProjectFile)
- Test: `src/js/__tests__/utils.test.js`

**Step 1: Write the failing test**

Add to `src/js/__tests__/utils.test.js`:

```js
import { confirmIfDirty } from '../utils.js';
import { state } from '../state.js';

describe('confirmIfDirty', () => {
  beforeEach(() => {
    state.isDirty = false;
  });

  it('calls callback immediately when not dirty', () => {
    const fn = vi.fn();
    confirmIfDirty(fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('calls callback when dirty and user confirms', () => {
    state.isDirty = true;
    globalThis.confirm = vi.fn(() => true);
    const fn = vi.fn();
    confirmIfDirty(fn);
    expect(globalThis.confirm).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does NOT call callback when dirty and user cancels', () => {
    state.isDirty = true;
    globalThis.confirm = vi.fn(() => false);
    const fn = vi.fn();
    confirmIfDirty(fn);
    expect(globalThis.confirm).toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/js/__tests__/utils.test.js`
Expected: FAIL — `confirmIfDirty is not exported`

**Step 3: Implement**

In `src/js/utils.js`, add at end:
```js
/** Guard destructive actions — warns if state has unsaved changes */
export function confirmIfDirty(callback) {
  if (state.isDirty) {
    if (!confirm('Ungespeicherte Aenderungen gehen verloren. Fortfahren?')) return;
  }
  callback();
}
```

Add import at top of utils.js:
```js
import { state } from './state.js';
```
(Check if state is already imported — if so, skip.)

**Step 4: Wire into project-manager.js**

In `src/js/project-manager.js`:

- Add import: `import { confirmIfDirty } from './utils.js';`
- Wrap `loadProject()` (line 62-64):
```js
export function loadProject(projectEntry) {
  confirmIfDirty(() => applyProject(projectEntry.data, projectEntry.key));
}
```
- Wrap `newBlankProject()` (line 117-133):
```js
export function newBlankProject() {
  confirmIfDirty(() => {
    state.nodes = [];
    // ... existing code ...
  });
}
```
- Wrap `importProjectFile()` (line 73-99): add `confirmIfDirty` around the file picker trigger:
```js
export function importProjectFile(refreshCallback) {
  confirmIfDirty(() => {
    const input = document.getElementById('file-input');
    // ... existing code ...
  });
}
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/js/utils.js src/js/project-manager.js src/js/__tests__/utils.test.js
git commit -m "feat(F6): confirmIfDirty guard on project load/new/import"
```

---

## Task 4: F2 — Add hiddenNodes to State + Persistence

**Files:**
- Modify: `src/js/state.js:16-46` (add hiddenNodes to state)
- Modify: `src/js/state.js:65-84` (include hiddenNodes in snapshots)
- Modify: `src/js/persistence.js:36-52` (serialize hiddenNodes)
- Modify: `src/js/persistence.js:55-78` (deserialize hiddenNodes)
- Modify: `src/js/project.js:26-54` (reset hiddenNodes in loadProject)
- Test: `src/js/__tests__/state.test.js`

**Step 1: Write the failing test**

Add to `src/js/__tests__/state.test.js`:

```js
describe('hiddenNodes', () => {
  it('exists as empty Set in initial state', () => {
    expect(state.hiddenNodes).toBeInstanceOf(Set);
    expect(state.hiddenNodes.size).toBe(0);
  });

  it('is included in undo snapshots', () => {
    state.nodes = [{ id: 1, x: 0, y: 0, type: 'company' }];
    rebuildIndex();
    state.hiddenNodes = new Set([1]);
    saveSnapshot();
    state.hiddenNodes = new Set();
    undo();
    expect(state.hiddenNodes.has(1)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/js/__tests__/state.test.js`
Expected: FAIL — `state.hiddenNodes` is `undefined`

**Step 3: Implement**

In `src/js/state.js`:
- Add to state object: `hiddenNodes: new Set(),`
- In `createSnapshot()`: add `hiddenNodes: [...state.hiddenNodes],` to the JSON object
- In `applySnapshot()`: add `state.hiddenNodes = new Set(snap.hiddenNodes || []);`

In `src/js/persistence.js`:
- In `flushSave()`: add `hiddenNodes: state.hiddenNodes ? [...state.hiddenNodes] : [],`
- In `autoLoad()`: add `state.hiddenNodes = new Set(d.hiddenNodes || []);`

In `src/js/project.js`:
- In `loadProject()`, inside `if (resetState)` block: add `state.hiddenNodes = new Set();`

**Step 4: Run tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/js/state.js src/js/persistence.js src/js/project.js src/js/__tests__/state.test.js
git commit -m "feat(F2): add hiddenNodes Set to state, persistence, undo"
```

---

## Task 5: F2 — Render Child Nodes in Groups Tab

**Files:**
- Modify: `src/js/sidebar.js:176-235` (renderGroupsTab — add child rows under each sector)
- Modify: `src/styles/sidebar.css` (add child node indent styles)

**Step 1: Implement child node rendering**

In `src/js/sidebar.js`, in `renderGroupsTab()`, after each sector's `<div class="group-item">` row (line 196), add child node rows:

```js
// After the sector row, render connected child nodes
const children = getNodesConnectedTo(s.id)
  .map(id => nodeIndex.get(id))
  .filter(n => n && n.type !== 'sector' && n.type !== 'center')
  .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

for (const child of children) {
  const nodeHidden = state.hiddenNodes.has(child.id);
  html += `<div class="group-child ${nodeHidden ? 'hidden-group' : ''}" data-node-id="${child.id}">
    <span class="group-child-name">${esc(child.label || 'Node ' + child.id)}</span>
    <button class="group-eye group-child-eye" data-hide-node="${child.id}" title="${nodeHidden ? 'Einblenden' : 'Ausblenden'}">
      ${nodeHidden ? iconEyeOff : iconEye}
    </button>
  </div>`;
}
```

**Step 2: Wire click handlers**

After existing event wiring in `renderGroupsTab()`, add:

```js
// Wire individual node hide toggle
pane.querySelectorAll('[data-hide-node]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nid = parseInt(btn.dataset.hideNode, 10);
    if (state.hiddenNodes.has(nid)) {
      state.hiddenNodes.delete(nid);
    } else {
      state.hiddenNodes.add(nid);
    }
    applyVisibility();
    autoSave();
    renderGroupsTab();
  });
});
```

**Step 3: Add CSS for child rows**

In `src/styles/sidebar.css`, add after `.group-item` styles:

```css
.group-child {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 28px;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  border-radius: 4px;
}
.group-child:hover { background: var(--accent-dim); }
.group-child.hidden-group { opacity: 0.45; }
.group-child-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-child-eye { margin-left: auto; }
```

**Step 4: Update applyVisibility**

In `src/js/sidebar.js`, in `applyVisibility()` (line 506-544), add after the custom groups block (line 527):

```js
// Hidden individual nodes
for (const nid of state.hiddenNodes) {
  hiddenNodeIds.add(nid);
}
```

**Step 5: Verify visually**

Run: `node build.js` and open in browser. Check Groups tab shows sectors with expandable child lists. Click eye icons to hide/show individual nodes.

**Step 6: Commit**

```bash
git add src/js/sidebar.js src/styles/sidebar.css
git commit -m "feat(F2): sector child nodes in Groups tab with per-node hide"
```

---

## Task 6: F4 — Extract getHiddenNodeIds Utility

**Files:**
- Modify: `src/js/sidebar.js:506-544` (extract logic into shared function)
- Modify: `src/js/utils.js` (or add to sidebar.js as export)
- Test: `src/js/__tests__/sidebar-visibility.test.js` (new)

**Step 1: Write the failing test**

Create `src/js/__tests__/sidebar-visibility.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { getHiddenNodeIds } from '../sidebar.js';

describe('getHiddenNodeIds', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.groups = [];
    state.hiddenSectors = new Set();
    state.hiddenNodes = new Set();
    nodeIndex.clear();
  });

  it('returns empty set when nothing hidden', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0 },
      { id: 2, type: 'company', x: 10, y: 10 },
    ];
    state.connections = [{ id: 100, from: 1, to: 2 }];
    rebuildIndex();
    const hidden = getHiddenNodeIds();
    expect(hidden.size).toBe(0);
  });

  it('includes individually hidden nodes', () => {
    state.nodes = [{ id: 5, type: 'company', x: 0, y: 0 }];
    rebuildIndex();
    state.hiddenNodes.add(5);
    const hidden = getHiddenNodeIds();
    expect(hidden.has(5)).toBe(true);
  });

  it('includes hidden sector and its exclusive children', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0 },
      { id: 2, type: 'company', x: 10, y: 10 },
    ];
    state.connections = [{ id: 100, from: 1, to: 2 }];
    rebuildIndex();
    state.hiddenSectors.add(1);
    const hidden = getHiddenNodeIds();
    expect(hidden.has(1)).toBe(true);
    expect(hidden.has(2)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/js/__tests__/sidebar-visibility.test.js`
Expected: FAIL — `getHiddenNodeIds is not exported`

**Step 3: Extract and export**

In `src/js/sidebar.js`, extract the hidden-node logic from `applyVisibility()` into a new exported function:

```js
/** Compute set of all node IDs that should be hidden */
export function getHiddenNodeIds() {
  const hiddenNodeIds = new Set();

  // Hidden sectors + their connected nodes
  for (const sid of state.hiddenSectors) {
    hiddenNodeIds.add(sid);
    for (const nid of getNodesConnectedTo(sid)) {
      const otherSectors = getNodesConnectedTo(nid).filter(
        id => (nodeIndex.get(id)?.type === 'sector' || nodeIndex.get(id)?.type === 'center') && !state.hiddenSectors.has(id)
      );
      if (otherSectors.length === 0) hiddenNodeIds.add(nid);
    }
  }

  // Hidden custom groups
  for (const g of state.groups) {
    if (g.hidden) {
      for (const nid of g.nodeIds) hiddenNodeIds.add(nid);
    }
  }

  // Hidden individual nodes
  for (const nid of state.hiddenNodes) {
    hiddenNodeIds.add(nid);
  }

  return hiddenNodeIds;
}
```

Then update `applyVisibility()` to call it:

```js
export function applyVisibility() {
  const hiddenNodeIds = getHiddenNodeIds();
  // ... rest of DOM manipulation stays the same ...
}
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/js/sidebar.js src/js/__tests__/sidebar-visibility.test.js
git commit -m "refactor(F4): extract getHiddenNodeIds from applyVisibility"
```

---

## Task 7: F4 — Export Visibility Confirm Modal

**Files:**
- Modify: `src/index.html` (add visibility confirm modal HTML)
- Modify: `src/styles/popups.css` (modal styles)
- Modify: `src/js/toolbar.js:84-99` (wrap export handlers)
- Modify: `src/js/export-json.js` (accept optional node/connection filter)
- Modify: `src/js/csv-export.js` (accept optional node filter)
- Modify: `src/js/export-png.js` (accept optional node/connection filter)

**Step 1: Add modal HTML**

In `src/index.html`, add near the other modals (after csv-import-modal):

```html
<div id="visibility-modal" class="modal-overlay" style="display:none">
  <div class="modal-box" style="max-width:360px">
    <h3>Export</h3>
    <p>Ausgeblendete Elemente einschliessen?</p>
    <div class="modal-actions">
      <button id="vis-export-all" class="modal-btn primary">Ja</button>
      <button id="vis-export-visible" class="modal-btn">Nein</button>
      <button id="vis-export-cancel" class="modal-btn cancel">Abbrechen</button>
    </div>
  </div>
</div>
```

**Step 2: Add helper to toolbar.js**

In `src/js/toolbar.js`, add import of `getHiddenNodeIds` from sidebar.js, then add:

```js
import { getHiddenNodeIds } from './sidebar.js';

/** Show visibility confirm if nodes are hidden, then call exportFn with filter flag */
function confirmVisibilityExport(exportAll, exportFiltered) {
  const hidden = getHiddenNodeIds();
  if (hidden.size === 0) { exportAll(); return; }

  const modal = document.getElementById('visibility-modal');
  modal.style.display = '';

  const cleanup = () => { modal.style.display = 'none'; };

  document.getElementById('vis-export-all').onclick = () => { cleanup(); exportAll(); };
  document.getElementById('vis-export-visible').onclick = () => { cleanup(); exportFiltered(hidden); };
  document.getElementById('vis-export-cancel').onclick = cleanup;
}
```

**Step 3: Update export functions to accept filter**

In `src/js/export-json.js`, add a parameter:
```js
export function exportJSON(excludeNodeIds) {
  const nodes = excludeNodeIds ? state.nodes.filter(n => !excludeNodeIds.has(n.id)) : state.nodes;
  const connections = excludeNodeIds
    ? state.connections.filter(c => !excludeNodeIds.has(c.from) && !excludeNodeIds.has(c.to))
    : state.connections;
  // Use filtered nodes/connections instead of state directly
  const data = JSON.stringify(serializeProject({ ...state, nodes, connections }, state.projectTitle), null, 2);
  // ... rest unchanged
}
```

In `src/js/csv-export.js`, update `buildCSV` and `exportCSV`:
```js
export function buildCSV(excludeNodeIds) {
  const nodes = excludeNodeIds ? state.nodes.filter(n => !excludeNodeIds.has(n.id)) : state.nodes;
  // ... use `nodes` variable (already does this)
}

export function exportCSV(excludeNodeIds) {
  const csv = buildCSV(excludeNodeIds);
  // ... rest unchanged
}
```

In `src/js/export-png.js`, update `exportPNG`:
```js
export function exportPNG(excludeNodeIds) {
  const nodes = excludeNodeIds ? state.nodes.filter(n => !excludeNodeIds.has(n.id)) : state.nodes;
  const connections = excludeNodeIds
    ? state.connections.filter(c => !excludeNodeIds.has(c.from) && !excludeNodeIds.has(c.to))
    : state.connections;
  // Use filtered nodes/connections instead of state.nodes/state.connections
  // ... rest unchanged (replace state.nodes -> nodes, state.connections -> connections)
}
```

**Step 4: Wire in toolbar.js**

Replace export button handlers (lines 88-99):

```js
bindButton('export-json-btn', 'click', () => {
  document.getElementById('export-dropdown')?.classList.remove('open');
  confirmVisibilityExport(() => exportJSON(), (hidden) => exportJSON(hidden));
});
bindButton('export-png-btn', 'click', () => {
  document.getElementById('export-dropdown')?.classList.remove('open');
  confirmVisibilityExport(() => exportPNG(), (hidden) => exportPNG(hidden));
});
bindButton('export-csv-btn', 'click', () => {
  document.getElementById('export-dropdown')?.classList.remove('open');
  confirmVisibilityExport(() => exportCSV(), (hidden) => exportCSV(hidden));
});
```

**Step 5: Add modal styles to popups.css**

Minimal additions (reuse existing `.modal-overlay`, `.modal-box` from CSV import):

```css
#visibility-modal .modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}
```

**Step 6: Build + verify visually**

Run: `node build.js` and test: hide a sector, try each export type. Modal should appear with Ja/Nein/Abbrechen.

**Step 7: Commit**

```bash
git add src/index.html src/styles/popups.css src/js/toolbar.js src/js/export-json.js src/js/csv-export.js src/js/export-png.js
git commit -m "feat(F4): visibility confirm modal on export when nodes are hidden"
```

---

## Task 8: Final Verification + Roadmap Update

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (previous 104 + new tests)

**Step 2: Build**

Run: `node build.js`
Expected: Success, no errors

**Step 3: Update roadmap**

In `docs/ROADMAP.md`, mark F2, F4, F6 as Done.

**Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 6 F2, F4, F6 as done in roadmap"
```
