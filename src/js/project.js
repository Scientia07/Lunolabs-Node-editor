/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Project Loading ───
import { state, rebuildIndex } from './state.js';
import { applyTheme } from './theme.js';
import { esc, safeColor } from './utils.js';

// Load a project JSON object into state
export function loadProject(project) {
  state.nodes = project.nodes || [];
  state.connections = project.connections || [];
  state.nextId = project.nextId || 1;

  // Clear previous legend before applying new project
  clearLegend();

  if (project.meta) {
    if (project.meta.theme) applyTheme(project.meta.theme);
    if (project.meta.connectionStyle) state.connectionStyle = project.meta.connectionStyle;
    if (project.meta.gridEnabled !== undefined) state.gridEnabled = project.meta.gridEnabled;
    if (project.meta.legend) renderLegend(project.meta.legend);
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
      loadProject(window.__EMBEDDED_PROJECTS__[projectName]);
      return true;
    }
    // Fallback: fetch from data/ directory (dev mode or server)
    const resp = await fetch(`data/${projectName}.json`);
    if (!resp.ok) return false;
    const project = await resp.json();
    loadProject(project);
    return true;
  } catch (_e) {
    return false;
  }
}

export function clearLegend() {
  const el = document.getElementById('legend');
  if (el) { el.innerHTML = ''; el.classList.remove('visible'); }
}

export function renderLegend(legendItems) {
  const el = document.getElementById('legend');
  if (!el || !legendItems || !legendItems.length) return;
  el.innerHTML = '<h4>Legende</h4>';
  legendItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = safeColor(item.color);
    row.appendChild(dot);
    row.appendChild(document.createTextNode(' ' + (item.label || '')));
    el.appendChild(row);
  });
  el.classList.add('visible');
}
