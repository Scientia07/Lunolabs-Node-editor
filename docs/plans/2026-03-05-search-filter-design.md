# Phase 10: Search & Filter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Suche" sidebar tab with fuzzy search across node labels and metadata, canvas highlighting/dimming, and click-to-navigate.

**Architecture:** New `search.js` module owns fuzzy matching and results rendering. State gets `searchQuery` + `searchMatches`. Renderer applies `.search-dimmed`/`.search-highlight` CSS classes during `renderNodes()`. Keyboard wires Ctrl+K to focus.

**Tech Stack:** Vanilla JS ES modules, CSS classes, Vitest for tests

---

### Task 1: Fuzzy match function + tests

**Files:**
- Create: `src/js/search.js`
- Create: `src/js/__tests__/search.test.js`

**Step 1: Write the failing tests**

```js
// src/js/__tests__/search.test.js
import { describe, it, expect } from 'vitest';
import { fuzzyMatch, searchNodes } from '../search.js';

describe('fuzzyMatch', () => {
  it('matches exact substring', () => {
    const r = fuzzyMatch('Jugend', 'Jugendarbeit');
    expect(r).not.toBeNull();
    expect(r.score).toBeGreaterThan(0);
  });

  it('matches characters in order (fuzzy)', () => {
    const r = fuzzyMatch('jgb', 'Jugendbuero');
    expect(r).not.toBeNull();
  });

  it('is case-insensitive', () => {
    const r = fuzzyMatch('JUGEND', 'jugendarbeit');
    expect(r).not.toBeNull();
  });

  it('returns null on no match', () => {
    expect(fuzzyMatch('xyz', 'Jugendarbeit')).toBeNull();
  });

  it('returns matched indices', () => {
    const r = fuzzyMatch('jb', 'Jugendbuero');
    expect(r.indices).toContain(0); // J
    expect(r.indices.length).toBe(2);
  });

  it('scores consecutive matches higher', () => {
    const consecutive = fuzzyMatch('Jug', 'Jugendarbeit');
    const scattered = fuzzyMatch('Jbt', 'Jugendarbeit');
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });
});

describe('searchNodes', () => {
  const nodes = [
    { id: 1, label: 'Jugendarbeit', type: 'sector', meta: {} },
    { id: 2, label: 'Pro Juventute', type: 'company', meta: { contact: 'Maria Mueller', tags: 'Prevention' } },
    { id: 3, label: 'Sportverein', type: 'company', meta: { notes: 'Jugendgruppe vorhanden' } },
    { id: 4, label: 'Gemeinde', type: 'sector', meta: {} },
  ];

  it('matches on label', () => {
    const results = searchNodes('jugend', nodes);
    expect(results.map(r => r.node.id)).toContain(1);
  });

  it('matches on meta.contact', () => {
    const results = searchNodes('maria', nodes);
    expect(results.map(r => r.node.id)).toContain(2);
  });

  it('matches on meta.tags', () => {
    const results = searchNodes('prevention', nodes);
    expect(results.map(r => r.node.id)).toContain(2);
  });

  it('matches on meta.notes', () => {
    const results = searchNodes('jugendgruppe', nodes);
    expect(results.map(r => r.node.id)).toContain(3);
  });

  it('returns results sorted by score descending', () => {
    const results = searchNodes('jugend', nodes);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty array for empty query', () => {
    expect(searchNodes('', nodes)).toEqual([]);
  });

  it('searches custom meta fields', () => {
    const nodesWithCustom = [
      { id: 5, label: 'Test', type: 'company', meta: { customField: 'UniqueValue123' } },
    ];
    const results = searchNodes('unique', nodesWithCustom);
    expect(results.map(r => r.node.id)).toContain(5);
  });
});
```

**Step 2: Write minimal implementation**

```js
// src/js/search.js
/**
 * @file        search.js
 * @description Search & filter — fuzzy matching, results rendering, sidebar tab
 * @version     1.0
 * @date        2026-03-05
 * @depends-on  state.js, renderer.js, utils.js
 * @used-by     main.js, keyboard.js, sidebar.js
 */

/**
 * Lightweight fuzzy match — characters matched in order.
 * Returns { score, indices } or null if no match.
 */
export function fuzzyMatch(query, text) {
  if (!query || !text) return null;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices = [];
  let qi = 0;
  let score = 0;
  let lastIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      // Bonus for consecutive matches
      score += (lastIdx === ti - 1) ? 2 : 1;
      // Bonus for matching at word start
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 1;
      lastIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return null; // not all chars matched
  return { score, indices };
}

/**
 * Search nodes by label + all meta fields.
 * Returns [{ node, score, field, indices }] sorted by score desc.
 */
export function searchNodes(query, nodes) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const results = [];

  for (const node of nodes) {
    let bestMatch = null;

    // Search label (highest priority — bonus score)
    const labelMatch = fuzzyMatch(q, node.label || '');
    if (labelMatch) {
      bestMatch = { node, score: labelMatch.score + 5, field: 'label', indices: labelMatch.indices };
    }

    // Search all meta fields
    if (node.meta) {
      for (const [key, val] of Object.entries(node.meta)) {
        if (typeof val !== 'string') continue;
        const m = fuzzyMatch(q, val);
        if (m && (!bestMatch || m.score > bestMatch.score - 5)) {
          const candidate = { node, score: m.score, field: key, indices: m.indices };
          if (!bestMatch || candidate.score > bestMatch.score) {
            bestMatch = candidate;
          }
        }
      }
    }

    if (bestMatch) results.push(bestMatch);
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
```

**Step 3: Run tests to verify**

Run: `npx vitest run src/js/__tests__/search.test.js`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/js/search.js src/js/__tests__/search.test.js
git commit -m "feat(search): fuzzy match function + unit tests (Phase 10, Task 1)"
```

---

### Task 2: State integration + search CSS classes

**Files:**
- Modify: `src/js/state.js:16-43` (add searchQuery, searchMatches to state)
- Modify: `src/js/renderer.js:37-46` (apply search CSS classes in renderNodes)
- Modify: `src/styles/nodes.css` (add .search-dimmed, .search-highlight)

**Step 1: Add search state fields**

In `src/js/state.js`, add to the state object (after `projectTitle: ''`):

```js
  // Search
  searchQuery: '',
  searchMatches: null,        // Set<nodeId> or null when search inactive
```

**Step 2: Apply search classes in renderer**

In `src/js/renderer.js`, inside `renderNodes()` after `if (state.selectedIds.has(n.id)) el.classList.add('selected');` (line 155), add:

```js
    // Search highlight/dim
    if (state.searchMatches) {
      if (state.searchMatches.has(n.id)) {
        el.classList.add('search-highlight');
      } else {
        el.classList.add('search-dimmed');
      }
    }
```

**Step 3: Add CSS classes**

Append to `src/styles/nodes.css`:

```css
/* ── Search highlight / dim ── */
.node.search-dimmed {
  opacity: 0.15 !important;
  pointer-events: none;
  transition: opacity 0.2s;
}
.node.search-highlight {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  box-shadow: 0 0 16px rgba(108, 138, 255, 0.35);
}
.node.search-highlight.selected {
  outline-width: 3px;
}
```

**Step 4: Commit**

```bash
git add src/js/state.js src/js/renderer.js src/styles/nodes.css
git commit -m "feat(search): state fields + renderer CSS classes for search dim/highlight (Task 2)"
```

---

### Task 3: Sidebar tab HTML + CSS

**Files:**
- Modify: `src/index.html:225-236` (add Suche tab button + pane)
- Modify: `src/styles/sidebar.css` (add search styles)

**Step 1: Add Suche tab to HTML**

In `src/index.html`, add the tab button before the settings tab button (line 229):

```html
    <button class="sidebar-tab" data-tab="search" role="tab" aria-selected="false" aria-controls="tab-search">Suche</button>
```

And add the tab pane before the settings pane (line 235):

```html
    <div class="tab-pane" data-tab="search" id="tab-search" role="tabpanel"></div>
```

**Step 2: Add search tab CSS**

Append to `src/styles/sidebar.css`:

```css
/* ── Search Tab ── */
.search-input-wrap {
  position: relative;
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  padding: 8px 10px 8px 32px;
  font-size: 12px;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
  box-sizing: border-box;
}
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: var(--text-dim); }
.search-input-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  stroke: var(--text-dim);
  fill: none;
  stroke-width: 2;
  pointer-events: none;
}

.search-count {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.search-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.search-result:hover,
.search-result.active { background: var(--accent-dim); }
.search-result.active { outline: 1px solid var(--accent-border); }

.search-result-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.search-result-label {
  flex: 1;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-result-label mark {
  background: none;
  color: var(--accent);
  font-weight: 600;
}
.search-result-type {
  font-size: 9px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.search-result-field {
  font-size: 9px;
  color: var(--text-dim);
  font-style: italic;
  margin-top: 1px;
}
```

**Step 3: Commit**

```bash
git add src/index.html src/styles/sidebar.css
git commit -m "feat(search): Suche sidebar tab HTML + CSS styles (Task 3)"
```

---

### Task 4: Search tab rendering + sidebar wiring

**Files:**
- Modify: `src/js/search.js` (add initSearch, renderSearchTab, clearSearch, navigateToNode)
- Modify: `src/js/sidebar.js:61-67` (add search tab to refreshSidebar)
- Modify: `src/js/main.js:35,132` (import and init search)

**Step 1: Add UI rendering to search.js**

Add to `src/js/search.js` after the existing `searchNodes` function:

```js
import { state, nodeIndex, emit } from './state.js';
import { domCache } from './renderer.js';
import { esc, safeColor } from './utils.js';
import { updateTransform } from './transform.js';

let searchInput, resultsContainer, activeIndex = -1;

export function initSearch() {
  // Listen for render events to refresh search visuals
  document.addEventListener('editor:render', () => {
    if (state.searchQuery) applySearch(state.searchQuery);
  });
}

export function renderSearchTab(contentEl) {
  const pane = contentEl.querySelector('[data-tab="search"]');
  if (!pane) return;

  // Only rebuild structure if needed
  if (!pane.querySelector('.search-input')) {
    pane.innerHTML = `
      <div class="search-input-wrap">
        <svg class="search-input-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="search-input" id="search-input" placeholder="Suchen... (Ctrl+K)" autocomplete="off">
      </div>
      <div class="search-count" id="search-count"></div>
      <div class="search-results" id="search-results"></div>`;

    searchInput = pane.querySelector('#search-input');
    resultsContainer = pane.querySelector('#search-results');

    searchInput.addEventListener('input', () => {
      applySearch(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      const items = resultsContainer.querySelectorAll('.search-result');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActiveResult(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveResult(items);
      } else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else if (e.key === 'Escape') {
        clearSearch();
      }
    });
  } else {
    searchInput = pane.querySelector('#search-input');
    resultsContainer = pane.querySelector('#search-results');
  }

  // Restore current query
  if (state.searchQuery && searchInput.value !== state.searchQuery) {
    searchInput.value = state.searchQuery;
  }
  if (state.searchQuery) renderResults(searchNodes(state.searchQuery, state.nodes));
}

function applySearch(query) {
  state.searchQuery = query.trim();
  if (!state.searchQuery) {
    state.searchMatches = null;
    activeIndex = -1;
    if (resultsContainer) resultsContainer.innerHTML = '';
    const countEl = document.getElementById('search-count');
    if (countEl) countEl.textContent = '';
    emit('render');
    return;
  }

  const results = searchNodes(state.searchQuery, state.nodes);
  state.searchMatches = new Set(results.map(r => r.node.id));
  renderResults(results);
  emit('render');
}

function renderResults(results) {
  if (!resultsContainer) return;
  const countEl = document.getElementById('search-count');
  if (countEl) {
    countEl.textContent = results.length
      ? `${results.length} Treffer`
      : (state.searchQuery ? 'Keine Treffer' : '');
  }

  resultsContainer.innerHTML = results.map((r, i) => {
    const n = r.node;
    const color = n.color || (n.parentId != null ? (nodeIndex.get(n.parentId)?.color || '#6c8aff') : '#6c8aff');
    const highlighted = highlightLabel(n.label || '', r.field === 'label' ? r.indices : []);
    const typeLabel = n.type === 'company' ? 'Eintrag' : n.type === 'sector' ? 'Sektor' : n.type;
    const fieldHint = r.field !== 'label' ? `<div class="search-result-field">in ${esc(r.field)}</div>` : '';

    return `<div class="search-result${i === activeIndex ? ' active' : ''}" data-node-id="${n.id}">
      <span class="search-result-color" style="background:${safeColor(color)}"></span>
      <span class="search-result-label">${highlighted}${fieldHint}</span>
      <span class="search-result-type">${typeLabel}</span>
    </div>`;
  }).join('');

  // Wire click handlers
  resultsContainer.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      const nid = parseInt(el.dataset.nodeId, 10);
      navigateToNode(nid);
    });
  });
}

function highlightLabel(label, indices) {
  if (!indices.length) return esc(label);
  const idxSet = new Set(indices);
  let html = '';
  for (let i = 0; i < label.length; i++) {
    const c = esc(label[i]);
    html += idxSet.has(i) ? `<mark>${c}</mark>` : c;
  }
  return html;
}

function updateActiveResult(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
}

function navigateToNode(nodeId) {
  const node = nodeIndex.get(nodeId);
  if (!node) return;
  const el = domCache.get(nodeId);
  const w = el ? el.offsetWidth : 120;
  const h = el ? el.offsetHeight : 60;

  // Select the node
  state.selectedIds.clear();
  state.selectedIds.add(nodeId);

  // Pan to center the node on screen
  const sidebarW = document.body.classList.contains('sidebar-open') ? 280 : 0;
  const vw = window.innerWidth - sidebarW;
  const vh = window.innerHeight;
  const targetZoom = Math.max(state.zoom, 1); // don't zoom out
  state.zoom = targetZoom;
  state.panX = vw / 2 - (node.x + w / 2) * targetZoom;
  state.panY = vh / 2 - (node.y + h / 2) * targetZoom;
  updateTransform();
  emit('render');
}

export function clearSearch() {
  state.searchQuery = '';
  state.searchMatches = null;
  activeIndex = -1;
  if (searchInput) searchInput.value = '';
  if (resultsContainer) resultsContainer.innerHTML = '';
  const countEl = document.getElementById('search-count');
  if (countEl) countEl.textContent = '';
  emit('render');
}

export function focusSearch() {
  // Switch to search tab
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Open sidebar if closed
  if (!document.body.classList.contains('sidebar-open')) {
    document.body.classList.add('sidebar-open');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
  }

  // Activate search tab
  sidebar.querySelectorAll('.sidebar-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === 'search')
  );
  sidebar.querySelectorAll('.tab-pane').forEach(p =>
    p.classList.toggle('active', p.dataset.tab === 'search')
  );

  // Focus input after tab switch
  requestAnimationFrame(() => {
    const input = document.getElementById('search-input');
    if (input) { input.focus(); input.select(); }
  });
}
```

NOTE: The imports at the top of search.js need to be reorganized. The final file should have all imports at the top:

```js
import { state, nodeIndex, emit } from './state.js';
import { domCache } from './renderer.js';
import { esc, safeColor } from './utils.js';
import { updateTransform } from './transform.js';
```

The pure functions (`fuzzyMatch`, `searchNodes`) should remain export-able without side effects for testing. To handle this, keep the imports at the top — Vitest can mock them, or the tests can import only the pure functions.

**Step 2: Wire into sidebar.js**

In `src/js/sidebar.js`, add import at top:

```js
import { renderSearchTab } from './search.js';
```

In `refreshSidebar()` (line 61-67), add the search tab case:

```js
  else if (activeTab === 'search') renderSearchTab(contentEl);
```

**Step 3: Wire into main.js**

In `src/js/main.js`, add import:

```js
import { initSearch } from './search.js';
```

In init() after `initSidebar();` (line 132), add:

```js
  initSearch();
```

**Step 4: Build and verify**

Run: `node build.js`
Expected: Build succeeds, output sizes reported

**Step 5: Commit**

```bash
git add src/js/search.js src/js/sidebar.js src/js/main.js
git commit -m "feat(search): sidebar tab rendering, navigate-to-node, clear/focus (Task 4)"
```

---

### Task 5: Keyboard shortcut (Ctrl+K) + Escape clear

**Files:**
- Modify: `src/js/keyboard.js:15,34-62` (add Ctrl+K handler, modify Escape)

**Step 1: Add imports**

In `src/js/keyboard.js`, add:

```js
import { focusSearch, clearSearch } from './search.js';
```

**Step 2: Add Ctrl+K handler**

In `onKeyDown()`, BEFORE the input guard at line 35, add:

```js
  // Ctrl+K: focus search (works even when in input)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    focusSearch();
    return;
  }
```

**Step 3: Add search clear to Escape**

In the Escape handler (line 56-62), add `clearSearch()`:

```js
  if (e.key === 'Escape') {
    clearSearch();
    state.selectedIds.clear();
    renderSelectionState();
    closeMenus();
    hideNodePopup();
    setToolFn('select');
  }
```

**Step 4: Commit**

```bash
git add src/js/keyboard.js
git commit -m "feat(search): Ctrl+K shortcut + Escape clears search (Task 5)"
```

---

### Task 6: Run all tests + build verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (91 existing + new search tests)

**Step 2: Build**

Run: `node build.js`
Expected: Build succeeds

**Step 3: Manual verification checklist**

Open `dist/index.html` in browser and verify:
- [ ] Suche tab appears in sidebar
- [ ] Ctrl+K opens sidebar and focuses search input
- [ ] Typing filters nodes in real-time
- [ ] Matching characters are highlighted in results
- [ ] Non-matching nodes dim on canvas
- [ ] Matching nodes get highlight ring
- [ ] Clicking result pans to node
- [ ] Escape clears search and restores normal view
- [ ] Arrow keys + Enter navigate results
- [ ] Search queries meta fields (contact, tags, notes)

**Step 4: Final commit + update roadmap**

```bash
# Update ROADMAP.md — mark Phase 10 as done
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 10 (Search & Filter) as done in roadmap"
```
