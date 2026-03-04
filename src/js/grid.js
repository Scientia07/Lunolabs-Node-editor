/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Grid Drawing (theme-aware) ───
import { state } from './state.js';

let gridCanvas, gridCtx;

export function initGrid() {
  gridCanvas = document.getElementById('grid-canvas');
  gridCtx = gridCanvas.getContext('2d');
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

  // Read theme-aware colors from CSS custom properties
  const style = getComputedStyle(document.documentElement);
  const majorColor = style.getPropertyValue('--grid-major').trim() || 'rgba(108,138,255,0.1)';
  const minorColor = style.getPropertyValue('--grid-minor').trim() || 'rgba(108,138,255,0.04)';

  gridCtx.clearRect(0, 0, w, h);

  for (let x = offsetX; x < w; x += gs) {
    const idx = Math.round((x - state.panX) / gs);
    gridCtx.strokeStyle = idx % 5 === 0 ? majorColor : minorColor;
    gridCtx.lineWidth = idx % 5 === 0 ? 1 : 0.5;
    gridCtx.beginPath();
    gridCtx.moveTo(x, 0);
    gridCtx.lineTo(x, h);
    gridCtx.stroke();
  }

  for (let y = offsetY; y < h; y += gs) {
    const idx = Math.round((y - state.panY) / gs);
    gridCtx.strokeStyle = idx % 5 === 0 ? majorColor : minorColor;
    gridCtx.lineWidth = idx % 5 === 0 ? 1 : 0.5;
    gridCtx.beginPath();
    gridCtx.moveTo(0, y);
    gridCtx.lineTo(w, y);
    gridCtx.stroke();
  }
}
