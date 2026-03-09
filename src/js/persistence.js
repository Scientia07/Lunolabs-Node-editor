// ─── Persistence (localStorage) ───
import { state, rebuildIndex } from './state.js';
import { validateProjectJSON } from './utils.js';

function getStorageKey() {
  if (state.projectKey) return `network-editor-${state.projectKey}`;
  return 'network-editor-state';
}

// P3: Debounce autoSave — prevents JSON.stringify on every drag tick
let saveTimer = null;

export function autoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 500);
}

// Immediate save (for migration and before-unload)
export function autoSaveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  flushSave();
}

function flushSave() {
  saveTimer = null;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({
      nodes: state.nodes,
      connections: state.connections,
      nextId: state.nextId,
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
      gridEnabled: state.gridEnabled,
      groups: state.groups || [],
      hiddenSectors: state.hiddenSectors ? [...state.hiddenSectors] : [],
      hiddenNodes: state.hiddenNodes ? [...state.hiddenNodes] : [],
      projectTitle: state.projectTitle || '',
      physicsLayout: state.physicsLayout || false,
      showLegend: state.showLegend !== false,
    }));
    state.isDirty = false;
  } catch (_e) { /* quota exceeded or private mode */ }
}

export function autoLoad() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return migrateFromV1();
    const d = JSON.parse(raw);
    const check = validateProjectJSON(d);
    if (!check.valid) { console.warn('Corrupt saved state:', check.error); return false; }
    state.nodes = d.nodes || [];
    state.connections = d.connections || [];
    state.nextId = d.nextId || 1;
    state.zoom = d.zoom || 1;
    state.panX = d.panX || 0;
    state.panY = d.panY || 0;
    state.gridEnabled = d.gridEnabled !== false;
    state.groups = d.groups || [];
    state.hiddenSectors = new Set(d.hiddenSectors || []);
    state.hiddenNodes = new Set(d.hiddenNodes || []);
    state.projectTitle = d.projectTitle || '';
    state.physicsLayout = d.physicsLayout || false;
    state.showLegend = d.showLegend !== false;
    rebuildIndex();
    return true;
  } catch (_e) {
    return false;
  }
}

// Migrate from old localStorage keys used in v1 single-file apps
function migrateFromV1() {
  const oldKeys = ['network-editor-state', 'netzwerk-jb-march-v2'];
  for (const key of oldKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw);
      if (d.nodes && d.nodes.length > 0) {
        state.nodes = d.nodes;
        state.connections = d.connections || [];
        state.nextId = d.nextId || 1;
        state.zoom = d.zoom || 1;
        state.panX = d.panX || 0;
        state.panY = d.panY || 0;
        state.gridEnabled = d.gridEnabled !== false;
        rebuildIndex();
        // Save under new key and remove old
        autoSaveNow();
        return true;
      }
    } catch (_e) { /* ignore corrupt data */ }
  }
  return false;
}
