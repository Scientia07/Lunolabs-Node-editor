/**
 * ─── File Rating ──────────────────────────────
 * @file        transform.js
 * @description Pan/zoom transform — updateTransform, zoomTo (pivot-aware), zoomFit (auto-frame)
 * @version     2.0
 * @date        2026-03-05
 * @rating      8.5/10
 * @depends-on  state.js, grid.js, minimap.js, persistence.js, renderer.js, utils.js
 * @used-by     main.js, interactions.js, toolbar.js
 * @strengths   Pivot-point zoom preserves cursor position, zoomFit auto-frames all nodes
 * @issues      None significant
 * ─────────────────────────────────────────────── */
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
  const box = getNodesBoundingBox(state.nodes, nodesLayer);
  if (!box) return;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  state.zoom = Math.min(vw / w, vh / h, 2);
  state.panX = (vw - w * state.zoom) / 2 - box.minX * state.zoom;
  state.panY = (vh - h * state.zoom) / 2 - box.minY * state.zoom;
  updateTransform();
  autoSave();
}
