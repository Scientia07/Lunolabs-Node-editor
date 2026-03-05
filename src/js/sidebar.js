/**
 * ─── File Rating ──────────────────────────────
 * @file        sidebar.js
 * @description Sidebar panel — tabs, connections list, groups management, visibility toggling
 * @version     2.0
 * @date        2026-03-05
 * @rating      7/10
 * @depends-on  state.js, persistence.js, utils.js, renderer.js, settings-panel.js
 * @used-by     main.js, keyboard.js
 * @strengths   Clean tab system, sector auto-groups, O(1) visibility via domCache + connIndex
 * @issues      innerHTML-heavy rendering (re-renders full tab on every change);
 *              event listeners re-created on each render (no delegation)
 * ─────────────────────────────────────────────── */
import { state, nodeIndex, saveSnapshot, genId, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor } from './utils.js';
import { domCache } from './renderer.js';
import { renderSettingsTab } from './settings-panel.js';

let sidebarEl, contentEl;
let activeTab = 'connections';

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
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

  // Listen for state changes
  document.addEventListener('editor:render', () => refreshSidebar());
}

export function toggleSidebar() {
  document.body.classList.toggle('sidebar-open');
  // Redraw grid after transition
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 280);
}

export function refreshSidebar() {
  if (!document.body.classList.contains('sidebar-open')) return;
  if (activeTab === 'connections') renderConnectionsTab();
  else if (activeTab === 'groups') renderGroupsTab();
  else if (activeTab === 'settings') renderSettingsTab(contentEl, refreshSidebar);
}

// ─── SVG icon helpers ───
const iconEye = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const iconEyeOff = `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const iconPlus = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const iconTrash = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;

// ─── Connections Tab ───
function renderConnectionsTab() {
  const pane = contentEl.querySelector('[data-tab="connections"]');
  if (!state.connections.length) {
    pane.innerHTML = '<div class="conn-empty">Keine Verbindungen vorhanden</div>';
    return;
  }

  // Group connections by source node
  const groups = new Map();
  for (const c of state.connections) {
    const fromNode = nodeIndex.get(c.from);
    if (!fromNode) continue;
    if (!groups.has(c.from)) groups.set(c.from, []);
    groups.get(c.from).push(c);
  }

  let html = '';
  for (const [fromId, conns] of groups) {
    const fromNode = nodeIndex.get(fromId);
    const fromLabel = fromNode?.label || `Node ${fromId}`;
    html += `<div class="conn-group-title">${esc(fromLabel)}</div>`;
    for (const c of conns) {
      const toNode = nodeIndex.get(c.to);
      const toLabel = toNode?.label || `Node ${c.to}`;
      html += `<div class="conn-item" data-conn-id="${c.id}" data-from="${c.from}" data-to="${c.to}">
        <span class="conn-dot" style="background:${safeColor(c.color)}"></span>
        <span class="conn-label">${esc(toLabel)}</span>
        <button class="conn-delete" data-conn-id="${c.id}" title="Loeschen">&times;</button>
      </div>`;
    }
  }
  pane.innerHTML = html;

  // Wire events
  pane.querySelectorAll('.conn-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.conn-delete')) return;
      highlightConnection(parseInt(el.dataset.connId, 10));
    });
    el.addEventListener('mouseenter', () => {
      hoverConnection(parseInt(el.dataset.connId, 10), true);
    });
    el.addEventListener('mouseleave', () => {
      hoverConnection(parseInt(el.dataset.connId, 10), false);
    });
  });
  pane.querySelectorAll('.conn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = parseInt(btn.dataset.connId, 10);
      saveSnapshot();
      state.connections = state.connections.filter(c => c.id !== cid);
      emit('render');
      autoSave();
      refreshSidebar();
    });
  });
}

function highlightConnection(connId) {
  const conn = state.connections.find(c => c.id === connId);
  if (!conn) return;
  // Select both connected nodes
  state.selectedIds.clear();
  state.selectedIds.add(conn.from);
  state.selectedIds.add(conn.to);
  emit('render');

  // Scroll canvas to show the connection midpoint
  const fromNode = nodeIndex.get(conn.from);
  const toNode = nodeIndex.get(conn.to);
  if (fromNode && toNode) {
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    const cw = window.innerWidth - (document.body.classList.contains('sidebar-open') ? 280 : 0);
    const ch = window.innerHeight;
    state.panX = cw / 2 - midX * state.zoom;
    state.panY = ch / 2 - midY * state.zoom;
    document.dispatchEvent(new CustomEvent('editor:render'));
  }

  // Highlight in sidebar
  contentEl.querySelectorAll('.conn-item').forEach(el => {
    el.classList.toggle('highlighted', parseInt(el.dataset.connId, 10) === connId);
  });
}

function hoverConnection(connId, on) {
  const svgLayer = document.getElementById('connections-layer');
  const el = svgLayer.querySelector(`[data-id="${connId}"]`);
  if (!el) return;
  if (on) {
    el.setAttribute('stroke-width', el.tagName === 'path' ? '4' : '3.5');
    el.style.filter = 'drop-shadow(0 0 8px currentColor)';
  } else {
    el.setAttribute('stroke-width', el.tagName === 'path' ? '2' : '1.5');
    el.style.filter = '';
  }
}

// ─── Groups Tab ───
function renderGroupsTab() {
  const pane = contentEl.querySelector('[data-tab="groups"]');
  let html = '';

  // ── Auto groups (sectors) ──
  const sectors = state.nodes.filter(n => n.type === 'sector' || n.type === 'center');
  if (sectors.length) {
    html += `<div class="group-section">
      <div class="group-section-title">Sektoren</div>`;
    for (const s of sectors) {
      const connected = getNodesConnectedTo(s.id);
      const isHidden = state.hiddenSectors.has(s.id);
      html += `<div class="group-item ${isHidden ? 'hidden-group' : ''}" data-sector-id="${s.id}">
        <span class="group-color" style="background:${safeColor(s.color)}"></span>
        <span class="group-name">${esc(s.label || 'Sektor ' + s.id)}</span>
        <span class="group-count">${connected.length}</span>
        <button class="group-eye" data-sector-id="${s.id}" title="${isHidden ? 'Einblenden' : 'Ausblenden'}">
          ${isHidden ? iconEyeOff : iconEye}
        </button>
      </div>`;
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

function getNodesConnectedTo(nodeId) {
  const ids = new Set();
  for (const c of state.connections) {
    if (c.from === nodeId) ids.add(c.to);
    if (c.to === nodeId) ids.add(c.from);
  }
  return [...ids].filter(id => nodeIndex.has(id));
}

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

/** Apply hidden state to node DOM elements and connections */
export function applyVisibility() {
  const hiddenNodeIds = new Set();

  // Hidden sectors + their connected nodes
  for (const sid of state.hiddenSectors) {
    hiddenNodeIds.add(sid);
    for (const nid of getNodesConnectedTo(sid)) {
      // Only hide if the node isn't connected to any visible sector
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

  // Apply to DOM using domCache for O(1) lookups
  for (const n of state.nodes) {
    const el = domCache.get(n.id);
    if (el) el.style.display = hiddenNodeIds.has(n.id) ? 'none' : '';
  }

  // P6: Build connection index for O(1) lookup instead of Array.find per SVG element
  const connIndex = new Map();
  for (const c of state.connections) connIndex.set(c.id, c);

  const svgLayer = document.getElementById('connections-layer');
  svgLayer.querySelectorAll('[data-id]').forEach(el => {
    const conn = connIndex.get(parseInt(el.dataset.id, 10));
    if (!conn) return;
    el.style.display = (hiddenNodeIds.has(conn.from) || hiddenNodeIds.has(conn.to)) ? 'none' : '';
  });
}

