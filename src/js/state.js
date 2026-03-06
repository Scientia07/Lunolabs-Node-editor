/**
 * ─── File Rating ──────────────────────────────
 * @file        state.js
 * @description Central app state, O(1) node index, undo/redo stack, event bus
 * @version     2.0
 * @date        2026-03-05
 * @rating      9/10
 * @depends-on  constants.js
 * @used-by     ALL modules (core dependency)
 * @strengths   Clean state object, efficient Map-based index, minimal event bus
 * @issues      None significant — solid foundational module
 * ─────────────────────────────────────────────── */
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
  physicsLayout: false,    // force-directed auto-layout enabled
  // Sidebar: groups & visibility
  groups: [],               // [{ id, name, nodeIds: [], hidden: false }]
  hiddenSectors: new Set(), // sector IDs hidden via sidebar
  hiddenNodes: new Set(),   // individual node IDs hidden via sidebar
  projectTitle: '',         // editable project title
  // Search
  searchQuery: '',
  searchMatches: null,        // Set<nodeId> or null when search inactive
  isDirty: false,
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
    hiddenNodes: [...state.hiddenNodes],
  });
}

/** Restore state from a parsed snapshot object */
function applySnapshot(snap) {
  state.nodes = snap.nodes;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  if (snap.groups) state.groups = snap.groups;
  if (snap.hiddenSectors) state.hiddenSectors = new Set(snap.hiddenSectors);
  state.hiddenNodes = new Set(snap.hiddenNodes || []);
  state.selectedIds.clear();
  rebuildIndex();
}

export function saveSnapshot() {
  state.undoStack.push(createSnapshot());
  state.redoStack = [];
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  state.isDirty = true;
}

export function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.undoStack.pop()));
  emit('render');
  emit('save');
}

export function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.redoStack.pop()));
  emit('render');
  emit('save');
}

// ─── Event Bus ───
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function emit(event, ...args) {
  if (listeners.has(event)) {
    for (const fn of listeners.get(event)) fn(...args);
  }
}
