/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-06
 * @file        search.js
 * @description Search & filter — fuzzy matching, results rendering, sidebar tab
 * @version     1.0
 * @date        2026-03-06
 * @depends-on  state.js, renderer.js, utils.js, transform.js
 * @used-by     main.js, keyboard.js, sidebar.js
 */
import { state, nodeIndex, emit } from './state.js';
import { domCache } from './renderer.js';
import { esc, safeColor } from './utils.js';
import { updateTransform } from './transform.js';

// ─── Pure Functions (no side effects) ───

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
      score += (lastIdx === ti - 1) ? 2 : 1;
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 1;
      lastIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
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

    const labelMatch = fuzzyMatch(q, node.label || '');
    if (labelMatch) {
      bestMatch = { node, score: labelMatch.score + 5, field: 'label', indices: labelMatch.indices };
    }

    if (node.meta) {
      for (const [key, val] of Object.entries(node.meta)) {
        if (typeof val !== 'string') continue;
        const m = fuzzyMatch(q, val);
        if (m) {
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

// ─── UI State ───

let searchInput, resultsContainer, activeIndex = -1;

// ─── Init ───

export function initSearch() {
  // No-op for now — future event listeners can go here
}

// ─── Sidebar Tab Rendering ───

export function renderSearchTab(contentEl) {
  const pane = contentEl.querySelector('[data-tab="search"]');
  if (!pane) return;

  // Only rebuild structure if input doesn't exist yet
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
        searchInput.blur();
      }
    });
  } else {
    searchInput = pane.querySelector('#search-input');
    resultsContainer = pane.querySelector('#search-results');
  }

  // Restore current query display
  if (state.searchQuery && searchInput.value !== state.searchQuery) {
    searchInput.value = state.searchQuery;
  }
  if (state.searchQuery) renderResults(searchNodes(state.searchQuery, state.nodes));
}

// ─── Search Logic ───

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

// ─── Navigation ───

function navigateToNode(nodeId) {
  const node = nodeIndex.get(nodeId);
  if (!node) return;
  const el = domCache.get(nodeId);
  const w = el ? el.offsetWidth : 120;
  const h = el ? el.offsetHeight : 60;

  // Select the node
  state.selectedIds.clear();
  state.selectedIds.add(nodeId);

  // Pan to center the node on screen (account for sidebar width)
  const sidebarW = document.body.classList.contains('sidebar-open')
    ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 280
    : 0;
  const cw = window.innerWidth - sidebarW;
  const ch = window.innerHeight;
  const targetZoom = Math.max(state.zoom, 1);
  state.zoom = targetZoom;
  state.panX = sidebarW + cw / 2 - (node.x + w / 2) * targetZoom;
  state.panY = ch / 2 - (node.y + h / 2) * targetZoom;
  updateTransform();
  emit('render');
}

// ─── Public API ───

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
