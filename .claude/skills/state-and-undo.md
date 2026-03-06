---
name: state-and-undo
description: How state management, the node index, undo/redo snapshots, and persistence work in this editor. Follow this when modifying state shape, adding new properties, or implementing features that mutate nodes/connections.
trigger: When adding new node properties, modifying state shape, implementing undo-aware features, or working with persistence
---

# State Management & Undo — Netzwerk-Editor

## State Object (`src/js/state.js`)

All editor state lives in a single exported object:

```javascript
export const state = {
  nodes: [],           // Array of node objects
  connections: [],     // Array of connection objects (see Connection Shape below)
  tool: 'select',      // Current tool mode
  shapeType: 'rect',   // Sub-type for shape tool
  zoom: 1, panX: 0, panY: 0,
  gridEnabled: true, snapEnabled: true, gridSize: 40,
  selectedIds: new Set(),
  undoStack: [], redoStack: [],
  nextId: 1,
  connectingFrom: null,
  connectionColor: '#6c8aff',
  selectedConnId: null,
  connectionStyle: 'bezier',
  projectKey: null,
  theme: 'dark',
  groups: [],
  hiddenSectors: new Set(),
  hiddenNodes: new Set(),    // individual node IDs hidden via sidebar
  projectTitle: '',
  isDirty: false,            // true after saveSnapshot(), cleared on save
  // Search
  searchQuery: '',       // Current search text (empty = inactive)
  searchMatches: null,   // Set<nodeId> or null when search inactive
};
```

## Node Index (`nodeIndex`)

O(1) lookup by node ID:

```javascript
export const nodeIndex = new Map();

// Must be called after any structural change to state.nodes:
export function rebuildIndex() {
  nodeIndex.clear();
  for (const n of state.nodes) nodeIndex.set(n.id, n);
}
```

**When to call `rebuildIndex()`:**
- After `state.nodes.push(...)` — new node created
- After `state.nodes = state.nodes.filter(...)` — node deleted
- After `state.nodes = snap.nodes` — undo/redo restore
- After changing `n.type` — not strictly needed, but good practice

**When NOT needed:**
- After mutating a node's properties (color, font, opacity) — the Map reference stays valid

## Connection Shape

```javascript
{
  id: 1,               // Unique integer
  from: 2, to: 5,      // Source and target node IDs
  color: '#6c8aff',    // Line color

  // Optional — per-connection overrides:
  fromAnchor: 'right',  // Anchor direction: top/bottom/left/right
  toAnchor: 'left',
  style: 'straight',    // 'bezier' (default) or 'straight'
  dash: '6,4',          // stroke-dasharray: null=solid, '6,4'=dashed, '2,3'=dotted, '10,4,2,4'=dash-dot
  width: 3,             // Stroke width in px (default: 2 bezier, 1.5 straight)
  outlineColor: '#ff0000', // Outer stroke color (Adobe-style dual stroke)
  outlineWidth: 2,      // Outer stroke extra width per side
  hidden: true,         // Invisible connection (ghost outline at 15% opacity when selected)
}
```

**Per-connection properties** are optional and override global defaults. They auto-serialize through `state.connections` — no special handling needed for persistence or undo.

## Node Metadata (`node.meta`)

Nodes can carry a flexible `meta` object for structured data beyond visual properties:

```javascript
node.meta = {
  tier: "nah",           // "nah" | "satellit" — drives gradient wash visual
  relevancy: 8,          // 1-10, auto-maps to opacity (manual opacity overrides)
  contact: "Max Muster",
  email: "max@example.ch",
  phone: "+41 79 123 45 67",
  tags: "Praevention, Beratung",
  notes: "Free text",
  // ... any user-defined key-value pairs
}
```

**Opacity resolution order:**
1. `node.opacity` (manual override from popup slider) — wins if set
2. `node.meta.relevancy / 10` — auto-calculated from relevancy
3. Default: `1.0` (fully visible)

```javascript
const effectiveOpacity = node.opacity != null
  ? node.opacity
  : (node.meta?.relevancy ?? 10) / 10;
```

**Predefined suggested fields** are in `constants.js:SUGGESTED_META_FIELDS`. The `meta` object is free-form — users can add any key.

**Persistence:** `meta` is just another node property — it auto-serializes through `JSON.stringify` in snapshots, localStorage, and JSON export. No special handling needed.

**Sidebar Details tab** (`sidebar.js:renderDetailsTab()`) shows and edits metadata for the selected node.

## Adding New Node Properties

To add a new property (e.g., `opacity`, `borderWidth`):

1. **No state.js changes needed** — nodes are plain objects, properties are added dynamically
2. **Renderer** (`renderer.js:createNodeElement`): Apply the property to the DOM element
   ```javascript
   if (n.myProp != null) el.style.myProp = n.myProp;
   ```
3. **Export PNG** (`export-png.js`): Apply in the canvas rendering section
   ```javascript
   if (n.myProp != null) ctx.someCanvasProperty = n.myProp;
   ```
4. **Popup/controls**: Add UI to set the property (see `popup-panel` skill)
5. **Snapshots**: Already handled — `saveSnapshot()` serializes the entire `state.nodes` array via `JSON.stringify`, so any new property is automatically included

## Undo/Redo Pattern

### How Snapshots Work

Snapshot creation and restoration are extracted into private helpers:

```javascript
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
  state.isDirty = true;
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
}

export function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());
  applySnapshot(JSON.parse(state.undoStack.pop()));
  emit('render');
  emit('save');
}
```

- Full JSON snapshot of structural state
- `selectedIds` is NOT snapshotted (intentional — always cleared on undo)
- `MAX_UNDO = 80` snapshots
- `createSnapshot()` and `applySnapshot()` are private helpers (not exported)
- `undo()` and `redo()` are **parameterless** — they use the event bus (`emit('render')`, `emit('save')`) instead of callback parameters

### When to Call `saveSnapshot()`

**Before any mutation that the user should be able to undo:**
- Creating a node
- Deleting nodes/connections
- Moving nodes (called once on mousedown, not on every mousemove)
- Changing node color, font, type, size
- Changing connection color or endpoints

### Lazy Snapshot Pattern (for popups)

When a popup opens and the user makes multiple live-preview changes, take ONE snapshot on first change:

```javascript
let _snapshotTaken = false;

function ensureSnapshot() {
  if (!_snapshotTaken) {
    saveSnapshot();
    _snapshotTaken = true;
  }
}

export function showPopup(nodeId) {
  _snapshotTaken = false; // Reset on open
  // ... populate fields
}

// Each input handler:
inputEl.addEventListener('input', () => {
  ensureSnapshot(); // Only saves once
  applyChange();
});
```

This means Ctrl+Z reverts ALL changes made during one popup session.

### Undo/Redo Restore

Uses `applySnapshot()` internally, then emits events via the bus:

```javascript
export function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(createSnapshot());         // Save current for redo
  applySnapshot(JSON.parse(state.undoStack.pop())); // Restore previous
  emit('render');                                   // Re-render everything
  emit('save');                                     // Persist to localStorage
}
```

Note: `applySnapshot` handles `selectedIds.clear()` and `rebuildIndex()` internally.

## Event Bus (`on`/`off`/`emit`)

state.js also hosts a lightweight event bus for module communication:

```javascript
import { on, off, emit } from './state.js';

// In main.js:
on('render', fullRender);
on('save', autoSave);

// In any module:
emit('render');  // Triggers fullRender
emit('save');    // Triggers autoSave
```

This replaces the old pattern of passing `fullRender` as a callback to init functions.

## Persistence (`src/js/persistence.js`)

- `autoSave()` serializes state to `localStorage` (debounced) — clears `isDirty`
- `autoLoad()` restores from `localStorage` on startup
- Both serialize the full `state.nodes` array, so new properties are automatically persisted
- `hiddenNodes` is serialized as `[...state.hiddenNodes]` and restored as `new Set()`
- Project JSON files (`src/data/*.json`) are loaded via `project.js:loadFromURL()`

## Dirty Flag & Data Loss Prevention

- `state.isDirty` is set `true` in `saveSnapshot()`, cleared in `flushSave()` and `saveProject()`
- `confirmIfDirty(callback)` in `utils.js` wraps destructive actions (load, new, import)
- Shows native `confirm()` dialog if dirty — "Ungespeicherte Aenderungen gehen verloren. Fortfahren?"
- Used in `project-manager.js`: `loadProject()`, `newBlankProject()`, `importProjectFile()`

## Visibility System

Three layers of hiding, all feeding into `getHiddenNodeIds()` → `applyVisibility()`:

1. `state.hiddenSectors` (Set) — whole sectors hidden via sidebar Groups tab
2. `state.groups[].hidden` (boolean) — custom groups hidden
3. `state.hiddenNodes` (Set) — individual nodes hidden via sidebar Groups tab

`getHiddenNodeIds()` (exported from `sidebar.js`) computes the union. Used by both DOM visibility and export filtering.

## Important Rules

1. **Never mutate `state.nodes` array directly** without calling `rebuildIndex()` after structural changes
2. **Always `saveSnapshot()` before mutations** that the user should be able to undo
3. **Use `nodeIndex.get(id)`** for O(1) lookups, never `state.nodes.find()`
4. **Use `emit('render')` from state.js** after mutations (the event bus is the standard pattern; DOM `editor:render` is a legacy bridge)
5. **Close popups on undo/redo** — any popup holding a `currentNodeId` or `currentConnId` becomes stale after undo
6. **Connection properties are optional** — `style`, `dash`, `width`, `outlineColor`, `outlineWidth`, `hidden` default to `undefined` and auto-serialize
