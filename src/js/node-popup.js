// ─── Node Properties Quick-Popup ───
import { state, nodeIndex, saveSnapshot, rebuildIndex } from './state.js';
import { PALETTE, FONTS } from './constants.js';
import { autoSave } from './persistence.js';

let popup;
let currentNodeId = null;
let _snapshotTaken = false;

export function initNodePopup() {
  popup = document.getElementById('node-popup');

  // Tab switching
  popup.querySelectorAll('.np-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      popup.querySelectorAll('.np-tab').forEach(t => t.classList.remove('active'));
      popup.querySelectorAll('.np-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      popup.querySelector(`[data-np-pane="${tab.dataset.npTab}"]`).classList.add('active');
    });
  });

  // ── Color tab ──
  // Swatches
  const swatches = document.getElementById('np-swatches');
  PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch';
    s.style.background = c;
    s.addEventListener('click', () => {
      ensureSnapshot();
      document.getElementById('np-color1').value = c;
      document.getElementById('np-hex1').textContent = c;
      applyColor();
    });
    swatches.appendChild(s);
  });

  document.getElementById('np-color1').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-hex1').textContent = e.target.value;
    applyColorDebounced();
  });
  document.getElementById('np-color2').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-hex2').textContent = e.target.value;
    applyColorDebounced();
  });
  document.getElementById('np-angle').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-angle-val').textContent = e.target.value;
    applyColorDebounced();
  });
  document.getElementById('np-opacity').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-opacity-val').textContent = e.target.value;
    applyOpacityDebounced();
  });

  // ── Form tab ──
  document.getElementById('np-type').addEventListener('change', () => {
    ensureSnapshot();
    applyType();
  });
  document.getElementById('np-border-color').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-border-hex').textContent = e.target.value;
    applyBorder();
  });
  document.getElementById('np-width').addEventListener('input', () => {
    ensureSnapshot();
    applySize();
  });
  document.getElementById('np-height').addEventListener('input', () => {
    ensureSnapshot();
    applySize();
  });

  // ── Font tab ──
  const fontList = document.getElementById('np-font-list');
  FONTS.forEach(f => {
    const opt = document.createElement('div');
    opt.className = 'font-option';
    opt.textContent = f.name;
    opt.style.fontFamily = f.family;
    opt.dataset.family = f.family;
    opt.addEventListener('click', () => {
      ensureSnapshot();
      fontList.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      applyFont();
    });
    fontList.appendChild(opt);
  });

  document.getElementById('np-fsize').addEventListener('input', (e) => {
    ensureSnapshot();
    document.getElementById('np-fsize-val').textContent = e.target.value;
    applyFontDebounced();
  });
  document.getElementById('np-fweight').addEventListener('change', () => {
    ensureSnapshot();
    applyFont();
  });
}

function ensureSnapshot() {
  if (!_snapshotTaken) {
    saveSnapshot();
    _snapshotTaken = true;
  }
}

function getNode() {
  return currentNodeId != null ? nodeIndex.get(currentNodeId) : null;
}

function render() {
  document.dispatchEvent(new CustomEvent('editor:render'));
}

/** Coalesce rapid input events (sliders, color pickers) to 1 render per frame */
let _renderRAF = null;
function debouncedRender() {
  if (_renderRAF) return;
  _renderRAF = requestAnimationFrame(() => {
    _renderRAF = null;
    render();
  });
}

// ── Apply handlers ──

function applyColor() {
  const n = getNode();
  if (!n) return;
  n.color = document.getElementById('np-color1').value;
  n.color2 = document.getElementById('np-color2').value;
  n.gradAngle = parseInt(document.getElementById('np-angle').value, 10);
  updateGradPreview();
  render();
}

function applyColorDebounced() {
  const n = getNode();
  if (!n) return;
  n.color = document.getElementById('np-color1').value;
  n.color2 = document.getElementById('np-color2').value;
  n.gradAngle = parseInt(document.getElementById('np-angle').value, 10);
  updateGradPreview();
  debouncedRender();
}

function applyOpacity() {
  const n = getNode();
  if (!n) return;
  n.opacity = parseInt(document.getElementById('np-opacity').value, 10) / 100;
  render();
}

function applyOpacityDebounced() {
  const n = getNode();
  if (!n) return;
  n.opacity = parseInt(document.getElementById('np-opacity').value, 10) / 100;
  debouncedRender();
}

function applyType() {
  const n = getNode();
  if (!n) return;
  const newType = document.getElementById('np-type').value;
  if (newType === n.type) return;
  n.type = newType;
  // Set sensible defaults for new type
  if (newType === 'sticky' && !n.width) { n.width = 160; n.height = 120; }
  if (newType === 'circle' && !n.width) { n.width = 100; n.height = 100; }
  if (newType === 'rect' && !n.width) { n.width = 140; n.height = 80; }
  if (newType === 'sticky' && !n.color) { n.color = '#fef08a'; }
  // Sync form inputs with new defaults
  document.getElementById('np-width').value = n.width || '';
  document.getElementById('np-height').value = n.height || '';
  rebuildIndex();
  render();
}

function applyBorder() {
  const n = getNode();
  if (!n) return;
  n.borderColor = document.getElementById('np-border-color').value;
  render();
}

function applySize() {
  const n = getNode();
  if (!n) return;
  const w = parseInt(document.getElementById('np-width').value, 10);
  const h = parseInt(document.getElementById('np-height').value, 10);
  if (w && w >= 40) n.width = w;
  if (h && h >= 30) n.height = h;
  // Keep circle square
  if (n.type === 'circle' && w) n.height = w;
  render();
}

function applyFont() {
  const n = getNode();
  if (!n) return;
  const activeFont = document.querySelector('#np-font-list .font-option.active');
  if (activeFont) n.font = activeFont.dataset.family;
  n.fontSize = parseInt(document.getElementById('np-fsize').value, 10);
  n.fontWeight = parseInt(document.getElementById('np-fweight').value, 10);
  render();
}

function applyFontDebounced() {
  const n = getNode();
  if (!n) return;
  const activeFont = document.querySelector('#np-font-list .font-option.active');
  if (activeFont) n.font = activeFont.dataset.family;
  n.fontSize = parseInt(document.getElementById('np-fsize').value, 10);
  n.fontWeight = parseInt(document.getElementById('np-fweight').value, 10);
  debouncedRender();
}

function updateGradPreview() {
  const c1 = document.getElementById('np-color1').value;
  const c2 = document.getElementById('np-color2').value;
  const angle = document.getElementById('np-angle').value;
  document.getElementById('np-grad-preview').style.background =
    `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}

// ── Show / Hide ──

export function showNodePopup(nodeId) {
  const n = nodeIndex.get(nodeId);
  if (!n) return;

  currentNodeId = nodeId;
  _snapshotTaken = false;

  // Populate Color tab
  const c1 = n.color || '#6c8aff';
  const c2 = n.color2 || c1;
  document.getElementById('np-color1').value = c1;
  document.getElementById('np-color2').value = c2;
  document.getElementById('np-hex1').textContent = c1;
  document.getElementById('np-hex2').textContent = c2;
  document.getElementById('np-angle').value = n.gradAngle || 135;
  document.getElementById('np-angle-val').textContent = n.gradAngle || 135;
  const opacityPct = n.opacity != null ? Math.round(n.opacity * 100) : 100;
  document.getElementById('np-opacity').value = opacityPct;
  document.getElementById('np-opacity-val').textContent = opacityPct;
  updateGradPreview();

  // Mark active swatch
  popup.querySelectorAll('#np-swatches .color-swatch').forEach(s => {
    s.classList.toggle('active', s.style.background === c1 ||
      rgbToHex(s.style.background) === c1.toLowerCase());
  });

  // Populate Form tab
  document.getElementById('np-type').value = n.type || 'rect';
  document.getElementById('np-border-color').value = n.borderColor || '#d0d0dd';
  document.getElementById('np-border-hex').textContent = n.borderColor || '#d0d0dd';
  document.getElementById('np-width').value = n.width || '';
  document.getElementById('np-height').value = n.height || '';

  // Populate Font tab
  const fontList = document.getElementById('np-font-list');
  fontList.querySelectorAll('.font-option').forEach(opt => {
    opt.classList.toggle('active', n.font && opt.dataset.family === n.font);
  });
  document.getElementById('np-fsize').value = n.fontSize || 13;
  document.getElementById('np-fsize-val').textContent = n.fontSize || 13;
  document.getElementById('np-fweight').value = n.fontWeight || 400;

  // Position near node (top-right corner, clamped to viewport)
  const nodesLayer = document.getElementById('nodes-layer');
  const el = nodesLayer.querySelector(`[data-id="${nodeId}"]`);
  if (el) {
    const rect = el.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;
    // Clamp to viewport
    if (left + 270 > window.innerWidth) left = rect.left - 272;
    if (left < 8) left = 8;
    if (top + 400 > window.innerHeight) top = window.innerHeight - 400;
    if (top < 8) top = 8;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  popup.classList.add('open');
}

export function hideNodePopup() {
  popup.classList.remove('open');
  currentNodeId = null;
  _snapshotTaken = false;
}

export function repositionNodePopup() {
  if (!popup.classList.contains('open') || currentNodeId == null) return;
  const el = document.getElementById('nodes-layer').querySelector(`[data-id="${currentNodeId}"]`);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  let left = rect.right + 12;
  let top = rect.top;
  if (left + 270 > window.innerWidth) left = rect.left - 272;
  if (left < 8) left = 8;
  if (top + 400 > window.innerHeight) top = window.innerHeight - 400;
  if (top < 8) top = 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

// Helper: convert rgb(r,g,b) → #hex
function rgbToHex(rgb) {
  if (!rgb || rgb.startsWith('#')) return rgb;
  const m = rgb.match(/(\d+)/g);
  if (!m || m.length < 3) return rgb;
  return '#' + m.slice(0, 3).map(v => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
}
