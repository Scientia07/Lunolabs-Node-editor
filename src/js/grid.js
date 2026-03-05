/**
 * ─── File Rating ──────────────────────────────
 * @file        grid.js
 * @description Canvas grid rendering — theme-aware colors, major/minor lines, cached CSS props
 * @version     2.0
 * @date        2026-03-05
 * @rating      8.5/10
 * @depends-on  state.js
 * @used-by     main.js, toolbar.js, transform.js, keyboard.js
 * @strengths   CSS property caching (P4), theme-aware grid colors, clean drawing loop
 * @issues      Full canvas clear+redraw on every call — could skip if unchanged
 * ─────────────────────────────────────────────── */
// ─── Grid Drawing (theme-aware) ───
import { state } from './state.js';

let gridCanvas, gridCtx;
// P4: Cache CSS properties — re-read only on theme change/resize
let cachedMajorColor = 'rgba(108,138,255,0.1)';
let cachedMinorColor = 'rgba(108,138,255,0.04)';

export function initGrid() {
  gridCanvas = document.getElementById('grid-canvas');
  gridCtx = gridCanvas.getContext('2d');
  refreshGridColors();
  window.addEventListener('resize', refreshGridColors);
  // Re-read on theme change (dispatched by settings)
  document.addEventListener('editor:render', refreshGridColors);
}

function refreshGridColors() {
  const style = getComputedStyle(document.documentElement);
  cachedMajorColor = style.getPropertyValue('--grid-major').trim() || 'rgba(108,138,255,0.1)';
  cachedMinorColor = style.getPropertyValue('--grid-minor').trim() || 'rgba(108,138,255,0.04)';
}

export function drawGrid() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  gridCanvas.width = w;
  gridCanvas.height = h;
  if (!state.gridEnabled) return;

  const gs = state.gridSize * state.zoom;
  const offsetX = state.panX % gs;
  const offsetY = state.panY % gs;

  gridCtx.clearRect(0, 0, w, h);

  for (let x = offsetX; x < w; x += gs) {
    const idx = Math.round((x - state.panX) / gs);
    gridCtx.strokeStyle = idx % 5 === 0 ? cachedMajorColor : cachedMinorColor;
    gridCtx.lineWidth = idx % 5 === 0 ? 1 : 0.5;
    gridCtx.beginPath();
    gridCtx.moveTo(x, 0);
    gridCtx.lineTo(x, h);
    gridCtx.stroke();
  }

  for (let y = offsetY; y < h; y += gs) {
    const idx = Math.round((y - state.panY) / gs);
    gridCtx.strokeStyle = idx % 5 === 0 ? cachedMajorColor : cachedMinorColor;
    gridCtx.lineWidth = idx % 5 === 0 ? 1 : 0.5;
    gridCtx.beginPath();
    gridCtx.moveTo(0, y);
    gridCtx.lineTo(w, y);
    gridCtx.stroke();
  }
}
