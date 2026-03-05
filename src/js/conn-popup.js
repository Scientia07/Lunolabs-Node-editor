/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
// ─── Connection Properties Popup ───
import { state, saveSnapshot } from './state.js';
import { PALETTE } from './constants.js';
import { autoSave } from './persistence.js';
import { renderConnections, getConnectionEndpoints } from './renderer.js';

let popup;
let currentConnId = null;
let _snapshotTaken = false;

export function initConnPopup() {
  popup = document.getElementById('conn-popup');

  // Tab switching
  popup.querySelectorAll('.np-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      popup.querySelectorAll('.np-tab').forEach(t => t.classList.remove('active'));
      popup.querySelectorAll('.np-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      popup.querySelector(`[data-np-pane="${tab.dataset.npTab}"]`).classList.add('active');
    });
  });

  // Color swatches
  const swatches = document.getElementById('cp-swatches');
  PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch';
    s.style.background = c;
    s.addEventListener('click', () => {
      ensureSnapshot();
      document.getElementById('cp-color').value = c;
      document.getElementById('cp-hex').textContent = c;
      applyColor();
    });
    swatches.appendChild(s);
  });

  document.getElementById('cp-color').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('cp-hex').textContent = e.target.value;
    applyColor();
  });

  document.getElementById('cp-line-style').addEventListener('change', () => {
    ensureSnapshot();
    applyStyle();
  });

  document.getElementById('cp-dash').addEventListener('change', () => {
    ensureSnapshot();
    applyStyle();
  });

  document.getElementById('cp-width').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('cp-width-val').textContent = e.target.value;
    applyStyle();
  });

  document.getElementById('cp-outline-color').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('cp-outline-hex').textContent = e.target.value;
    applyOutline();
  });

  document.getElementById('cp-outline-w').addEventListener('input', (e) => {
    ensureSnapshot();
    const val = parseInt(e.target.value, 10);
    document.getElementById('cp-outline-w-val').textContent = val;
    document.getElementById('cp-outline-hex').textContent = val > 0
      ? document.getElementById('cp-outline-color').value : 'keiner';
    applyOutline();
  });

  document.getElementById('cp-hidden').addEventListener('change', () => {
    ensureSnapshot();
    applyHidden();
  });
}

function ensureSnapshot() {
  if (!_snapshotTaken) {
    saveSnapshot();
    _snapshotTaken = true;
  }
}

function getConn() {
  return currentConnId != null ? state.connections.find(c => c.id === currentConnId) : null;
}

function applyColor() {
  const conn = getConn();
  if (!conn) return;
  conn.color = document.getElementById('cp-color').value;
  // Update active swatch
  popup.querySelectorAll('#cp-swatches .color-swatch').forEach(s => {
    s.classList.toggle('active', rgbToHex(s.style.background) === conn.color.toLowerCase());
  });
  renderConnections();
  autoSave();
}

function applyStyle() {
  const conn = getConn();
  if (!conn) return;
  conn.style = document.getElementById('cp-line-style').value;
  conn.dash = document.getElementById('cp-dash').value || null;
  conn.width = parseFloat(document.getElementById('cp-width').value);
  renderConnections();
  autoSave();
}

function applyOutline() {
  const conn = getConn();
  if (!conn) return;
  const w = parseInt(document.getElementById('cp-outline-w').value, 10);
  if (w > 0) {
    conn.outlineColor = document.getElementById('cp-outline-color').value;
    conn.outlineWidth = w;
  } else {
    conn.outlineColor = null;
    conn.outlineWidth = null;
  }
  renderConnections();
  autoSave();
}

function applyHidden() {
  const conn = getConn();
  if (!conn) return;
  conn.hidden = document.getElementById('cp-hidden').checked;
  renderConnections();
  autoSave();
}

export function showConnPopup(connId) {
  const conn = state.connections.find(c => c.id === connId);
  if (!conn) return;

  currentConnId = connId;
  _snapshotTaken = false;

  // Populate color
  const color = conn.color || '#6c8aff';
  document.getElementById('cp-color').value = color;
  document.getElementById('cp-hex').textContent = color;
  popup.querySelectorAll('#cp-swatches .color-swatch').forEach(s => {
    s.classList.toggle('active', rgbToHex(s.style.background) === color.toLowerCase());
  });

  // Populate style
  document.getElementById('cp-line-style').value = conn.style || state.connectionStyle || 'bezier';
  document.getElementById('cp-dash').value = conn.dash || '';
  const width = conn.width || 2;
  document.getElementById('cp-width').value = width;
  document.getElementById('cp-width-val').textContent = width;
  const outlineW = conn.outlineWidth || 0;
  document.getElementById('cp-outline-color').value = conn.outlineColor || '#000000';
  document.getElementById('cp-outline-w').value = outlineW;
  document.getElementById('cp-outline-w-val').textContent = outlineW;
  document.getElementById('cp-outline-hex').textContent = outlineW > 0
    ? (conn.outlineColor || '#000000') : 'keiner';
  document.getElementById('cp-hidden').checked = !!conn.hidden;

  // Position near the connection midpoint
  const pts = getConnectionEndpoints(conn);
  if (pts) {
    const midScreenX = ((pts.fc.x + pts.tc.x) / 2) * state.zoom + state.panX;
    const midScreenY = ((pts.fc.y + pts.tc.y) / 2) * state.zoom + state.panY;
    let left = midScreenX + 20;
    let top = midScreenY - 60;
    if (left + 270 > window.innerWidth) left = midScreenX - 280;
    if (left < 8) left = 8;
    if (top + 300 > window.innerHeight) top = window.innerHeight - 300;
    if (top < 8) top = 8;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  popup.classList.add('open');
}

export function hideConnPopup() {
  popup.classList.remove('open');
  currentConnId = null;
  _snapshotTaken = false;
}

function rgbToHex(rgb) {
  if (!rgb || rgb.startsWith('#')) return rgb;
  const m = rgb.match(/(\d+)/g);
  if (!m || m.length < 3) return rgb;
  return '#' + m.slice(0, 3).map(v => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
}
