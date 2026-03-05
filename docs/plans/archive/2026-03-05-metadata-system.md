# Node Metadata System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a flexible `meta` object to every node, with a sidebar Details tab for editing, and relevancy-driven gradient wash visuals.

**Architecture:** Each node gets a `node.meta` plain object (Kumu-style flexible key-value). `meta.relevancy` (1-10) auto-derives `tier` (>5 = "nah", <=5 = "satellit") and drives both opacity and gradient wash intensity. The sidebar gets a 4th "Details" tab for editing metadata. Company nodes with low relevancy get a sector-colored gradient wash CSS treatment.

**Tech Stack:** Vanilla JS ES modules, CSS custom properties, Vitest for tests.

**Design decisions:**
- No separate `tier` toggle — tier is derived from relevancy (`relevancy > 5` = nah, `<= 5` = satellit)
- `effectiveOpacity = node.opacity != null ? node.opacity : (node.meta?.relevancy ?? 10) / 10`
- Gradient wash intensity scales with inverse relevancy (lower relevancy = more wash)
- All meta survives undo/redo automatically (already JSON.stringified via `state.nodes`)

---

## Phase 7: Data Layer (M1-M6)

### Task 1: Add `SUGGESTED_META_FIELDS` to constants.js

**Files:**
- Modify: `src/js/constants.js:39` (append after `MAX_UNDO`)
- Test: `src/js/__tests__/utils.test.js` (existing, will test `getTier` in Task 3)

**Step 1: Add the constant**

Add to end of `src/js/constants.js`:

```js
export const SUGGESTED_META_FIELDS = [
  { key: 'relevancy', label: 'Relevanz',        type: 'range',  min: 1, max: 10, default: 10 },
  { key: 'contact',   label: 'Kontaktperson',   type: 'text',   placeholder: 'Name' },
  { key: 'email',     label: 'E-Mail',          type: 'email',  placeholder: 'name@example.ch' },
  { key: 'phone',     label: 'Telefon',         type: 'tel',    placeholder: '+41 79 ...' },
  { key: 'tags',      label: 'Tags',            type: 'text',   placeholder: 'Praevention, Beratung' },
  { key: 'notes',     label: 'Notizen',         type: 'textarea', placeholder: 'Freitext...' },
  { key: 'website',   label: 'Website',         type: 'url',    placeholder: 'https://...' },
  { key: 'since',     label: 'Seit',            type: 'date',   placeholder: 'YYYY-MM-DD' },
];
```

**Step 2: Commit**

```bash
git add src/js/constants.js
git commit -m "feat(meta): add SUGGESTED_META_FIELDS to constants"
```

---

### Task 2: Add `getTier` and `hexToRgb` helpers to utils.js

**Files:**
- Modify: `src/js/utils.js` (add two functions)
- Test: `src/js/__tests__/utils.test.js` (add tests)

**Step 1: Write failing tests**

Add to `src/js/__tests__/utils.test.js`:

```js
import { getTier, hexToRgb } from '../utils.js';

describe('getTier', () => {
  it('returns "nah" for relevancy > 5', () => {
    expect(getTier({ meta: { relevancy: 8 } })).toBe('nah');
    expect(getTier({ meta: { relevancy: 6 } })).toBe('nah');
  });

  it('returns "satellit" for relevancy <= 5', () => {
    expect(getTier({ meta: { relevancy: 5 } })).toBe('satellit');
    expect(getTier({ meta: { relevancy: 1 } })).toBe('satellit');
  });

  it('returns "nah" for missing meta or relevancy', () => {
    expect(getTier({})).toBe('nah');
    expect(getTier({ meta: {} })).toBe('nah');
    expect(getTier({ meta: { relevancy: undefined } })).toBe('nah');
  });
});

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#6c8aff')).toEqual({ r: 108, g: 138, b: 255 });
  });

  it('parses 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for invalid input', () => {
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/js/__tests__/utils.test.js
```

Expected: FAIL — `getTier` and `hexToRgb` not defined.

**Step 3: Implement**

Add to `src/js/utils.js` (before `serializeProject`):

```js
/** Derive tier from relevancy: > 5 = "nah", <= 5 = "satellit" */
export function getTier(node) {
  const r = node.meta?.relevancy;
  if (r == null) return 'nah';
  return r > 5 ? 'nah' : 'satellit';
}

/** Parse hex color to {r, g, b}. Returns null on invalid input. */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
```

**Step 4: Run tests — expect PASS**

```bash
npx vitest run src/js/__tests__/utils.test.js
```

**Step 5: Commit**

```bash
git add src/js/utils.js src/js/__tests__/utils.test.js
git commit -m "feat(meta): add getTier and hexToRgb helpers with tests"
```

---

### Task 3: Serialize meta in JSON export

**Files:**
- Modify: `src/js/utils.js:151-164` (`serializeProject`)
- Test: `src/js/__tests__/utils.test.js` (add test)

**Step 1: Write failing test**

Add to `utils.test.js` in the existing `serializeProject` describe block (or create one):

```js
describe('serializeProject', () => {
  it('preserves node.meta in serialized output', () => {
    const mockState = {
      nodes: [{ id: 1, x: 0, y: 0, type: 'company', label: 'Test', meta: { relevancy: 7, contact: 'Max' } }],
      connections: [],
      nextId: 2,
      projectTitle: 'Test',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
    };
    const result = serializeProject(mockState, 'Test');
    expect(result.nodes[0].meta).toEqual({ relevancy: 7, contact: 'Max' });
  });

  it('handles nodes without meta', () => {
    const mockState = {
      nodes: [{ id: 1, x: 0, y: 0, type: 'rect' }],
      connections: [],
      nextId: 2,
      projectTitle: '',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
    };
    const result = serializeProject(mockState, '');
    expect(result.nodes[0].meta).toBeUndefined();
  });
});
```

**Step 2: Run test — should PASS already**

`serializeProject` already includes `state.nodes` directly, which preserves any `meta` property. Run:

```bash
npx vitest run src/js/__tests__/utils.test.js
```

If it passes: `serializeProject` already works — `meta` is just a property on node objects in `state.nodes`. No code changes needed.

**Step 3: Commit (tests only)**

```bash
git add src/js/__tests__/utils.test.js
git commit -m "test(meta): verify serializeProject preserves node.meta"
```

---

### Task 4: Backward-compatible meta loading in persistence.js and project.js

**Files:**
- Modify: `src/js/persistence.js` — no changes needed (already loads `state.nodes` as-is)
- Modify: `src/js/project.js` — no changes needed (already loads `project.nodes` as-is)
- Test: `src/js/__tests__/persistence.test.js` (add backward-compat test)

**Step 1: Write test to verify backward compatibility**

Add to `src/js/__tests__/persistence.test.js`:

```js
it('loads nodes with meta from localStorage', () => {
  const data = {
    nodes: [{ id: 1, x: 0, y: 0, type: 'company', meta: { relevancy: 8, contact: 'Test' } }],
    connections: [],
    nextId: 2,
  };
  localStorage.setItem('network-editor-state', JSON.stringify(data));
  const result = autoLoad();
  expect(result).toBe(true);
  expect(state.nodes[0].meta).toEqual({ relevancy: 8, contact: 'Test' });
});

it('loads old projects without meta gracefully', () => {
  const data = {
    nodes: [{ id: 1, x: 0, y: 0, type: 'company' }],
    connections: [],
    nextId: 2,
  };
  localStorage.setItem('network-editor-state', JSON.stringify(data));
  const result = autoLoad();
  expect(result).toBe(true);
  expect(state.nodes[0].meta).toBeUndefined();
});
```

**Step 2: Run tests — expect PASS (no code changes needed)**

```bash
npx vitest run src/js/__tests__/persistence.test.js
```

The persistence layer already stores/loads `state.nodes` as-is, so `meta` survives round-trip automatically.

**Step 3: Commit**

```bash
git add src/js/__tests__/persistence.test.js
git commit -m "test(meta): verify backward-compatible meta loading"
```

---

### Task 5: Undo/redo preserves meta

**Files:**
- Test: `src/js/__tests__/state.test.js` (add test)

**Step 1: Write test**

Add to `state.test.js` in the `undo/redo` describe block:

```js
it('preserves node.meta through undo/redo', () => {
  state.nodes = [{ id: 1, x: 0, y: 0, type: 'company', meta: { relevancy: 8 } }];
  rebuildIndex();
  saveSnapshot();
  state.nodes[0].meta.relevancy = 3;
  undo();
  expect(state.nodes[0].meta.relevancy).toBe(8);
  redo();
  expect(state.nodes[0].meta.relevancy).toBe(3);
});
```

**Step 2: Run test — expect PASS**

```bash
npx vitest run src/js/__tests__/state.test.js
```

`createSnapshot` uses `JSON.stringify(state.nodes)` which deep-clones meta. Should pass without changes.

**Step 3: Commit**

```bash
git add src/js/__tests__/state.test.js
git commit -m "test(meta): verify undo/redo preserves node.meta"
```

---

### Task 6: Relevancy-to-opacity in renderer.js

**Files:**
- Modify: `src/js/renderer.js:59` (opacity line in `createNodeElement`)

**Step 1: Update opacity logic**

Change line 59 in `createNodeElement`:

```js
// BEFORE:
if (n.opacity != null && n.opacity !== 1) el.style.opacity = n.opacity;

// AFTER:
const effectiveOpacity = n.opacity != null ? n.opacity : (n.meta?.relevancy ?? 10) / 10;
if (effectiveOpacity !== 1) el.style.opacity = effectiveOpacity;
```

**Step 2: Add data-tier attribute for company nodes**

In the `company` type block (after line 81 where className is set), add:

```js
// After the className assignment for company nodes with parentId:
if (n.parentId != null) {
  el.className = 'node node-company node-company--text' + (n.underlined ? ' underlined' : '');
} else {
  // ... existing code
}

// Add data-tier for all company nodes (after the if/else block, before the label section):
if (n.type === 'company') {
  const { getTier } = await import('./utils.js');  // NO — utils.js is already imported
}
```

Actually, since `getTier` needs to be imported, and we want to avoid async imports, add the import at the top and use it inline:

At the top of renderer.js, update the import:
```js
import { getContrastColor, getGradientCSS, esc, getTier } from './utils.js';
```

Then after the node type switch (after line 119, before the Label section), add:

```js
// Data attributes for metadata-driven visuals
if (n.type === 'company') {
  el.dataset.tier = getTier(n);
}
```

**Step 3: Build and verify**

```bash
node build.js
```

**Step 4: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(meta): relevancy-to-opacity mapping and data-tier attribute"
```

---

## Phase 7B: Sidebar Details Tab (D1-D8)

### Task 7: Add Details tab HTML to index.html

**Files:**
- Modify: `src/index.html:206-216` (sidebar section)

**Step 1: Add the 4th tab button and pane**

Update the sidebar section:

```html
<!-- SIDEBAR -->
<div id="sidebar">
  <div class="sidebar-tabs">
    <button class="sidebar-tab active" data-tab="connections">Verbindungen</button>
    <button class="sidebar-tab" data-tab="groups">Gruppen</button>
    <button class="sidebar-tab" data-tab="details">Details</button>
    <button class="sidebar-tab" data-tab="settings">Einstellungen</button>
  </div>
  <div class="sidebar-content">
    <div class="tab-pane active" data-tab="connections"></div>
    <div class="tab-pane" data-tab="groups"></div>
    <div class="tab-pane" data-tab="details"></div>
    <div class="tab-pane" data-tab="settings"></div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/index.html
git commit -m "feat(meta): add Details tab to sidebar HTML"
```

---

### Task 8: Render Details tab in sidebar.js

**Files:**
- Modify: `src/js/sidebar.js` (add `renderDetailsTab` function, update `refreshSidebar`)

**Step 1: Update imports**

Add to the imports at top of sidebar.js:

```js
import { SUGGESTED_META_FIELDS } from './constants.js';
import { getTier } from './utils.js';
```

**Step 2: Update `refreshSidebar`**

In `refreshSidebar()` (around line 62), add the details tab case:

```js
export function refreshSidebar() {
  if (!document.body.classList.contains('sidebar-open')) return;
  if (activeTab === 'connections') renderConnectionsTab();
  else if (activeTab === 'groups') renderGroupsTab();
  else if (activeTab === 'details') renderDetailsTab();
  else if (activeTab === 'settings') renderSettingsTab(contentEl, refreshSidebar);
}
```

**Step 3: Implement `renderDetailsTab`**

Add the following function to sidebar.js:

```js
// ─── Details Tab ───
function renderDetailsTab() {
  const pane = contentEl.querySelector('[data-tab="details"]');
  const selectedNodes = [...state.selectedIds].map(id => nodeIndex.get(id)).filter(Boolean);

  // Empty state
  if (selectedNodes.length === 0) {
    pane.innerHTML = '<div class="conn-empty">Kein Element ausgewaehlt</div>';
    return;
  }

  // Multi-select: batch controls
  if (selectedNodes.length > 1) {
    renderBatchDetails(pane, selectedNodes);
    return;
  }

  // Single node
  const node = selectedNodes[0];
  if (!node.meta) node.meta = {};
  const meta = node.meta;
  const tier = getTier(node);

  let html = '';

  // Node label (read-only display)
  html += `<div class="details-header">${esc(node.label || 'Ohne Titel')}</div>`;

  // Tier display (derived from relevancy)
  html += `<div class="details-tier">
    <span class="details-tier-badge details-tier-badge--${tier}">${tier === 'nah' ? 'Nah' : 'Satellit'}</span>
    <span class="details-tier-hint">wird aus Relevanz abgeleitet</span>
  </div>`;

  // Relevancy slider
  const relevancy = meta.relevancy ?? 10;
  html += `<div class="details-field">
    <label class="details-label">Relevanz: <span class="details-value" id="details-relevancy-val">${relevancy}</span></label>
    <input type="range" id="details-relevancy" class="settings-range" min="1" max="10" value="${relevancy}">
  </div>`;

  // Predefined fields (skip relevancy — already rendered as slider)
  for (const field of SUGGESTED_META_FIELDS) {
    if (field.key === 'relevancy') continue;
    const val = meta[field.key] ?? '';
    if (field.type === 'textarea') {
      html += `<div class="details-field">
        <label class="details-label">${esc(field.label)}</label>
        <textarea class="details-textarea" data-meta-key="${field.key}" placeholder="${esc(field.placeholder || '')}">${esc(val)}</textarea>
      </div>`;
    } else {
      html += `<div class="details-field">
        <label class="details-label">${esc(field.label)}</label>
        <input class="details-input" type="${field.type}" data-meta-key="${field.key}" value="${esc(val)}" placeholder="${esc(field.placeholder || '')}">
      </div>`;
    }
  }

  // Custom fields
  const predefinedKeys = new Set(SUGGESTED_META_FIELDS.map(f => f.key));
  const customKeys = Object.keys(meta).filter(k => !predefinedKeys.has(k));

  html += `<div class="details-section-title">Eigene Felder</div>`;
  for (const key of customKeys) {
    html += `<div class="details-custom-row">
      <span class="details-custom-key">${esc(key)}</span>
      <input class="details-input details-custom-val" data-custom-key="${key}" value="${esc(meta[key] ?? '')}">
      <button class="details-custom-delete" data-delete-key="${key}" title="Entfernen">&times;</button>
    </div>`;
  }

  html += `<div class="details-add-row">
    <input class="details-input details-add-key" id="details-new-key" placeholder="Schluessel">
    <input class="details-input details-add-val" id="details-new-val" placeholder="Wert">
    <button class="details-add-btn" id="details-add-field">${iconPlus}</button>
  </div>`;

  pane.innerHTML = html;
  wireDetailsEvents(pane, node);
}

function renderBatchDetails(pane, nodes) {
  const count = nodes.length;
  let html = `<div class="details-header">${count} Elemente ausgewaehlt</div>`;

  // Batch relevancy
  html += `<div class="details-field">
    <label class="details-label">Relevanz fuer alle: <span class="details-value" id="details-batch-relevancy-val">—</span></label>
    <input type="range" id="details-batch-relevancy" class="settings-range" min="1" max="10" value="5">
  </div>`;
  html += `<button class="group-add-btn" id="details-batch-apply">Auf alle anwenden</button>`;

  pane.innerHTML = html;

  // Wire batch events
  const slider = pane.querySelector('#details-batch-relevancy');
  const valSpan = pane.querySelector('#details-batch-relevancy-val');
  slider.addEventListener('input', () => { valSpan.textContent = slider.value; });

  pane.querySelector('#details-batch-apply').addEventListener('click', () => {
    saveSnapshot();
    const val = parseInt(slider.value, 10);
    for (const node of nodes) {
      if (!node.meta) node.meta = {};
      node.meta.relevancy = val;
    }
    emit('render');
    autoSave();
  });
}

function wireDetailsEvents(pane, node) {
  // Relevancy slider
  const slider = pane.querySelector('#details-relevancy');
  const valSpan = pane.querySelector('#details-relevancy-val');
  if (slider) {
    slider.addEventListener('input', () => {
      valSpan.textContent = slider.value;
      // Live preview: update opacity without snapshot
      node.meta.relevancy = parseInt(slider.value, 10);
      emit('render');
    });
    slider.addEventListener('change', () => {
      saveSnapshot();
      node.meta.relevancy = parseInt(slider.value, 10);
      emit('render');
      autoSave();
    });
  }

  // Predefined text/email/tel/url/date fields
  pane.querySelectorAll('[data-meta-key]').forEach(input => {
    const key = input.dataset.metaKey;
    input.addEventListener('change', () => {
      saveSnapshot();
      const val = input.value.trim();
      if (val) {
        node.meta[key] = val;
      } else {
        delete node.meta[key];
      }
      autoSave();
      // Re-render to update tier badge if relevancy changed
      refreshSidebar();
    });
  });

  // Custom field value edits
  pane.querySelectorAll('[data-custom-key]').forEach(input => {
    input.addEventListener('change', () => {
      saveSnapshot();
      node.meta[input.dataset.customKey] = input.value;
      autoSave();
    });
  });

  // Delete custom field
  pane.querySelectorAll('[data-delete-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveSnapshot();
      delete node.meta[btn.dataset.deleteKey];
      autoSave();
      renderDetailsTab();
    });
  });

  // Add new custom field
  const addBtn = pane.querySelector('#details-add-field');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const keyInput = pane.querySelector('#details-new-key');
      const valInput = pane.querySelector('#details-new-val');
      const key = keyInput.value.trim();
      const val = valInput.value.trim();
      if (!key) return;
      saveSnapshot();
      node.meta[key] = val;
      autoSave();
      renderDetailsTab();
    });
  }
}
```

**Step 4: Build and test visually**

```bash
node build.js
```

Open in browser, select a node, open sidebar, click "Details" tab.

**Step 5: Commit**

```bash
git add src/js/sidebar.js
git commit -m "feat(meta): Details tab with relevancy slider, contact fields, custom fields"
```

---

### Task 9: Details tab CSS

**Files:**
- Modify: `src/styles/sidebar.css` (append new styles)

**Step 1: Add Details tab styles**

Append to `src/styles/sidebar.css`:

```css
/* ── Details Tab ── */
.details-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  word-break: break-word;
}

.details-tier {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.details-tier-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
}
.details-tier-badge--nah {
  background: rgba(92, 219, 149, 0.15);
  color: #5cdb95;
}
.details-tier-badge--satellit {
  background: rgba(255, 209, 102, 0.15);
  color: #ffd166;
}

.details-tier-hint {
  font-size: 9px;
  color: var(--text-dim);
  font-style: italic;
}

.details-field {
  margin-bottom: 10px;
}

.details-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.details-value {
  font-family: var(--font-mono);
  color: var(--accent);
}

.details-input, .details-textarea {
  width: 100%;
  padding: 6px 8px;
  font-size: 11px;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
  box-sizing: border-box;
}
.details-input:focus, .details-textarea:focus {
  border-color: var(--accent);
}

.details-textarea {
  min-height: 60px;
  resize: vertical;
  line-height: 1.5;
}

.details-section-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin: 16px 0 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.details-custom-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.details-custom-key {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.details-custom-val {
  flex: 1;
}

.details-custom-delete {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0.5;
}
.details-custom-delete:hover { opacity: 1; }

.details-add-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.details-add-row .details-add-key { flex: 1; }
.details-add-row .details-add-val { flex: 1; }

.details-add-btn {
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
}
.details-add-btn:hover { border-color: var(--accent-border); color: var(--accent); }
.details-add-btn svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }
```

**Step 2: Build and verify**

```bash
node build.js
```

**Step 3: Commit**

```bash
git add src/styles/sidebar.css
git commit -m "feat(meta): Details tab CSS styles"
```

---

## Phase 7C: Gradient Wash Visuals

### Task 10: Satellite CSS class in nodes.css

**Files:**
- Modify: `src/styles/nodes.css` (append after `.node-company--text` styles)

**Step 1: Add satellite styles**

Append after the `.node-company--text` section (after line 119):

```css
/* Company: satellite variant (low relevancy) */
.node-company--satellite {
  position: relative;
}
.node-company--satellite::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(var(--sector-rgb, 108,138,255), 0.15) 0%,
    rgba(var(--sector-rgb, 108,138,255), 0.04) 100%
  );
  pointer-events: none;
  z-index: 0;
}
.node-company--satellite .node-label {
  opacity: 0.75;
  position: relative;
  z-index: 1;
}
.node-company--satellite .color-dot {
  position: relative;
  z-index: 1;
}

/* Text-variant satellite */
.node-company--text.node-company--satellite {
  color: var(--text-muted);
}
.node-company--text.node-company--satellite .node-label {
  opacity: 0.65;
  font-size: 10px;
}

/* Dark theme: slightly more visible wash */
[data-theme="dark"] .node-company--satellite::before {
  background: linear-gradient(
    135deg,
    rgba(var(--sector-rgb, 108,138,255), 0.20) 0%,
    rgba(var(--sector-rgb, 108,138,255), 0.06) 100%
  );
}
```

**Step 2: Commit**

```bash
git add src/styles/nodes.css
git commit -m "feat(meta): satellite gradient wash CSS"
```

---

### Task 11: Apply satellite class and sector color in renderer.js

**Files:**
- Modify: `src/js/renderer.js` (update company node rendering + import)

**Step 1: Update import**

Update the import at top of renderer.js:

```js
import { getContrastColor, getGradientCSS, esc, getTier, hexToRgb } from './utils.js';
```

**Step 2: Apply satellite class and `--sector-rgb` CSS variable**

In `createNodeElement`, after the existing data-tier line added in Task 6, update the company block to also apply the satellite class and sector color:

```js
// Data attributes and satellite visual for company nodes
if (n.type === 'company') {
  const tier = getTier(n);
  el.dataset.tier = tier;
  if (tier === 'satellit') {
    el.classList.add('node-company--satellite');
    // Find parent sector color for gradient wash
    const parent = n.parentId != null ? nodeIndex.get(n.parentId) : null;
    if (parent?.color) {
      const rgb = hexToRgb(parent.color);
      if (rgb) el.style.setProperty('--sector-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
    }
  }
}
```

**Step 3: Build and test visually**

```bash
node build.js
```

Open in browser. Select a company node, open Details tab, set relevancy to 3. The node should get a gradient wash in its parent sector's color.

**Step 4: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(meta): apply satellite class with sector-colored gradient wash"
```

---

### Task 12: Final build + integration test

**Files:** None (verification only)

**Step 1: Run all unit tests**

```bash
npx vitest run
```

All tests should pass.

**Step 2: Build**

```bash
node build.js
```

Should complete without errors.

**Step 3: Visual verification in browser**

Open `dist/index.html` or the dev version. Test:

1. Select a company node → sidebar Details tab shows metadata fields
2. Move relevancy slider → node opacity changes in real-time
3. Relevancy <= 5 → tier badge shows "Satellit", node gets gradient wash
4. Relevancy > 5 → tier badge shows "Nah", normal appearance
5. Fill in contact/email/phone fields → persist after deselect/reselect
6. Add a custom field → appears in details tab
7. Delete a custom field → removed
8. Undo (Ctrl+Z) → reverts metadata change
9. Multi-select 3+ nodes → batch relevancy slider appears
10. Save/reload → metadata persists in localStorage
11. Export JSON → meta fields present in file
12. Import old JSON (no meta) → loads without errors

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: node metadata system with Details tab and gradient wash

- Phase 7: meta object on nodes, SUGGESTED_META_FIELDS, getTier/hexToRgb helpers
- Phase 7B: Details sidebar tab with relevancy slider, contact fields, custom fields
- Phase 7C: Satellite gradient wash driven by relevancy
- Relevancy (1-10) auto-derives tier and opacity
- Backward-compatible with existing projects"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | SUGGESTED_META_FIELDS constant | constants.js | 2 min |
| 2 | getTier + hexToRgb helpers + tests | utils.js, tests | 5 min |
| 3 | Verify serializeProject preserves meta | tests | 3 min |
| 4 | Verify backward-compat loading | tests | 3 min |
| 5 | Verify undo/redo preserves meta | tests | 2 min |
| 6 | Relevancy→opacity + data-tier in renderer | renderer.js | 5 min |
| 7 | Details tab HTML | index.html | 2 min |
| 8 | Details tab rendering + events | sidebar.js | 15 min |
| 9 | Details tab CSS | sidebar.css | 5 min |
| 10 | Satellite gradient wash CSS | nodes.css | 5 min |
| 11 | Apply satellite class in renderer | renderer.js | 5 min |
| 12 | Final build + integration test | — | 5 min |
