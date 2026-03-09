import { state, nodeIndex, saveSnapshot, genId, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor, getTier, safeMetaKey } from './utils.js';
import { SUGGESTED_META_FIELDS } from './constants.js';
import { domCache } from './renderer.js';
import { renderSettingsTab } from './settings-panel.js';
import { renderSearchTab } from './search.js';
import { buildAdjacencyMap, getNeighbors, buildHierarchyLayers, computeHiddenNodeIds } from './graph-utils.js';

let sidebarEl, contentEl;
let activeTab = 'groups';
const collapsedLayers = new Set(); // UI-only state for collapsed hierarchy layers

// ─── Groups state (persisted via autoSave) ───
// state.groups = [{ id, name, nodeIds: [], hidden: false }]
// state.hiddenSectors = new Set()  — auto-group sector IDs that are hidden

export function initSidebar() {
  sidebarEl = document.getElementById('sidebar');
  contentEl = sidebarEl.querySelector('.sidebar-content');

  // Ensure state has groups structures
  if (!state.groups) state.groups = [];
  if (!state.hiddenSectors) state.hiddenSectors = new Set();

  // Tab switching
  sidebarEl.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      sidebarEl.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      contentEl.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === activeTab));
      refreshSidebar();
    });
  });

  // Toggle button
  const toggleBtn = document.getElementById('sidebar-toggle');
  toggleBtn.addEventListener('click', toggleSidebar);

  // Bounce the toggle button to draw attention on first load
  setTimeout(() => {
    toggleBtn.classList.add('bounce');
    toggleBtn.addEventListener('animationend', () => toggleBtn.classList.remove('bounce'), { once: true });
  }, 800);

  // Drag-to-resize sidebar
  initSidebarResize(toggleBtn);

  // Listen for state changes
  document.addEventListener('editor:render', () => refreshSidebar());
  document.addEventListener('editor:selection', () => refreshSidebar());
}

export function toggleSidebar() {
  document.body.classList.toggle('sidebar-open');
  // Redraw grid after transition
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 280);
}

function initSidebarResize(toggleBtn) {
  const handle = document.getElementById('sidebar-resize');
  if (!handle) return;
  const MIN_W = 200;
  const MAX_W = 600;

  let startX, startW;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebarEl.offsetWidth;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
      document.documentElement.style.setProperty('--sidebar-w', newW + 'px');
    };

    const onUp = () => {
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function refreshSidebar() {
  if (!document.body.classList.contains('sidebar-open')) return;
  _adjMap = buildAdjacencyMap(state.connections);
  if (activeTab === 'groups') renderGroupsTab();
  else if (activeTab === 'details') renderDetailsTab();
  else if (activeTab === 'search') renderSearchTab(contentEl);
  else if (activeTab === 'settings') renderSettingsTab(contentEl, refreshSidebar);
}

// ─── SVG icon helpers ───
const iconEye = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const iconEyeOff = `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const iconPlus = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const iconTrash = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;

/** Pan canvas to center on a node and select it */
function jumpToNode(nodeId) {
  const node = nodeIndex.get(nodeId);
  if (!node) return;
  state.selectedIds.clear();
  state.selectedIds.add(nodeId);
  const container = document.getElementById('canvas-container');
  const rect = container.getBoundingClientRect();
  state.panX = rect.width / 2 - node.x * state.zoom;
  state.panY = rect.height / 2 - node.y * state.zoom;
  document.dispatchEvent(new CustomEvent('editor:render'));
}

// ─── Groups Tab ───
function renderGroupsTab() {
  const pane = contentEl.querySelector('[data-tab="groups"]');
  let html = '';

  // ── Hierarchical scaffold (layers by connection distance) ──
  if (!_adjMap) _adjMap = buildAdjacencyMap(state.connections);
  const layers = buildHierarchyLayers(state.nodes, state.connections, nodeIndex, _adjMap);
  if (layers.length) {
    html += `<div class="group-section">
      <div class="group-section-title">Netzwerk-Hierarchie</div>`;
    for (let depth = 0; depth < layers.length; depth++) {
      const layerNodes = layers[depth];
      const isCollapsed = collapsedLayers.has(depth);
      const layerLabel = depth === 0 ? 'Hub' : `Ebene ${depth}`;

      html += `<div class="scaffold-layer-header ${isCollapsed ? 'collapsed' : ''}" data-layer="${depth}">
        <span class="scaffold-chevron">${isCollapsed ? '›' : '‹'}</span>
        <span class="scaffold-layer-label">${layerLabel}</span>
        <span class="group-count">${layerNodes.length}</span>
      </div>`;

      if (!isCollapsed) {
        for (const n of layerNodes) {
          const connCount = getNeighbors(_adjMap, n.id, nodeIndex).length;
          const isSector = n.type === 'sector' || n.type === 'center';
          const isHiddenSector = isSector && state.hiddenSectors.has(n.id);
          const isHiddenNode = !isSector && state.hiddenNodes.has(n.id);
          const isHidden = isHiddenSector || isHiddenNode;

          html += `<div class="group-item scaffold-layer-${Math.min(depth, 4)} ${isHidden ? 'hidden-group' : ''}"
            ${isSector ? `data-sector-id="${n.id}"` : `data-node-id="${n.id}"`}
            style="padding-left:${8 + depth * 16}px">
            <span class="group-color" style="background:${safeColor(n.color || 'var(--accent)')}"></span>
            <span class="group-name">${esc(n.label || 'Node ' + n.id)}</span>
            <span class="group-count">${connCount}</span>
            <button class="group-eye" ${isSector ? `data-sector-id="${n.id}"` : `data-hide-node="${n.id}"`}
              title="${isHidden ? 'Einblenden' : 'Ausblenden'}">
              ${isHidden ? iconEyeOff : iconEye}
            </button>
          </div>`;
        }
      }
    }
    html += '</div>';
  }

  // ── Custom groups ──
  html += `<div class="group-section">
    <div class="group-section-title">Eigene Gruppen</div>`;
  for (const g of state.groups) {
    const isHidden = g.hidden;
    const count = g.nodeIds.filter(id => nodeIndex.has(id)).length;
    html += `<div class="group-item ${isHidden ? 'hidden-group' : ''}" data-group-id="${g.id}">
      <span class="group-color" style="background:var(--accent)"></span>
      <span class="group-name">${esc(g.name)}</span>
      <span class="group-count">${count}</span>
      <button class="group-eye" data-group-id="${g.id}" title="${isHidden ? 'Einblenden' : 'Ausblenden'}">
        ${isHidden ? iconEyeOff : iconEye}
      </button>
      <button class="group-delete" data-group-id="${g.id}" title="Gruppe loeschen">
        ${iconTrash}
      </button>
    </div>`;
  }
  html += `<button class="group-add-btn" id="add-custom-group">${iconPlus} Neue Gruppe</button>`;
  html += `<div id="group-edit-area"></div>`;
  html += '</div>';

  // ── Assign hint ──
  if (state.selectedIds.size > 0 && state.groups.length > 0) {
    html += `<div class="group-section">
      <div class="group-section-title">Auswahl zuweisen</div>`;
    for (const g of state.groups) {
      html += `<button class="group-add-btn" data-assign-group="${g.id}">
        ${iconPlus} Zu "${esc(g.name)}" hinzufuegen
      </button>`;
    }
    html += '</div>';
  }

  pane.innerHTML = html;

  // Wire layer collapse/expand
  pane.querySelectorAll('.scaffold-layer-header').forEach(header => {
    header.addEventListener('click', () => {
      const depth = parseInt(header.dataset.layer, 10);
      if (collapsedLayers.has(depth)) collapsedLayers.delete(depth);
      else collapsedLayers.add(depth);
      renderGroupsTab();
    });
  });

  // Wire click-to-jump on hierarchy items
  pane.querySelectorAll('.group-item[data-sector-id], .group-item[data-node-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.group-eye')) return;
      const nid = parseInt(el.dataset.sectorId || el.dataset.nodeId, 10);
      jumpToNode(nid);
    });
  });

  // Wire sector toggle
  pane.querySelectorAll('.group-eye[data-sector-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = parseInt(btn.dataset.sectorId, 10);
      toggleSectorVisibility(sid);
    });
  });

  // Wire custom group toggle
  pane.querySelectorAll('.group-eye[data-group-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = parseInt(btn.dataset.groupId, 10);
      toggleCustomGroupVisibility(gid);
    });
  });

  // Wire custom group delete
  pane.querySelectorAll('.group-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = parseInt(btn.dataset.groupId, 10);
      state.groups = state.groups.filter(g => g.id !== gid);
      autoSave();
      renderGroupsTab();
    });
  });

  // Wire add group
  const addBtn = pane.querySelector('#add-custom-group');
  if (addBtn) {
    addBtn.addEventListener('click', () => showGroupEditRow());
  }

  // Wire assign buttons
  pane.querySelectorAll('[data-assign-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = parseInt(btn.dataset.assignGroup, 10);
      const g = state.groups.find(gr => gr.id === gid);
      if (!g) return;
      for (const id of state.selectedIds) {
        if (!g.nodeIds.includes(id)) g.nodeIds.push(id);
      }
      autoSave();
      renderGroupsTab();
    });
  });

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
}

function showGroupEditRow() {
  const area = document.getElementById('group-edit-area');
  if (!area) return;
  area.innerHTML = `<div class="group-edit-row">
    <input class="group-edit-input" placeholder="Gruppenname..." autofocus>
    <button class="group-edit-confirm">OK</button>
  </div>`;
  const input = area.querySelector('.group-edit-input');
  const confirm = area.querySelector('.group-edit-confirm');
  input.focus();

  const create = () => {
    const name = input.value.trim();
    if (!name) { area.innerHTML = ''; return; }
    state.groups.push({ id: genId(), name, nodeIds: [], hidden: false });
    autoSave();
    renderGroupsTab();
  };
  confirm.addEventListener('click', create);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') area.innerHTML = ''; });
}

// ─── Connection adjacency cache (rebuilt at entry points via graph-utils.js) ───
let _adjMap = null;

function toggleSectorVisibility(sectorId) {
  if (state.hiddenSectors.has(sectorId)) {
    state.hiddenSectors.delete(sectorId);
  } else {
    state.hiddenSectors.add(sectorId);
  }
  applyVisibility();
  autoSave();
  renderGroupsTab();
}

function toggleCustomGroupVisibility(groupId) {
  const g = state.groups.find(gr => gr.id === groupId);
  if (!g) return;
  g.hidden = !g.hidden;
  applyVisibility();
  autoSave();
  renderGroupsTab();
}

// ─── Details Tab ───
function renderDetailsTab() {
  const pane = contentEl.querySelector('[data-tab="details"]');
  const selectedNodes = [...state.selectedIds].map(id => nodeIndex.get(id)).filter(Boolean);

  if (selectedNodes.length === 0) {
    pane.innerHTML = '<div class="conn-empty">Kein Element ausgewaehlt</div>';
    return;
  }

  if (selectedNodes.length > 1) {
    renderBatchDetails(pane, selectedNodes);
    return;
  }

  const node = selectedNodes[0];
  if (!node.meta) node.meta = {};
  const meta = node.meta;
  const tier = getTier(node);

  let html = '';

  html += `<div class="details-header">${esc(node.label || 'Ohne Titel')}</div>`;

  html += `<div class="details-tier">
    <span class="details-tier-badge details-tier-badge--${tier}">${tier === 'nah' ? 'Nah' : 'Satellit'}</span>
    <span class="details-tier-hint">wird aus Relevanz abgeleitet</span>
  </div>`;

  const relevancy = meta.relevancy ?? 10;
  html += `<div class="details-field">
    <label class="details-label">Relevanz: <span class="details-value" id="details-relevancy-val">${relevancy}</span></label>
    <input type="range" id="details-relevancy" class="settings-range" min="1" max="10" value="${relevancy}">
  </div>`;

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

  html += `<div class="details-field">
    <label class="details-label">Relevanz fuer alle: <span class="details-value" id="details-batch-relevancy-val">—</span></label>
    <input type="range" id="details-batch-relevancy" class="settings-range" min="1" max="10" value="5">
  </div>`;
  html += `<button class="group-add-btn" id="details-batch-apply">Auf alle anwenden</button>`;

  pane.innerHTML = html;

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
  // Capture ID so we always fetch fresh from nodeIndex (prevents stale references)
  const nodeId = node.id;
  const getNode = () => nodeIndex.get(nodeId);

  const slider = pane.querySelector('#details-relevancy');
  const valSpan = pane.querySelector('#details-relevancy-val');
  if (slider) {
    slider.addEventListener('input', () => {
      const n = getNode(); if (!n) return;
      valSpan.textContent = slider.value;
      n.meta.relevancy = parseInt(slider.value, 10);
      // Tier badge update (local DOM only — no full re-render)
      const badge = pane.querySelector('.details-tier-badge');
      if (badge) {
        const tier = parseInt(slider.value, 10) > 5 ? 'nah' : 'satellit';
        badge.textContent = tier === 'nah' ? 'Nah' : 'Satellit';
        badge.className = `details-tier-badge details-tier-badge--${tier}`;
      }
    });
    slider.addEventListener('change', () => {
      const n = getNode(); if (!n) return;
      saveSnapshot();
      n.meta.relevancy = parseInt(slider.value, 10);
      emit('render');
      autoSave();
    });
  }

  pane.querySelectorAll('[data-meta-key]').forEach(input => {
    const key = input.dataset.metaKey;
    input.addEventListener('change', () => {
      const n = getNode(); if (!n) return;
      saveSnapshot();
      const val = input.value.trim();
      if (val) {
        n.meta[key] = val;
      } else {
        delete n.meta[key];
      }
      autoSave();
      refreshSidebar();
    });
  });

  pane.querySelectorAll('[data-custom-key]').forEach(input => {
    input.addEventListener('change', () => {
      const n = getNode(); if (!n) return;
      const key = safeMetaKey(input.dataset.customKey);
      if (!key) return;
      saveSnapshot();
      n.meta[key] = input.value;
      autoSave();
    });
  });

  pane.querySelectorAll('[data-delete-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = getNode(); if (!n) return;
      const key = safeMetaKey(btn.dataset.deleteKey);
      if (!key) return;
      saveSnapshot();
      delete n.meta[key];
      autoSave();
      renderDetailsTab();
    });
  });

  const addBtn = pane.querySelector('#details-add-field');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const n = getNode(); if (!n) return;
      const keyInput = pane.querySelector('#details-new-key');
      const valInput = pane.querySelector('#details-new-val');
      const key = safeMetaKey(keyInput.value);
      const val = valInput.value.trim();
      if (!key) return;
      saveSnapshot();
      n.meta[key] = val;
      autoSave();
      renderDetailsTab();
    });
  }
}

/** Compute set of all node IDs that should be hidden */
export function getHiddenNodeIds() {
  _adjMap = buildAdjacencyMap(state.connections);
  return computeHiddenNodeIds({
    hiddenSectors: state.hiddenSectors,
    groups: state.groups,
    hiddenNodes: state.hiddenNodes,
    adjMap: _adjMap,
    nodeIndex
  });
}

/** Apply hidden state to node DOM elements and connections */
export function applyVisibility() {
  const hiddenNodeIds = getHiddenNodeIds();

  // Apply to DOM using domCache for O(1) lookups
  for (const n of state.nodes) {
    const el = domCache.get(n.id);
    if (el) el.style.display = hiddenNodeIds.has(n.id) ? 'none' : '';
  }

  const connIndex = new Map();
  for (const c of state.connections) connIndex.set(c.id, c);

  const svgLayer = document.getElementById('connections-layer');
  svgLayer.querySelectorAll('[data-id]').forEach(el => {
    const conn = connIndex.get(parseInt(el.dataset.id, 10));
    if (!conn) return;
    el.style.display = (hiddenNodeIds.has(conn.from) || hiddenNodeIds.has(conn.to)) ? 'none' : '';
  });
}

