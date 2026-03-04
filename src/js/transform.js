/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Transform (pan/zoom) ───
import { state } from './state.js';
import { drawGrid } from './grid.js';
import { updateMinimap } from './minimap.js';
import { autoSave } from './persistence.js';
import { getNodesLayer } from './renderer.js';

export function updateTransform() {
  const canvas = document.getElementById('canvas');
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
  drawGrid();
  updateMinimap();
}

export function zoomTo(newZoom, cx, cy) {
  cx = cx || window.innerWidth / 2;
  cy = cy || window.innerHeight / 2;
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
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.nodes.forEach(n => {
    const el = nodesLayer.querySelector(`[data-id="${n.id}"]`);
    const w = el ? el.offsetWidth : (n.width || 140);
    const h = el ? el.offsetHeight : (n.height || 60);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  });
  const pad = 80;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  state.zoom = Math.min(vw / w, vh / h, 2);
  state.panX = (vw - w * state.zoom) / 2 - minX * state.zoom + pad * state.zoom;
  state.panY = (vh - h * state.zoom) / 2 - minY * state.zoom + pad * state.zoom;
  updateTransform();
  autoSave();
}
