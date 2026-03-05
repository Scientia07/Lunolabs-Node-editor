/**
 * ─── File Rating ──────────────────────────────
 * @file        settings-panel.js
 * @description Settings sidebar tab — project management UI, connection style, grid, theme settings
 * @version     2.0
 * @date        2026-03-05
 * @rating      7/10
 * @depends-on  state.js, persistence.js, utils.js, project-manager.js
 * @used-by     sidebar.js
 * @strengths   Complete settings UI, project list with badges, inline save dialog
 * @issues      Full innerHTML rebuild on every render — event listeners not delegated;
 *              large template string (125 lines) — hard to maintain;
 *              XSS-safe via esc() but template complexity increases risk
 * ─────────────────────────────────────────────── */
import { state, emit } from './state.js';
import { autoSave } from './persistence.js';
import { esc, safeColor } from './utils.js';
import {
  getAllProjects, saveProject, deleteSavedProject,
  loadProject, importProjectFile, downloadProject, newBlankProject
} from './project-manager.js';
import { runForceLayout, stopForceLayout } from './force-layout.js';

// ─── SVG icon helpers (settings-specific) ───
const iconSave = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const iconDownload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const iconUpload = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
const iconFile = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

export function renderSettingsTab(contentEl, refreshCallback) {
  const pane = contentEl.querySelector('[data-tab="settings"]');
  const allProjects = getAllProjects();

  // Build project list
  let projectListHtml = '';
  for (const p of allProjects) {
    const isCurrent = p.title === state.projectTitle;
    const badge = p.source === 'embedded'
      ? '<span class="project-badge">VORLAGE</span>'
      : '';
    const deleteBtn = p.source === 'saved'
      ? `<button class="conn-delete" data-delete-project="${esc(p.key)}" title="Loeschen">&times;</button>`
      : '';
    projectListHtml += `<div class="conn-item ${isCurrent ? 'highlighted' : ''}" data-load-project="${esc(p.key)}" data-source="${p.source}">
      <span class="conn-dot" style="background:${isCurrent ? 'var(--accent)' : 'var(--text-dim)'}"></span>
      <span class="conn-label">${esc(p.title)}${badge}</span>
      ${isCurrent ? '<span class="project-active">AKTIV</span>' : ''}
      ${deleteBtn}
    </div>`;
  }
  if (!allProjects.length) {
    projectListHtml = '<div class="sidebar-empty">Keine Projekte</div>';
  }

  pane.innerHTML = `
    <div class="settings-section">
      <span class="settings-label">Projekte</span>
      ${projectListHtml}
      <div id="save-project-area"></div>
      <div class="sidebar-btn-row">
        <button class="group-add-btn" id="save-project-btn">${iconSave} Speichern</button>
        <button class="group-add-btn" id="import-project-btn">${iconUpload} Importieren</button>
      </div>
      <div class="sidebar-btn-row">
        <button class="group-add-btn" id="download-project-btn">${iconDownload} Als Datei</button>
        <button class="group-add-btn" id="new-project-btn">${iconFile} Neu</button>
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
      <div class="settings-row">
        <span class="settings-row-label">Auto-Layout</span>
        <button class="toggle-switch ${state.physicsLayout ? 'on' : ''}" id="setting-physics-layout"></button>
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
      if (entry) { loadProject(entry); renderSettingsTab(contentEl, refreshCallback); }
    });
  });

  pane.querySelectorAll('[data-delete-project]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedProject(btn.dataset.deleteProject);
      renderSettingsTab(contentEl, refreshCallback);
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
      renderSettingsTab(contentEl, refreshCallback);
    };
    area.querySelector('#save-project-confirm').addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') area.innerHTML = ''; });
  });

  pane.querySelector('#download-project-btn').addEventListener('click', () => downloadProject());
  pane.querySelector('#import-project-btn').addEventListener('click', () => importProjectFile(refreshCallback));
  pane.querySelector('#new-project-btn').addEventListener('click', () => {
    newBlankProject();
    renderSettingsTab(contentEl, refreshCallback);
  });

  // Wire settings events
  pane.querySelector('#setting-title').addEventListener('input', (e) => {
    state.projectTitle = e.target.value;
    autoSave();
  });

  pane.querySelector('#setting-conn-style').addEventListener('change', (e) => {
    state.connectionStyle = e.target.value;
    emit('render');
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
}
