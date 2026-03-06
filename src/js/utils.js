/**
 * ─── File Rating ──────────────────────────────
 * @file        utils.js
 * @description Shared utilities — coordinate math, XSS escaping, color helpers, validation, serialization
 * @version     2.0
 * @date        2026-03-05
 * @rating      8.5/10
 * @depends-on  state.js
 * @used-by     renderer.js, interactions.js, persistence.js, sidebar.js, export-png.js,
 *              export-json.js, project.js, project-manager.js, settings-panel.js, transform.js
 * @strengths   esc() for XSS, safeColor() for CSS injection, validateProjectJSON() thorough,
 *              serializeProject() single source of truth for export format
 * @issues      wrapText() and roundRect() only used by export-png — could be co-located
 * ─────────────────────────────────────────────── */
// ─── Utility Functions ───
import { state } from './state.js';

export function screenToCanvas(sx, sy) {
  return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom };
}

export function snapToGrid(v) {
  if (!state.snapEnabled || !state.gridEnabled) return v;
  return Math.round(v / state.gridSize) * state.gridSize;
}

export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

/** Escape HTML entities to prevent XSS when inserting into innerHTML */
export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate a CSS hex color — returns the color if valid, fallback otherwise */
export function safeColor(color, fallback = '#6c8aff') {
  if (typeof color !== 'string') return fallback;
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

/** Validate imported project JSON structure. Returns { valid, data, error }. */
export function validateProjectJSON(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, error: 'Kein gueltiges JSON-Objekt' };

  const nodes = raw.nodes;
  const connections = raw.connections;

  if (!Array.isArray(nodes)) return { valid: false, error: 'nodes muss ein Array sein' };
  if (connections !== undefined && !Array.isArray(connections)) return { valid: false, error: 'connections muss ein Array sein' };

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n !== 'object' || n === null) return { valid: false, error: `node[${i}] ist ungueltig` };
    if (typeof n.id !== 'number') return { valid: false, error: `node[${i}].id fehlt oder ist keine Zahl` };
    if (typeof n.x !== 'number' || typeof n.y !== 'number') return { valid: false, error: `node[${i}] hat keine gueltigen x/y Koordinaten` };
    if (typeof n.type !== 'string') return { valid: false, error: `node[${i}].type fehlt` };
  }

  if (Array.isArray(connections)) {
    for (let i = 0; i < connections.length; i++) {
      const c = connections[i];
      if (typeof c !== 'object' || c === null) return { valid: false, error: `connection[${i}] ist ungueltig` };
      if (typeof c.id !== 'number') return { valid: false, error: `connection[${i}].id fehlt` };
      if (typeof c.from !== 'number' || typeof c.to !== 'number') return { valid: false, error: `connection[${i}].from/to fehlt` };
    }
  }

  if (raw.nextId !== undefined && (typeof raw.nextId !== 'number' || raw.nextId < 1)) {
    return { valid: false, error: 'nextId muss eine positive Zahl sein' };
  }

  return { valid: true };
}

/**
 * Calculate bounding box of all nodes.
 * @param {Array} nodes - array of node objects with x, y
 * @param {HTMLElement} [nodesLayer] - optional DOM layer for measuring actual element sizes
 * @param {number} [pad=80] - padding around the bounding box
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }} or null if no nodes
 */
export function getNodesBoundingBox(nodes, nodesLayer, pad = 80) {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const el = nodesLayer?.querySelector(`[data-id="${n.id}"]`);
    const w = el ? el.offsetWidth : (n.width || 140);
    const h = el ? el.offsetHeight : (n.height || 60);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function getContrastColor(hex) {
  if (!hex || hex.charAt(0) !== '#') return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a2e' : '#ffffff';
}

export function getGradientCSS(n) {
  if (!n.color2 || n.color2 === n.color) return n.color || '#6c8aff';
  return `linear-gradient(${n.gradAngle || 135}deg, ${n.color}, ${n.color2})`;
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ty = y;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, ty);
      line = w + ' ';
      ty += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, ty);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Derive tier from relevancy: > 5 = "nah", <= 5 = "satellit" */
export function getTier(node) {
  const r = node.meta?.relevancy;
  if (r == null) return 'nah';
  return r > 5 ? 'nah' : 'satellit';
}

/** Parse hex color to {r, g, b}. Returns null on invalid input. */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

export function confirmIfDirty(callback) {
  if (state.isDirty) {
    if (!confirm('Ungespeicherte Aenderungen gehen verloren. Fortfahren?')) return;
  }
  callback();
}

/** Build a project data object from current state for save/export */
export function serializeProject(state, title) {
  return {
    version: 2,
    meta: {
      title: title || state.projectTitle || '',
      theme: state.theme,
      connectionStyle: state.connectionStyle,
      gridEnabled: state.gridEnabled,
    },
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
  };
}
