// ─── Project Loading ───
import { state, rebuildIndex } from './state.js';
import { applyTheme } from './theme.js';
import { esc, safeColor } from './utils.js';

/**
 * Load a project JSON object into state. Single source of truth.
 * @param {object} project - project data { nodes, connections, nextId, meta }
 * @param {object} [opts] - options
 * @param {string} [opts.name] - fallback project name if meta.title is missing
 * @param {boolean} [opts.resetState=true] - reset groups/undo/selection (false for initial URL load where no prior state exists)
 */
export function loadProject(project, opts = {}) {
  const { name = '', resetState = true } = opts;

  state.nodes = project.nodes || [];
  state.connections = project.connections || [];
  state.nextId = project.nextId || 1;

  if (resetState) {
    state.groups = [];
    state.hiddenSectors = new Set();
    state.hiddenNodes = new Set();
    state.selectedIds.clear();
    state.undoStack = [];
    state.redoStack = [];
  }

  state.projectTitle = project.meta?.title || name;

  if (project.meta) {
    if (project.meta.theme) applyTheme(project.meta.theme);
    if (project.meta.connectionStyle) state.connectionStyle = project.meta.connectionStyle;
    if (project.meta.gridEnabled !== undefined) state.gridEnabled = project.meta.gridEnabled;
    if (project.meta.physicsLayout !== undefined) state.physicsLayout = project.meta.physicsLayout;
    if (project.meta.showLegend !== undefined) state.showLegend = project.meta.showLegend;
  }

  rebuildIndex();
}

// Load project from URL parameter: ?project=netzwerk-jb-march
export async function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project');
  if (!projectName) return false;

  // Validate project name to prevent path traversal / injection
  if (!/^[a-z0-9][a-z0-9-]*$/.test(projectName)) return false;

  // Set project key for localStorage isolation
  state.projectKey = projectName;

  try {
    // Check for embedded data first (single-file build)
    if (window.__EMBEDDED_PROJECTS__ && window.__EMBEDDED_PROJECTS__[projectName]) {
      loadProject(window.__EMBEDDED_PROJECTS__[projectName], { resetState: false });
      return true;
    }
    // Fallback: fetch from data/ directory (dev mode or server)
    const resp = await fetch(`data/${projectName}.json`);
    if (!resp.ok) return false;
    const project = await resp.json();
    loadProject(project, { resetState: false });
    return true;
  } catch (_e) {
    return false;
  }
}

/** Auto-generate legend from sector node colors */
export function updateLegend() {
  const el = document.getElementById('legend');
  if (!el) return;

  if (!state.showLegend) {
    el.innerHTML = '';
    el.classList.remove('visible');
    return;
  }

  const sectors = state.nodes
    .filter(n => n.type === 'sector' || n.type === 'center')
    .map(n => ({ label: n.label || '', color: n.color || '#6c8aff' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));

  if (!sectors.length) {
    el.innerHTML = '';
    el.classList.remove('visible');
    return;
  }

  el.innerHTML = '<h4>Legende</h4>';
  sectors.forEach(item => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = safeColor(item.color);
    row.appendChild(dot);
    row.appendChild(document.createTextNode(' ' + esc(item.label)));
    el.appendChild(row);
  });
  el.classList.add('visible');
}
