# Code Quality Fixes & Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues found in code review (dead exports, naming conflicts, duplication) and add a test suite for core modules.

**Architecture:** Install vitest as test runner (fast, ESM-native, no config needed). Fix issues in order of severity. Write unit tests for pure-logic modules (state.js, utils.js, persistence.js, actions.js). Use jsdom environment for DOM-dependent tests.

**Tech Stack:** vitest, jsdom, vanilla JS ES modules

---

## Phase A: Setup & Quick Fixes (can run in parallel)

### Task A1: Install vitest test framework

**Files:**
- Modify: `package.json`

**Step 1: Install vitest + jsdom**

```bash
cd /home/joel/Lunolabs-External/Jugendbüro/Node-editor
npm install -D vitest jsdom
```

**Step 2: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Create vitest config**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

**Step 4: Verify vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "No test files found"

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest test framework with jsdom environment"
```

---

### Task A2: Remove dead export `getGradPopup()` in gradient-popup.js

**Files:**
- Modify: `src/js/gradient-popup.js:94`

**Step 1: Verify getGradPopup is unused**

Run: `grep -r "getGradPopup" src/js/`
Expected: Only one result — the export definition in gradient-popup.js

**Step 2: Remove the dead export**

Delete line 94 in `src/js/gradient-popup.js`:
```js
// DELETE THIS LINE:
export function getGradPopup() { return gradPopup; }
```

**Step 3: Build to verify no breakage**

Run: `node build.js`
Expected: Success

**Step 4: Commit**

```bash
git add src/js/gradient-popup.js
git commit -m "fix: remove unused getGradPopup() export"
```

---

### Task A3: Rename shadowing `on()` function in toolbar.js

**Files:**
- Modify: `src/js/toolbar.js`

**Step 1: Rename the local `on()` helper to `bindButton()`**

In `src/js/toolbar.js`, replace:
```js
/** Safe getElementById + addEventListener — skips if element missing */
function on(id, event, handler) {
```
with:
```js
/** Safe getElementById + addEventListener — skips if element missing */
function bindButton(id, event, handler) {
```

**Step 2: Replace all usages of `on(` with `bindButton(` in toolbar.js**

There are ~12 calls to `on(` in the file. Replace all with `bindButton(`.

**Step 3: Build to verify**

Run: `node build.js`
Expected: Success

**Step 4: Commit**

```bash
git add src/js/toolbar.js
git commit -m "refactor: rename toolbar on() to bindButton() to avoid event bus shadowing"
```

---

### Task A4: Align export-json.js export format with serializeProject()

**Files:**
- Modify: `src/js/export-json.js`

**Step 1: Use serializeProject() in exportJSON()**

Replace the manual JSON construction in `exportJSON()` with:
```js
import { serializeProject } from './utils.js';

export function exportJSON() {
  const data = JSON.stringify(serializeProject(state, state.projectTitle), null, 2);
  // ... rest stays the same
}
```

This ensures JSON export uses the same format as project save (includes `version`, `meta`).

**Step 2: Build to verify**

Run: `node build.js`
Expected: Success

**Step 3: Commit**

```bash
git add src/js/export-json.js
git commit -m "fix: use serializeProject() in exportJSON() for consistent format"
```

---

## Phase B: Unit Tests for Core Modules (run in parallel per task)

### Task B1: Tests for state.js (event bus, undo/redo, index)

**Files:**
- Create: `src/js/__tests__/state.test.js`

**Step 1: Write tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex, genId, saveSnapshot, undo, redo, on, off, emit } from '../state.js';

describe('state.js', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.undoStack = [];
    state.redoStack = [];
    state.selectedIds.clear();
    state.groups = [];
    state.hiddenSectors = new Set();
    nodeIndex.clear();
  });

  describe('genId', () => {
    it('returns incrementing IDs', () => {
      expect(genId()).toBe(1);
      expect(genId()).toBe(2);
      expect(genId()).toBe(3);
    });
  });

  describe('rebuildIndex', () => {
    it('populates nodeIndex from state.nodes', () => {
      const n1 = { id: 1, x: 0, y: 0, type: 'rect' };
      const n2 = { id: 2, x: 10, y: 10, type: 'circle' };
      state.nodes = [n1, n2];
      rebuildIndex();
      expect(nodeIndex.get(1)).toBe(n1);
      expect(nodeIndex.get(2)).toBe(n2);
      expect(nodeIndex.size).toBe(2);
    });

    it('clears stale entries', () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      rebuildIndex();
      state.nodes = [];
      rebuildIndex();
      expect(nodeIndex.size).toBe(0);
    });
  });

  describe('undo/redo', () => {
    beforeEach(() => {
      // Mock emit to avoid triggering render/save
      on('render', () => {});
      on('save', () => {});
    });

    it('saveSnapshot captures current state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      saveSnapshot();
      expect(state.undoStack.length).toBe(1);
    });

    it('undo restores previous state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      rebuildIndex();
      saveSnapshot();
      state.nodes = [{ id: 1, x: 99, y: 99, type: 'rect' }];
      undo();
      expect(state.nodes[0].x).toBe(10);
      expect(state.nodes[0].y).toBe(20);
    });

    it('redo re-applies undone state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      rebuildIndex();
      saveSnapshot();
      state.nodes = [{ id: 1, x: 99, y: 99, type: 'rect' }];
      rebuildIndex();
      undo();
      redo();
      expect(state.nodes[0].x).toBe(99);
    });

    it('saveSnapshot clears redo stack', () => {
      saveSnapshot();
      state.redoStack.push('something');
      saveSnapshot();
      expect(state.redoStack.length).toBe(0);
    });
  });

  describe('event bus', () => {
    it('on/emit delivers events', () => {
      let called = false;
      on('test-event', () => { called = true; });
      emit('test-event');
      expect(called).toBe(true);
    });

    it('passes arguments to listeners', () => {
      let received = null;
      on('data', (val) => { received = val; });
      emit('data', 42);
      expect(received).toBe(42);
    });

    it('off removes listener', () => {
      let count = 0;
      const fn = () => { count++; };
      on('inc', fn);
      emit('inc');
      off('inc', fn);
      emit('inc');
      expect(count).toBe(1);
    });

    it('emit with no listeners does not throw', () => {
      expect(() => emit('nonexistent')).not.toThrow();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/js/__tests__/state.test.js`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/js/__tests__/state.test.js
git commit -m "test: add unit tests for state.js (genId, index, undo/redo, event bus)"
```

---

### Task B2: Tests for utils.js (esc, safeColor, validateProjectJSON, serializeProject)

**Files:**
- Create: `src/js/__tests__/utils.test.js`

**Step 1: Write tests**

```js
import { describe, it, expect } from 'vitest';
import { esc, safeColor, validateProjectJSON, getContrastColor, getGradientCSS, snapToGrid, screenToCanvas, serializeProject } from '../utils.js';
import { state } from '../state.js';

describe('utils.js', () => {
  describe('esc', () => {
    it('escapes HTML entities', () => {
      expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
      expect(esc('a & b')).toBe('a &amp; b');
    });

    it('escapes single quotes', () => {
      expect(esc("it's")).toBe("it&#39;s");
    });

    it('handles non-string input', () => {
      expect(esc(42)).toBe('42');
    });
  });

  describe('safeColor', () => {
    it('accepts valid hex colors', () => {
      expect(safeColor('#ff0000')).toBe('#ff0000');
      expect(safeColor('#abc')).toBe('#abc');
      expect(safeColor('#aabbccdd')).toBe('#aabbccdd');
    });

    it('rejects invalid colors', () => {
      expect(safeColor('red')).toBe('#6c8aff');
      expect(safeColor('url(javascript:alert(1))')).toBe('#6c8aff');
      expect(safeColor('')).toBe('#6c8aff');
      expect(safeColor(null)).toBe('#6c8aff');
    });

    it('uses custom fallback', () => {
      expect(safeColor('invalid', '#000')).toBe('#000');
    });
  });

  describe('validateProjectJSON', () => {
    it('accepts valid project', () => {
      const result = validateProjectJSON({
        nodes: [{ id: 1, x: 0, y: 0, type: 'rect' }],
        connections: [{ id: 2, from: 1, to: 1 }],
        nextId: 3,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-object', () => {
      expect(validateProjectJSON(null).valid).toBe(false);
      expect(validateProjectJSON('string').valid).toBe(false);
    });

    it('rejects missing nodes array', () => {
      expect(validateProjectJSON({ connections: [] }).valid).toBe(false);
    });

    it('rejects node without id', () => {
      const result = validateProjectJSON({ nodes: [{ x: 0, y: 0, type: 'rect' }] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('rejects node without coordinates', () => {
      const result = validateProjectJSON({ nodes: [{ id: 1, type: 'rect' }] });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid nextId', () => {
      const result = validateProjectJSON({ nodes: [], nextId: -1 });
      expect(result.valid).toBe(false);
    });

    it('allows missing connections', () => {
      const result = validateProjectJSON({ nodes: [] });
      expect(result.valid).toBe(true);
    });
  });

  describe('getContrastColor', () => {
    it('returns white for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1a1a2e')).toBe('#ffffff');
    });

    it('returns dark for light backgrounds', () => {
      expect(getContrastColor('#ffffff')).toBe('#1a1a2e');
      expect(getContrastColor('#fef08a')).toBe('#1a1a2e');
    });

    it('handles invalid input', () => {
      expect(getContrastColor(null)).toBe('#ffffff');
      expect(getContrastColor('')).toBe('#ffffff');
    });
  });

  describe('getGradientCSS', () => {
    it('returns solid color when no gradient', () => {
      expect(getGradientCSS({ color: '#ff0000' })).toBe('#ff0000');
    });

    it('returns gradient when color2 differs', () => {
      const result = getGradientCSS({ color: '#ff0000', color2: '#0000ff', gradAngle: 90 });
      expect(result).toContain('linear-gradient');
      expect(result).toContain('90deg');
    });

    it('returns solid when color2 equals color', () => {
      expect(getGradientCSS({ color: '#ff0000', color2: '#ff0000' })).toBe('#ff0000');
    });
  });

  describe('serializeProject', () => {
    it('produces correct structure', () => {
      const mockState = {
        nodes: [{ id: 1 }],
        connections: [],
        nextId: 2,
        projectTitle: 'Test',
        theme: 'dark',
        connectionStyle: 'bezier',
        gridEnabled: true,
      };
      const result = serializeProject(mockState, 'My Project');
      expect(result.version).toBe(2);
      expect(result.meta.title).toBe('My Project');
      expect(result.meta.theme).toBe('dark');
      expect(result.nodes).toEqual([{ id: 1 }]);
      expect(result.nextId).toBe(2);
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/js/__tests__/utils.test.js`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/js/__tests__/utils.test.js
git commit -m "test: add unit tests for utils.js (esc, safeColor, validation, contrast, gradient)"
```

---

### Task B3: Tests for actions.js (deleteSelected, duplicateSelected)

**Files:**
- Create: `src/js/__tests__/actions.test.js`

**Step 1: Write tests**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { deleteSelected, duplicateSelected } from '../actions.js';

describe('actions.js', () => {
  let renderCalled;

  beforeEach(() => {
    state.nodes = [
      { id: 1, x: 0, y: 0, type: 'rect', label: 'A' },
      { id: 2, x: 100, y: 100, type: 'rect', label: 'B' },
      { id: 3, x: 200, y: 200, type: 'rect', label: 'C' },
    ];
    state.connections = [
      { id: 10, from: 1, to: 2, color: '#fff' },
      { id: 11, from: 2, to: 3, color: '#fff' },
    ];
    state.nextId = 20;
    state.selectedIds = new Set();
    state.undoStack = [];
    state.redoStack = [];
    rebuildIndex();
    renderCalled = false;
  });

  describe('deleteSelected', () => {
    it('removes selected nodes and their connections', () => {
      state.selectedIds.add(2);
      deleteSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(2);
      expect(nodeIndex.has(2)).toBe(false);
      // Both connections involving node 2 should be removed
      expect(state.connections.length).toBe(0);
      expect(renderCalled).toBe(true);
    });

    it('does nothing when nothing selected', () => {
      deleteSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(3);
      expect(renderCalled).toBe(false);
    });

    it('clears selection after delete', () => {
      state.selectedIds.add(1);
      deleteSelected(() => {});
      expect(state.selectedIds.size).toBe(0);
    });

    it('saves undo snapshot before delete', () => {
      state.selectedIds.add(1);
      deleteSelected(() => {});
      expect(state.undoStack.length).toBe(1);
    });
  });

  describe('duplicateSelected', () => {
    it('duplicates selected nodes with offset', () => {
      state.selectedIds.add(1);
      duplicateSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(4);
      const duped = state.nodes[3];
      expect(duped.x).toBe(30); // original 0 + 30
      expect(duped.y).toBe(30);
      expect(duped.label).toBe('A');
      expect(renderCalled).toBe(true);
    });

    it('duplicates internal connections between selected nodes', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(() => {});
      // Original 2 connections + 1 duplicated internal connection
      expect(state.connections.length).toBe(3);
    });

    it('selects only the new duplicates', () => {
      state.selectedIds.add(1);
      duplicateSelected(() => {});
      expect(state.selectedIds.has(1)).toBe(false);
      expect(state.selectedIds.size).toBe(1);
    });

    it('does nothing when nothing selected', () => {
      duplicateSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(3);
      expect(renderCalled).toBe(false);
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/js/__tests__/actions.test.js`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/js/__tests__/actions.test.js
git commit -m "test: add unit tests for actions.js (delete, duplicate with connections)"
```

---

### Task B4: Tests for persistence.js (autoSave, autoLoad, migration)

**Files:**
- Create: `src/js/__tests__/persistence.test.js`

**Step 1: Write tests**

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state, rebuildIndex } from '../state.js';
import { autoSave, autoSaveNow, autoLoad } from '../persistence.js';

describe('persistence.js', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.gridEnabled = true;
    state.groups = [];
    state.hiddenSectors = new Set();
    state.projectTitle = '';
    state.projectKey = null;
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('autoSaveNow', () => {
    it('saves state to localStorage', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      state.nextId = 2;
      autoSaveNow();
      const saved = JSON.parse(localStorage.getItem('network-editor-state'));
      expect(saved.nodes.length).toBe(1);
      expect(saved.nodes[0].x).toBe(10);
      expect(saved.nextId).toBe(2);
    });

    it('uses project-specific key when projectKey set', () => {
      state.projectKey = 'my-project';
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      autoSaveNow();
      expect(localStorage.getItem('network-editor-my-project')).not.toBeNull();
      expect(localStorage.getItem('network-editor-state')).toBeNull();
    });
  });

  describe('autoLoad', () => {
    it('loads saved state from localStorage', () => {
      localStorage.setItem('network-editor-state', JSON.stringify({
        nodes: [{ id: 1, x: 50, y: 60, type: 'sector' }],
        connections: [],
        nextId: 5,
        zoom: 1.5,
        panX: 100,
        panY: 200,
        gridEnabled: false,
        groups: [],
        hiddenSectors: [],
        projectTitle: 'Test',
      }));
      const result = autoLoad();
      expect(result).toBe(true);
      expect(state.nodes.length).toBe(1);
      expect(state.nodes[0].x).toBe(50);
      expect(state.nextId).toBe(5);
      expect(state.zoom).toBe(1.5);
      expect(state.gridEnabled).toBe(false);
      expect(state.projectTitle).toBe('Test');
    });

    it('returns false when no saved data', () => {
      expect(autoLoad()).toBe(false);
    });

    it('returns false for corrupt data', () => {
      localStorage.setItem('network-editor-state', '{"nodes": "not-an-array"}');
      expect(autoLoad()).toBe(false);
    });

    it('rebuilds node index after load', () => {
      localStorage.setItem('network-editor-state', JSON.stringify({
        nodes: [{ id: 7, x: 0, y: 0, type: 'rect' }],
        connections: [],
        nextId: 8,
      }));
      autoLoad();
      expect(state.nodes.length).toBe(1);
      // nodeIndex should be populated
      const { nodeIndex } = await import('../state.js');
      expect(nodeIndex.get(7)).toBeDefined();
    });
  });

  describe('autoSave debounce', () => {
    it('autoSave debounces — multiple calls result in one save', async () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      autoSave();
      autoSave();
      autoSave();
      // Not saved yet (debounced)
      expect(localStorage.getItem('network-editor-state')).toBeNull();
      // Wait for debounce
      await new Promise(r => setTimeout(r, 600));
      expect(localStorage.getItem('network-editor-state')).not.toBeNull();
    });
  });
});
```

**Note:** The `nodeIndex` import test uses dynamic import — if vitest struggles with it, refactor to use the already-imported `rebuildIndex` and check `state.nodes` instead.

**Step 2: Run tests**

Run: `npx vitest run src/js/__tests__/persistence.test.js`
Expected: All tests PASS (the debounce test may need `vi.useFakeTimers()` if timing is flaky)

**Step 3: Commit**

```bash
git add src/js/__tests__/persistence.test.js
git commit -m "test: add unit tests for persistence.js (save, load, migration, debounce)"
```

---

## Phase C: Final verification

### Task C1: Run full test suite + build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 2: Run build**

Run: `node build.js`
Expected: Success

**Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "chore: fix any test adjustments from full suite run"
```

---

## Parallelism Map

```
Phase A (fixes):     A1 ──┐
                     A2 ──┤── all independent, run in parallel
                     A3 ──┤
                     A4 ──┘

Phase B (tests):     B1 ──┐
                     B2 ──┤── depend on A1 (vitest installed), parallel with each other
                     B3 ──┤
                     B4 ──┘

Phase C (verify):    C1 ──── depends on all above
```
