# Force-Directed Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a force-directed physics layout engine that auto-arranges nodes hierarchically (center -> sectors -> companies) with on-demand simulation, node pinning on drag, and a settings toggle.

**Architecture:** New `force-layout.js` module subscribes to event bus. Simulation uses repulsion + spring + hierarchy gravity forces, runs in RAF loop, stops when energy settles. Integrates with existing drag in `interactions.js` (pin on drag), settings in `settings-panel.js` (toggle), and toolbar in `index.html` (re-layout button).

**Tech Stack:** Vanilla JS, no external physics library. Uses existing event bus (`on`/`emit`), `nodeIndex` Map, `domCache` Map.

---

### Task 1: Add `physicsLayout` to state and persistence

**Files:**
- Modify: `src/js/state.js:16-42` (add `physicsLayout` to state object)
- Modify: `src/js/persistence.js:39-51` (save physicsLayout)
- Modify: `src/js/persistence.js:54-76` (load physicsLayout)
- Modify: `src/js/project.js:26-53` (load physicsLayout from project meta)

**Step 1: Add physicsLayout to state**

In `src/js/state.js`, add to the state object after line 37 (`theme: 'dark',`):

```js
physicsLayout: false,    // force-directed auto-layout enabled
```

**Step 2: Save physicsLayout in persistence**

In `src/js/persistence.js` `flushSave()` (line 39-51), add `physicsLayout` to the saved object:

```js
physicsLayout: state.physicsLayout || false,
```

Add after the `projectTitle` line (line 49).

**Step 3: Load physicsLayout in persistence**

In `src/js/persistence.js` `autoLoad()` (around line 70), add:

```js
state.physicsLayout = d.physicsLayout || false;
```

Add after the `state.projectTitle` line.

**Step 4: Load physicsLayout from project meta**

In `src/js/project.js` `loadProject()` (around line 48), add inside the `if (project.meta)` block:

```js
if (project.meta.physicsLayout !== undefined) state.physicsLayout = project.meta.physicsLayout;
```

**Step 5: Verify build**

Run: `node build.js`
Expected: Build succeeds, no errors.

**Step 6: Commit**

```bash
git add src/js/state.js src/js/persistence.js src/js/project.js
git commit -m "feat: add physicsLayout state field with persistence"
```

---

### Task 2: Create `force-layout.js` — core simulation engine

**Files:**
- Create: `src/js/force-layout.js`

**Step 1: Create the force simulation module**

```js
/**
 * @file        force-layout.js
 * @description Force-directed layout engine — repulsion, springs, hierarchy gravity
 * @depends-on  state.js, renderer.js
 * @used-by     main.js, interactions.js
 */
import { state, nodeIndex, on } from './state.js';
import { renderNodes, renderConnections, domCache } from './renderer.js';
import { updateMinimap } from './minimap.js';

// ── Runtime pin state (not persisted) ──
const pinnedNodes = new Set();

// ── Simulation config ──
const CONFIG = {
  repulsion: 800,        // repulsion constant (higher = more spread)
  springStiffness: 0.005, // connection spring strength
  springLength: 180,      // ideal connection rest length
  hierarchyPull: 0.02,   // gravity toward parent
  sectorRadius: 250,     // ideal sector distance from center
  companyRadius: 120,    // ideal company distance from parent sector
  damping: 0.85,         // velocity damping per tick (friction)
  minEnergy: 0.5,        // stop threshold (total kinetic energy)
  maxTicks: 120,         // safety cap
};

// ── Velocity storage ──
const velocities = new Map(); // nodeId -> { vx, vy }

let animFrameId = null;
let running = false;

export function isLayoutRunning() { return running; }
export function isPinned(id) { return pinnedNodes.has(id); }
export function pinNode(id) { pinnedNodes.add(id); }
export function unpinNode(id) { pinnedNodes.delete(id); }
export function clearPins() { pinnedNodes.clear(); }

/**
 * Run the force simulation from current node positions.
 * Resolves when the simulation settles or hits maxTicks.
 */
export function runForceLayout() {
  if (!state.physicsLayout) return;
  if (state.nodes.length < 2) return;

  // Init velocities for all nodes
  velocities.clear();
  for (const n of state.nodes) {
    velocities.set(n.id, { vx: 0, vy: 0 });
  }

  running = true;
  let tick = 0;

  function step() {
    tick++;
    let totalEnergy = 0;

    // ── Calculate forces ──
    const forces = new Map();
    for (const n of state.nodes) {
      forces.set(n.id, { fx: 0, fy: 0 });
    }

    // 1) Repulsion: all pairs
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = CONFIG.repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(a.id).fx -= fx;
        forces.get(a.id).fy -= fy;
        forces.get(b.id).fx += fx;
        forces.get(b.id).fy += fy;
      }
    }

    // 2) Spring attraction: connections
    for (const c of state.connections) {
      const a = nodeIndex.get(c.from);
      const b = nodeIndex.get(c.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const displacement = dist - CONFIG.springLength;
      const force = CONFIG.springStiffness * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces.get(a.id).fx += fx;
      forces.get(a.id).fy += fy;
      forces.get(b.id).fx -= fx;
      forces.get(b.id).fy -= fy;
    }

    // 3) Hierarchy gravity
    const centerNode = state.nodes.find(n => n.type === 'center');
    if (centerNode) {
      for (const n of state.nodes) {
        if (n === centerNode) continue;
        let target = null;
        let idealDist = CONFIG.springLength;

        if (n.type === 'sector') {
          target = centerNode;
          idealDist = CONFIG.sectorRadius;
        } else if (n.type === 'company' && n.parentId != null) {
          target = nodeIndex.get(n.parentId);
          idealDist = CONFIG.companyRadius;
        } else if (n.type === 'company') {
          // Unparented company — find nearest connected sector
          const conn = state.connections.find(c => c.from === n.id || c.to === n.id);
          if (conn) {
            const otherId = conn.from === n.id ? conn.to : conn.from;
            const other = nodeIndex.get(otherId);
            if (other && (other.type === 'sector' || other.type === 'center')) {
              target = other;
              idealDist = CONFIG.companyRadius;
            }
          }
        }

        if (target) {
          const dx = target.x - n.x;
          const dy = target.y - n.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const pull = CONFIG.hierarchyPull * (dist - idealDist);
          forces.get(n.id).fx += (dx / dist) * pull;
          forces.get(n.id).fy += (dy / dist) * pull;
        }
      }
    }

    // ── Apply forces to velocities and positions ──
    for (const n of state.nodes) {
      if (pinnedNodes.has(n.id)) continue;
      if (n.type === 'center' && centerNode) continue; // center stays fixed

      const f = forces.get(n.id);
      const v = velocities.get(n.id);
      v.vx = (v.vx + f.fx) * CONFIG.damping;
      v.vy = (v.vy + f.fy) * CONFIG.damping;
      n.x += v.vx;
      n.y += v.vy;
      totalEnergy += v.vx * v.vx + v.vy * v.vy;
    }

    // ── Render ──
    renderNodes();
    renderConnections();

    // ── Check convergence ──
    if (totalEnergy < CONFIG.minEnergy || tick >= CONFIG.maxTicks) {
      running = false;
      animFrameId = null;
      // Final minimap update
      updateMinimap();
      return;
    }

    animFrameId = requestAnimationFrame(step);
  }

  // Cancel any existing simulation
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(step);
}

export function stopForceLayout() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  running = false;
}

/**
 * Clear pins and re-run the layout from scratch.
 */
export function relayout() {
  clearPins();
  runForceLayout();
}
```

**Step 2: Verify build**

Run: `node build.js`
Expected: Build succeeds (module not yet imported anywhere, just created).

**Step 3: Commit**

```bash
git add src/js/force-layout.js
git commit -m "feat: add force-layout.js simulation engine"
```

---

### Task 3: Integrate force layout into main.js init sequence

**Files:**
- Modify: `src/js/main.js:16-17` (add import)
- Modify: `src/js/main.js:106-158` (wire into init)

**Step 1: Add import**

At the top of `main.js`, after line 36 (`import { initNodePopup } from './node-popup.js';`), add:

```js
import { runForceLayout } from './force-layout.js';
```

**Step 2: Run layout after project load**

In `main.js`, after `fullRender()` on line 153, add:

```js
  // Run force layout if enabled
  if (state.physicsLayout) {
    setTimeout(() => runForceLayout(), 300);
  }
```

Place this before the `zoomFit` setTimeout on line 156. The 300ms delay ensures DOM elements are measured for proper force calculations.

**Step 3: Verify build**

Run: `node build.js`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/js/main.js
git commit -m "feat: wire force layout into init sequence"
```

---

### Task 4: Pin nodes on drag in interactions.js

**Files:**
- Modify: `src/js/interactions.js:16` (add import)
- Modify: `src/js/interactions.js:200-210` (pin on drag start)

**Step 1: Add import**

In `interactions.js`, after the existing imports (around line 27), add:

```js
import { pinNode, isLayoutRunning, runForceLayout } from './force-layout.js';
```

**Step 2: Pin node when drag starts**

In `interactions.js`, inside the drag start block (around line 208, after `saveSnapshot();`), add:

```js
    // Pin dragged nodes in force layout
    state.selectedIds.forEach(id => pinNode(id));
```

**Step 3: Re-run layout when drag ends (if physics enabled)**

In `interactions.js`, find the `onMouseUp` function. After the drag end block where `isDragging = false` is set, add:

```js
    if (state.physicsLayout && !isLayoutRunning()) {
      runForceLayout();
    }
```

**Step 4: Verify build**

Run: `node build.js`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/js/interactions.js
git commit -m "feat: pin nodes on drag, re-run layout after drop"
```

---

### Task 5: Add settings toggle for physics layout

**Files:**
- Modify: `src/js/settings-panel.js:15` (add import)
- Modify: `src/js/settings-panel.js:109-118` (add toggle in Darstellung section)
- Modify: `src/js/settings-panel.js:218-223` (wire toggle event)

**Step 1: Add import**

In `settings-panel.js`, after the existing imports (line 21), add:

```js
import { runForceLayout, stopForceLayout } from './force-layout.js';
```

**Step 2: Add toggle HTML**

In `settings-panel.js`, inside the "Darstellung" settings section (after the theme select, around line 117), add before the closing `</div>`:

```js
      <div class="settings-row">
        <span class="settings-row-label">Auto-Layout</span>
        <button class="toggle-switch ${state.physicsLayout ? 'on' : ''}" id="setting-physics-layout"></button>
      </div>
```

**Step 3: Wire toggle event**

After the theme change event handler (around line 223), add:

```js
  pane.querySelector('#setting-physics-layout').addEventListener('click', (e) => {
    state.physicsLayout = !state.physicsLayout;
    e.currentTarget.classList.toggle('on', state.physicsLayout);
    if (state.physicsLayout) {
      runForceLayout();
    } else {
      stopForceLayout();
    }
    autoSave();
  });
```

**Step 4: Verify build**

Run: `node build.js`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/js/settings-panel.js
git commit -m "feat: add physics layout toggle in settings"
```

---

### Task 6: Add Re-layout toolbar button

**Files:**
- Modify: `src/index.html:73-79` (add button after redo)
- Modify: `src/js/toolbar.js:15` (add import)
- Modify: `src/js/toolbar.js:75` (wire button)

**Step 1: Add button HTML**

In `src/index.html`, after the redo button (line 78-79) and before the separator `<div class="sep"></div>` on line 80, add:

```html
  <button class="tb-btn icon-only" id="relayout-btn" title="Auto-Layout neu berechnen">
    <svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
  </button>
```

This uses a "refresh" icon (two curved arrows) which visually communicates "recalculate layout."

**Step 2: Add import in toolbar.js**

In `toolbar.js`, after the existing imports (around line 23), add:

```js
import { relayout } from './force-layout.js';
```

**Step 3: Wire button**

In `toolbar.js`, after the redo button binding (line 75), add:

```js
  bindButton('relayout-btn', 'click', () => {
    if (state.physicsLayout) relayout();
  });
```

**Step 4: Verify build**

Run: `node build.js`
Expected: Build succeeds.

**Step 5: Manual test**

Open in browser, load a netzwerk project, enable "Auto-Layout" in settings. Click the re-layout button and verify nodes rearrange.

**Step 6: Commit**

```bash
git add src/index.html src/js/toolbar.js
git commit -m "feat: add re-layout toolbar button"
```

---

### Task 7: Re-run layout on structural changes (add/delete node)

**Files:**
- Modify: `src/js/interactions.js` (after node creation blocks)
- Modify: `src/js/actions.js` (after delete)

**Step 1: Read actions.js**

Read `src/js/actions.js` to find the deleteSelected function.

**Step 2: Add layout trigger after node creation**

In `interactions.js`, after each node creation block (sector ~line 228, company ~line 247, sticky ~line 257, shape ~line 268), the code already calls `emit('render')`. After each of these emit calls, add:

```js
      if (state.physicsLayout) setTimeout(() => runForceLayout(), 50);
```

**Step 3: Add layout trigger after deletion**

In `actions.js`, add import at top:

```js
import { runForceLayout } from './force-layout.js';
```

After the delete operation completes (after `emit('render')`), add:

```js
  if (state.physicsLayout) setTimeout(() => runForceLayout(), 50);
```

**Step 4: Verify build**

Run: `node build.js`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/js/interactions.js src/js/actions.js
git commit -m "feat: re-run force layout on add/delete node"
```

---

### Task 8: Integration testing with Playwright

**Files:** None (manual + Playwright MCP testing)

**Step 1: Build**

Run: `node build.js`

**Step 2: Open in browser**

Open `dist/index.html` in browser via Playwright MCP.

**Step 3: Test scenarios**

1. Load a netzwerk project (with center + sectors + companies)
2. Open settings, enable "Auto-Layout" toggle
3. Verify nodes rearrange into a hierarchical layout
4. Drag a node — verify it stays pinned, neighbors adjust
5. Click "Re-layout" button — verify all nodes rearrange
6. Disable "Auto-Layout" — verify nodes stop moving
7. Add a new sector — verify it integrates into layout
8. Delete a node — verify remaining nodes readjust

**Step 4: Tune constants if needed**

If the layout feels too tight or too loose, adjust `CONFIG` values in `force-layout.js`:
- `repulsion`: higher = more spacing
- `sectorRadius`: distance of sectors from center
- `companyRadius`: distance of companies from their sector
- `damping`: lower = faster settling but more oscillation

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: force-directed layout engine — complete"
```
