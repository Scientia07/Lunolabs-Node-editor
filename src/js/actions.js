// ─── Node Actions ───
import { state, nodeIndex, genId, saveSnapshot, rebuildIndex } from './state.js';
import { runForceLayout } from './force-layout.js';

export function deleteSelected(fullRender) {
  if (!state.selectedIds.size) return;
  saveSnapshot();
  state.connections = state.connections.filter(c => !state.selectedIds.has(c.from) && !state.selectedIds.has(c.to));
  state.nodes = state.nodes.filter(n => !state.selectedIds.has(n.id));
  state.selectedIds.clear();
  rebuildIndex();
  fullRender();
  if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
}

export function duplicateSelected(fullRender) {
  if (!state.selectedIds.size) return;
  saveSnapshot();
  const idMap = new Map();
  const newIds = new Set();
  state.selectedIds.forEach(id => {
    const n = nodeIndex.get(id);
    if (!n) return;
    const newId = genId();
    idMap.set(id, newId);
    newIds.add(newId);
    state.nodes.push({ ...n, id: newId, x: n.x + 30, y: n.y + 30 });
  });
  state.connections.forEach(c => {
    if (idMap.has(c.from) && idMap.has(c.to)) {
      state.connections.push({ id: genId(), from: idMap.get(c.from), to: idMap.get(c.to), color: c.color });
    }
  });
  state.selectedIds.clear();
  newIds.forEach(id => state.selectedIds.add(id));
  rebuildIndex();
  fullRender();
  if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
}
