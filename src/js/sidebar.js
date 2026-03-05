/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
/**
 * Sidebar Panel — Connections, Groups, Settings, Projects
 */
import { state, nodeIndex, saveSnapshot, rebuildIndex, genId } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor, showToast, validateProjectJSON } from './utils.js';
import { domCache } from './renderer.js';

let fullRenderFn;
let sidebarEl, contentEl;
let activeTab = 'connections';

// ─── Groups state (persisted via autoSave) ───
// state.groups = [{ id, name, nodeIds: [], hidden: false }]
// state.hiddenSectors = new Set()  — auto-group sector IDs that are hidden

export function initSidebar(fullRender) {
  fullRenderFn = fullRender;
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
  else if (activeTab === 'settings') renderSettingsTab();
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
      fullRenderFn();
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
  fullRenderFn();

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
      <button class="group-delete" data-group-id="${g.id}" title="Gruppe loeschen" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:2px;border-radius:4px;opacity:0.5">
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

// ─── Settings Tab ───
function renderSettingsTab() {
  const pane = contentEl.querySelector('[data-tab="settings"]');
  const allProjects = getAllProjects();

  // Build project list
  let projectListHtml = '';
  for (const p of allProjects) {
    const isCurrent = p.title === state.projectTitle;
    const badge = p.source === 'embedded'
      ? '<span style="font-size:8px;padding:1px 4px;background:var(--accent-dim);color:var(--accent);border-radius:3px;margin-left:4px">VORLAGE</span>'
      : '';
    const deleteBtn = p.source === 'saved'
      ? `<button class="conn-delete" data-delete-project="${esc(p.key)}" title="Loeschen">&times;</button>`
      : '';
    projectListHtml += `<div class="conn-item ${isCurrent ? 'highlighted' : ''}" data-load-project="${esc(p.key)}" data-source="${p.source}">
      <span class="conn-dot" style="background:${isCurrent ? 'var(--accent)' : 'var(--text-dim)'}"></span>
      <span class="conn-label">${esc(p.title)}${badge}</span>
      ${isCurrent ? '<span style="font-size:9px;color:var(--accent);font-weight:600">AKTIV</span>' : ''}
      ${deleteBtn}
    </div>`;
  }
  if (!allProjects.length) {
    projectListHtml = '<div style="font-size:11px;color:var(--text-dim);padding:4px 0">Keine Projekte</div>';
  }

  const iconSave = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  const iconDownload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const iconUpload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  const iconFile = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

  pane.innerHTML = `
    <div class="settings-section">
      <span class="settings-label">Projekte</span>
      ${projectListHtml}
      <div id="save-project-area"></div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="group-add-btn" id="save-project-btn" style="flex:1">${iconSave} Speichern</button>
        <button class="group-add-btn" id="import-project-btn" style="flex:1">${iconUpload} Importieren</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="group-add-btn" id="download-project-btn" style="flex:1">${iconDownload} Als Datei</button>
        <button class="group-add-btn" id="new-project-btn" style="flex:1">${iconFile} Neu</button>
      </div>
    </div>

    <div class="settings-section">
      <span class="settings-label">Projekt-Name</span>
      <input class="settings-input" id="setting-title" placeholder="Projektname" value="${esc(state.projectTitle || '')}">
    </div>

    <div class="settings-section">
      <span class="settings-label">Verbindungen</span>
      <div class="settings-row">
        <span class="settings-row-label">Stil</span>
        <select class="settings-select" id="setting-conn-style" style="width:auto;min-width:100px">
          <option value="bezier" ${state.connectionStyle === 'bezier' ? 'selected' : ''}>Bezier</option>
          <option value="straight" ${state.connectionStyle === 'straight' ? 'selected' : ''}>Gerade</option>
        </select>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Standardfarbe</span>
        <div class="settings-color-row">
          <input type="color" id="setting-conn-color" value="${state.connectionColor}" class="settings-color-preview">
          <span class="settings-color-hex">${state.connectionColor}</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <span class="settings-label">Raster</span>
      <div class="settings-row">
        <span class="settings-row-label">Sichtbar</span>
        <button class="toggle-switch ${state.gridEnabled ? 'on' : ''}" id="setting-grid-visible"></button>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Einrasten</span>
        <button class="toggle-switch ${state.snapEnabled ? 'on' : ''}" id="setting-snap"></button>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Groesse</span>
        <span class="settings-range-value" id="grid-size-val">${state.gridSize}px</span>
      </div>
      <input type="range" class="settings-range" id="setting-grid-size" min="10" max="80" step="5" value="${state.gridSize}">
    </div>

    <div class="settings-section">
      <span class="settings-label">Darstellung</span>
      <div class="settings-row">
        <span class="settings-row-label">Theme</span>
        <select class="settings-select" id="setting-theme" style="width:auto;min-width:100px">
          <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dunkel</option>
          <option value="light" ${state.theme === 'light' ? 'selected' : ''}>Hell</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <span class="settings-label">Info</span>
      <div class="settings-row">
        <span class="settings-row-label">Knoten</span>
        <span class="settings-range-value">${state.nodes.length}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Verbindungen</span>
        <span class="settings-range-value">${state.connections.length}</span>
      </div>
    </div>
  `;

  // Wire project events
  pane.querySelectorAll('[data-load-project]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.conn-delete')) return;
      const key = el.dataset.loadProject;
      const entry = allProjects.find(p => p.key === key);
      if (entry) { loadProject(entry); renderSettingsTab(); }
    });
  });

  pane.querySelectorAll('[data-delete-project]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedProject(btn.dataset.deleteProject);
      renderSettingsTab();
    });
  });

  pane.querySelector('#save-project-btn').addEventListener('click', () => {
    const area = pane.querySelector('#save-project-area');
    const defaultName = state.projectTitle || '';
    area.innerHTML = `<div class="group-edit-row" style="margin-top:6px">
      <input class="group-edit-input" id="save-project-name" placeholder="Projektname..." value="${esc(defaultName)}">
      <button class="group-edit-confirm" id="save-project-confirm">OK</button>
    </div>`;
    const input = area.querySelector('#save-project-name');
    input.focus();
    input.select();
    const doSave = () => {
      const name = input.value.trim();
      if (!name) return;
      saveProject(name);
      area.innerHTML = '';
      renderSettingsTab();
    };
    area.querySelector('#save-project-confirm').addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') area.innerHTML = ''; });
  });

  pane.querySelector('#download-project-btn').addEventListener('click', () => downloadProject());
  pane.querySelector('#import-project-btn').addEventListener('click', () => importProjectFile());
  pane.querySelector('#new-project-btn').addEventListener('click', () => {
    newBlankProject();
    renderSettingsTab();
  });

  // Wire settings events
  pane.querySelector('#setting-title').addEventListener('input', (e) => {
    state.projectTitle = e.target.value;
    autoSave();
  });

  pane.querySelector('#setting-conn-style').addEventListener('change', (e) => {
    state.connectionStyle = e.target.value;
    fullRenderFn();
    autoSave();
  });

  pane.querySelector('#setting-conn-color').addEventListener('input', (e) => {
    state.connectionColor = e.target.value;
    pane.querySelector('.settings-color-hex').textContent = e.target.value;
    autoSave();
  });

  pane.querySelector('#setting-grid-visible').addEventListener('click', (e) => {
    state.gridEnabled = !state.gridEnabled;
    e.currentTarget.classList.toggle('on', state.gridEnabled);
    document.getElementById('grid-toggle')?.classList.toggle('active', state.gridEnabled);
    document.dispatchEvent(new CustomEvent('editor:render'));
    autoSave();
  });

  pane.querySelector('#setting-snap').addEventListener('click', (e) => {
    state.snapEnabled = !state.snapEnabled;
    e.currentTarget.classList.toggle('on', state.snapEnabled);
    autoSave();
  });

  pane.querySelector('#setting-grid-size').addEventListener('input', (e) => {
    state.gridSize = parseInt(e.target.value, 10);
    pane.querySelector('#grid-size-val').textContent = state.gridSize + 'px';
    document.dispatchEvent(new CustomEvent('editor:render'));
    autoSave();
  });

  pane.querySelector('#setting-theme').addEventListener('change', (e) => {
    state.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', state.theme);
    document.dispatchEvent(new CustomEvent('editor:render'));
    autoSave();
  });
}

// ─── Project Management ───
const SAVED_PROJECTS_KEY = 'network-editor-saved-projects';

/** Get all available projects: embedded (from build) + user-saved (localStorage) */
function getAllProjects() {
  const projects = [];
  // Embedded projects from build
  if (window.__EMBEDDED_PROJECTS__) {
    for (const [key, data] of Object.entries(window.__EMBEDDED_PROJECTS__)) {
      projects.push({ key, title: data.meta?.title || key, source: 'embedded', data });
    }
  }
  // User-saved projects from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    for (const [key, data] of Object.entries(saved)) {
      projects.push({ key, title: data.meta?.title || key, source: 'saved', data });
    }
  } catch (e) { console.warn('Failed to read saved projects:', e); }
  return projects;
}

/** Build a project data object from current state */
function serializeProject(title) {
  return {
    version: 2,
    meta: {
      title,
      theme: state.theme,
      connectionStyle: state.connectionStyle,
      gridEnabled: state.gridEnabled,
    },
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  };
}

/** Save current state as a named project into localStorage */
function saveProject(name) {
  const projectData = serializeProject(name);
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    saved[slug] = projectData;
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    state.projectTitle = name;
  } catch (e) { console.warn('Failed to save project:', e); }
}

/** Delete a user-saved project from localStorage */
function deleteSavedProject(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    delete saved[key];
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
  } catch (e) { console.warn('Failed to delete project:', e); }
}

/** Load a project (embedded or saved) */
function loadProject(projectEntry) {
  applyProject(projectEntry.data, projectEntry.key);
}

function applyProject(project, name) {
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
  fullRenderFn();
  autoSave();
}

/** Import a JSON file via the file picker */
function importProjectFile() {
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
        // Auto-save imported project so it persists
        saveProject(name);
        refreshSidebar();
      } catch { showToast('Fehler beim Import — ungueltige JSON-Datei'); }
    };
    reader.readAsText(file);
    input.value = '';
    input.removeEventListener('change', handler);
  };
  input.addEventListener('change', handler);
  input.click();
}

/** Also download a copy as .json file */
function downloadProject() {
  const name = state.projectTitle || 'projekt';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const data = serializeProject(name);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Clear the canvas for a new project */
function newBlankProject() {
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
  fullRenderFn();
  autoSave();
}

// esc() and safeColor() imported from utils.js
