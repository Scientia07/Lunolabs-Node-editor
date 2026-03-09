// ─── Transform (pan/zoom) ───
import { state } from './state.js';
import { drawGrid } from './grid.js';
import { updateMinimap } from './minimap.js';
import { autoSave } from './persistence.js';
import { getNodesLayer } from './renderer.js';
import { getNodesBoundingBox } from './utils.js';

export function updateTransform() {
  const canvas = document.getElementById('canvas');
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
  drawGrid();
  updateMinimap();
}

export function zoomTo(newZoom, cx, cy) {
  const container = document.getElementById('canvas-container');
  const rect = container.getBoundingClientRect();
  cx = cx != null ? cx - rect.left : rect.width / 2;
  cy = cy != null ? cy - rect.top : rect.height / 2;
  const old = state.zoom;
  state.zoom = Math.max(0.1, Math.min(5, newZoom));
  state.panX = cx - (cx - state.panX) * (state.zoom / old);
  state.panY = cy - (cy - state.panY) * (state.zoom / old);
  updateTransform();
  autoSave();
}

export function zoomFit() {
  if (!state.nodes.length) return;
  const nodesLayer = getNodesLayer();
  const box = getNodesBoundingBox(state.nodes, nodesLayer);
  if (!box) return;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const container = document.getElementById('canvas-container');
  const rect = container.getBoundingClientRect();
  state.zoom = Math.min(rect.width / w, rect.height / h, 2);
  state.panX = (rect.width - w * state.zoom) / 2 - box.minX * state.zoom;
  state.panY = (rect.height - h * state.zoom) / 2 - box.minY * state.zoom;
  updateTransform();
  autoSave();
}
