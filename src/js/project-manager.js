/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
/**
 * Project Management — save/load/delete/import/download/new
 */
import { state, rebuildIndex, emit } from './state.js';
import { autoSave } from './persistence.js';
import { showToast, validateProjectJSON, serializeProject } from './utils.js';
import { loadProject as loadProjectData } from './project.js';

const SAVED_PROJECTS_KEY = 'network-editor-saved-projects';

/** Get all available projects: embedded (from build) + user-saved (localStorage) */
export function getAllProjects() {
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

/** Save current state as a named project into localStorage */
export function saveProject(name) {
  const projectData = serializeProject(state, name);
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    saved[slug] = projectData;
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    state.projectTitle = name;
  } catch (e) { console.warn('Failed to save project:', e); }
}

/** Delete a user-saved project from localStorage */
export function deleteSavedProject(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECTS_KEY) || '{}');
    delete saved[key];
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
  } catch (e) { console.warn('Failed to delete project:', e); }
}

/** Load a project (embedded or saved) */
export function loadProject(projectEntry) {
  applyProject(projectEntry.data, projectEntry.key);
}

function applyProject(project, name) {
  loadProjectData(project, { name, resetState: true });
  emit('render');
  autoSave();
}

/** Import a JSON file via the file picker */
export function importProjectFile(refreshCallback) {
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
        refreshCallback?.();
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
export function downloadProject() {
  const name = state.projectTitle || 'projekt';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const data = serializeProject(state, name);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Clear the canvas for a new project */
export function newBlankProject() {
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
  emit('render');
  autoSave();
}
