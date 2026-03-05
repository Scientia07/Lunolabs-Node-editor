/**
 * ─── File Rating ──────────────────────────────
 * @file        minimap.js
 * @description Minimap overview — canvas rendering of nodes/connections + viewport indicator
 * @version     2.0
 * @date        2026-03-05
 * @rating      8/10
 * @depends-on  state.js, utils.js
 * @used-by     main.js, transform.js, interactions.js
 * @strengths   Cached dimensions (P5), shape-aware rendering, viewport overlay
 * @issues      Not interactive (no click-to-pan); minimap not clickable for navigation
 * ─────────────────────────────────────────────── */
// ─── Minimap ───
import { state, nodeIndex } from './state.js';
import { getNodesBoundingBox } from './utils.js';

let minimapCanvas, minimapCtx, minimapViewport;
// P5: Cache minimap dimensions — re-read only on resize
let cachedMW = 180;
let cachedMH = 120;

export function initMinimap() {
  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas.getContext('2d');
  minimapViewport = document.getElementById('minimap-viewport');
  refreshMinimapDimensions();
  window.addEventListener('resize', refreshMinimapDimensions);
}

function refreshMinimapDimensions() {
  const style = getComputedStyle(document.documentElement);
  cachedMW = parseInt(style.getPropertyValue('--minimap-w'), 10) || 180;
  cachedMH = parseInt(style.getPropertyValue('--minimap-h'), 10) || 120;
}

export function updateMinimap() {
  const mw = cachedMW;
  const mh = cachedMH;
  minimapCanvas.width = mw;
  minimapCanvas.height = mh;
  minimapCtx.clearRect(0, 0, mw, mh);
  if (!state.nodes.length) return;

  const box = getNodesBoundingBox(state.nodes, null, 100);
  if (!box) return;
  const { minX, minY, maxX, maxY } = box;
  const worldW = (maxX - minX) || 1;
  const worldH = (maxY - minY) || 1;
  const scale = Math.min(mw / worldW, mh / worldH);

  // Draw connections
  minimapCtx.strokeStyle = 'rgba(108,138,255,0.3)';
  minimapCtx.lineWidth = 1;
  state.connections.forEach(c => {
    const f = nodeIndex.get(c.from);
    const t = nodeIndex.get(c.to);
    if (!f || !t) return;
    minimapCtx.beginPath();
    minimapCtx.moveTo((f.x - minX + 60) * scale, (f.y - minY + 30) * scale);
    minimapCtx.lineTo((t.x - minX + 60) * scale, (t.y - minY + 30) * scale);
    minimapCtx.stroke();
  });

  // Draw nodes
  state.nodes.forEach(n => {
    if (n.type === 'company' && n.parentId != null) return; // skip text-style companies in minimap
    const nx = (n.x - minX) * scale;
    const ny = (n.y - minY) * scale;
    const nw = (n.width || (n.type === 'sector' ? 140 : 90)) * scale;
    const nh = (n.height || (n.type === 'sector' ? 60 : 30)) * scale;
    minimapCtx.fillStyle = n.color || (n.type === 'sticky' ? '#fef08a' : '#6c8aff');
    minimapCtx.globalAlpha = 0.7;
    if (n.type === 'circle' || n.type === 'center' || (n.type === 'sector' && n.size)) {
      minimapCtx.beginPath();
      minimapCtx.arc(nx + nw / 2, ny + nh / 2, Math.min(nw, nh) / 2, 0, Math.PI * 2);
      minimapCtx.fill();
    } else {
      minimapCtx.fillRect(nx, ny, Math.max(nw, 3), Math.max(nh, 3));
    }
    minimapCtx.globalAlpha = 1;
  });

  // Viewport indicator
  const vw = window.innerWidth, vh = window.innerHeight;
  minimapViewport.style.left = Math.max(0, (-state.panX / state.zoom - minX) * scale) + 'px';
  minimapViewport.style.top = Math.max(0, (-state.panY / state.zoom - minY) * scale) + 'px';
  minimapViewport.style.width = (vw / state.zoom) * scale + 'px';
  minimapViewport.style.height = (vh / state.zoom) * scale + 'px';
}
