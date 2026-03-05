/**
 * ─── File Rating ──────────────────────────────
 * @file        export-png.js
 * @description PNG export — canvas rendering of all node types + connections at 2x resolution
 * @version     2.0
 * @date        2026-03-05
 * @rating      7/10
 * @depends-on  state.js, utils.js, renderer.js
 * @used-by     toolbar.js
 * @strengths   2x resolution for crisp output, handles all 7 node types, gradient support
 * @issues      Hardcoded colors (#1a1a2e, #f0f0f5) ignore theme — always exports "light" style;
 *              bezier curve rendering doesn't match screen exactly (simplified);
 *              large function (220 lines) — could split per node type
 * ─────────────────────────────────────────────── */
// ─── PNG Export (unified: handles all node types) ───
import { state, nodeIndex } from './state.js';
import { getContrastColor, wrapText, roundRect, getNodesBoundingBox, showToast } from './utils.js';
import { getNodeCenter, getNodesLayer, domCache } from './renderer.js';

export function exportPNG() {
  if (!state.nodes.length) { showToast('Keine Elemente zum Exportieren'); return; }
  showToast('PNG wird erstellt...');

  const nodesLayer = getNodesLayer();
  const box = getNodesBoundingBox(state.nodes, nodesLayer);
  if (!box) { showToast('Keine Elemente zum Exportieren'); return; }
  const { minX, minY, maxX, maxY } = box;
  const canvasW = maxX - minX;
  const canvasH = maxY - minY;

  const c = document.createElement('canvas');
  const scale = 2;
  c.width = canvasW * scale;
  c.height = canvasH * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const connStyle = state.connectionStyle || 'bezier';

  // Draw connections
  state.connections.forEach(conn => {
    const fromNode = nodeIndex.get(conn.from);
    const toNode = nodeIndex.get(conn.to);
    if (!fromNode || !toNode) return;

    const fc = getNodeCenter(fromNode);
    const tc = getNodeCenter(toNode);
    const fx = fc.x - minX, fy = fc.y - minY;
    const tx = tc.x - minX, ty = tc.y - minY;

    ctx.beginPath();
    const style = conn.style || connStyle;
    if (style === 'straight') {
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = conn.color || '#ccc';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45;
    } else {
      const dx = tx - fx;
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + dx * 0.4, fy, tx - dx * 0.4, ty, tx, ty);
      ctx.strokeStyle = conn.color || '#6c8aff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Draw nodes
  state.nodes.forEach(n => {
    const el = domCache.get(n.id);
    const w = el ? el.offsetWidth : (n.width || 140);
    const h = el ? el.offsetHeight : (n.height || 60);
    const x = n.x - minX;
    const y = n.y - minY;

    ctx.save();
    if (n.opacity != null && n.opacity !== 1) ctx.globalAlpha = n.opacity;
    const fontFam = n.font || 'DM Sans, sans-serif';
    const fWeight = n.fontWeight || (n.type === 'center' ? '700' : n.type === 'sector' ? '600' : '400');
    const fSize = n.fontSize || (n.type === 'center' ? 15 : n.type === 'sector' ? (n.size === 'lg' ? 14 : 12) : 13);

    if (n.type === 'center' || n.type === 'sector') {
      const isCircle = n.type === 'center' || n.size;
      if (isCircle) {
        const r = Math.min(w, h) / 2;
        // Gradient fill
        if (n.color2 && n.color2 !== n.color) {
          const angle = (n.gradAngle || 135) * Math.PI / 180;
          const gx1 = x + w / 2 - Math.cos(angle) * r;
          const gy1 = y + h / 2 - Math.sin(angle) * r;
          const gx2 = x + w / 2 + Math.cos(angle) * r;
          const gy2 = y + h / 2 + Math.sin(angle) * r;
          const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
          grad.addColorStop(0, n.color);
          grad.addColorStop(1, n.color2);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = n.color || '#6c8aff';
        }
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Rounded rect sector
        ctx.fillStyle = n.color || '#6c8aff';
        roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Label
      ctx.fillStyle = getContrastColor(n.color || '#6c8aff');
      ctx.font = `${fWeight} ${fSize}px ${fontFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = (n.label || '').split('\n');
      const lh = fSize + 3;
      const sy = y + h / 2 - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => ctx.fillText(l, x + w / 2, sy + i * lh));

    } else if (n.type === 'company') {
      if (n.parentId != null) {
        // Text-style company
        ctx.fillStyle = '#1a1d2e';
        ctx.font = `${fWeight} ${fSize}px ${fontFam}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.label || '', x, y + h / 2);
        if (n.underlined) {
          const tw = ctx.measureText(n.label || '').width;
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2 + 7);
          ctx.lineTo(x + tw, y + h / 2 + 7);
          ctx.strokeStyle = '#1a1d2e';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      } else {
        // Card-style company
        roundRect(ctx, x, y, w, h, 8);
        ctx.fillStyle = '#f0f0f5';
        ctx.fill();
        ctx.strokeStyle = '#d0d0dd';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Color dot
        ctx.fillStyle = n.color || '#6c8aff';
        ctx.beginPath();
        ctx.arc(x + 16, y + h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        // Label
        ctx.fillStyle = '#1a1a2e';
        ctx.font = `500 13px ${fontFam}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.label || '', x + w / 2 + 6, y + h / 2);
      }

    } else if (n.type === 'sticky') {
      ctx.fillStyle = n.color || '#fef08a';
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillRect(x, y, w, h);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `400 13px ${fontFam}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      wrapText(ctx, n.label || '', x + 14, y + 14, w - 28, 18);

    } else if (n.type === 'circle') {
      const r = Math.min(w, h) / 2;
      ctx.fillStyle = n.color || '#f0f0f5';
      ctx.strokeStyle = n.borderColor || '#d0d0dd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `400 13px ${fontFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label || '', x + w / 2, y + h / 2);

    } else if (n.type === 'rect') {
      ctx.fillStyle = n.color || '#f0f0f5';
      ctx.strokeStyle = n.borderColor || '#d0d0dd';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `400 13px ${fontFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label || '', x + w / 2, y + h / 2);

    } else if (n.type === 'textbox') {
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `400 14px ${fontFam}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      wrapText(ctx, n.label || '', x + 8, y + 8, (w || 200) - 16, 20);
    }

    ctx.restore();
  });

  // Download
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'netzwerk-' + new Date().toISOString().slice(0, 10) + '.png';
    a.click();
    URL.revokeObjectURL(url);
    showToast('PNG exportiert!');
  }, 'image/png');
}
