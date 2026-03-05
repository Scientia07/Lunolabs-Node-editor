/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Application State ───
import { DEFAULT_CONNECTION_COLOR, DEFAULT_GRID_SIZE, MAX_UNDO } from './constants.js';

export const state = {
  nodes: [],
  connections: [],
  tool: 'select',
  shapeType: 'rect',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  snapEnabled: true,
  gridSize: DEFAULT_GRID_SIZE,
  selectedIds: new Set(),
  undoStack: [],
  redoStack: [],
  nextId: 1,
  connectingFrom: null,
  connectionColor: DEFAULT_CONNECTION_COLOR,
  selectedConnId: null,          // currently selected connection for endpoint editing
  // Project-level settings (can be overridden by loaded project)
  connectionStyle: 'bezier', // 'bezier' | 'straight'
  projectKey: null,          // localStorage key suffix
  theme: 'dark',
  // Sidebar: groups & visibility
  groups: [],               // [{ id, name, nodeIds: [], hidden: false }]
  hiddenSectors: new Set(), // sector IDs hidden via sidebar
  projectTitle: '',         // editable project title
};

// O(1) node lookup by id
export const nodeIndex = new Map();

export function rebuildIndex() {
  nodeIndex.clear();
  for (const n of state.nodes) {
    nodeIndex.set(n.id, n);
  }
}

export function genId() {
  return state.nextId++;
}

// ─── Undo / Redo ───

/** Serialize current undoable state into a JSON string */
function createSnapshot() {
  return JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
    groups: state.groups,
    hiddenSectors: [...state.hiddenSectors],
  });
}

/** Restore state from a parsed snapshot object */
function applySnapshot(snap) {
  state.nodes = snap.nodes;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  if (snap.groups) state.groups = snap.groups;
  if (snap.hiddenSectors) state.hiddenSectors = new Set(snap.hiddenSectors);
  state.selectedIds.clear();
  rebuildIndex();
}

export function saveSnapshot() {
  state.undoStack.push(createSnapshot());
  state.redoStack = [];
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
}

export function undo(fullRender, autoSave) {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.undoStack.pop()));
  fullRender();
  autoSave();
}

export function redo(fullRender, autoSave) {
  if (!state.redoStack.length) return;
  state.undoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.redoStack.pop()));
  fullRender();
  autoSave();
}
