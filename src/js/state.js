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
  // Project-level settings (can be overridden by loaded project)
  connectionStyle: 'bezier', // 'bezier' | 'straight'
  projectKey: null,          // localStorage key suffix
  theme: 'dark',
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
export function saveSnapshot() {
  state.undoStack.push(JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  }));
  state.redoStack = [];
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
}

export function undo(fullRender, autoSave) {
  if (!state.undoStack.length) return;
  state.redoStack.push(JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  }));
  const snap = JSON.parse(state.undoStack.pop());
  state.nodes = snap.nodes;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  state.selectedIds.clear();
  rebuildIndex();
  fullRender();
  autoSave();
}

export function redo(fullRender, autoSave) {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  }));
  const snap = JSON.parse(state.redoStack.pop());
  state.nodes = snap.nodes;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  state.selectedIds.clear();
  rebuildIndex();
  fullRender();
  autoSave();
}
