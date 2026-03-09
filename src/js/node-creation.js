/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-09
 */
/**
 * node-creation.js — Node creation logic extracted from interactions.js
 *
 * Handles tool-specific node creation (sector, company, sticky, shape).
 * Also contains the variant picker UI popup.
 */
import { state, genId, saveSnapshot, rebuildIndex, emit } from './state.js';
import { snapToGrid } from './utils.js';
import { showGradientPopup, overrideGradApply } from './gradient-popup.js';
import { STICKY_COLORS } from './constants.js';
import { runForceLayout } from './force-layout.js';

/**
 * Handle node creation when a tool is active and canvas is clicked.
 * @param {string} tool - The active tool ('sector', 'company', 'sticky', 'shape')
 * @param {{x: number, y: number}} cp - Canvas-space click coordinates
 * @param {MouseEvent} e - The original mouse event
 * @param {function} editNodeLabel - Callback to start label editing
 * @returns {boolean} true if a creation action was handled
 */
export function handleToolCreation(tool, cp, e, editNodeLabel) {
  if (tool === 'sector') {
    createSector(cp, e, editNodeLabel);
    return true;
  }
  if (tool === 'company') {
    createCompanyOrText(cp, e, editNodeLabel);
    return true;
  }
  if (tool === 'sticky') {
    createSticky(cp, editNodeLabel);
    return true;
  }
  if (tool === 'shape') {
    createShape(cp, e, editNodeLabel);
    return true;
  }
  return false;
}

function createSector(cp, e, editNodeLabel) {
  showGradientPopup(e.clientX, e.clientY, ['__new__']);
  const cpCopy = { ...cp };
  overrideGradApply(() => {
    saveSnapshot();
    const c1 = document.getElementById('grad-color1').value;
    const c2 = document.getElementById('grad-color2').value;
    const angle = parseInt(document.getElementById('grad-angle').value, 10);
    const node = { id: genId(), type: 'sector', x: snapToGrid(cpCopy.x), y: snapToGrid(cpCopy.y), label: 'Neuer Sektor', color: c1, color2: c2, gradAngle: angle };
    state.nodes.push(node);
    rebuildIndex();
    emit('render');
    if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
    setTimeout(() => editNodeLabel(node.id), 100);
  });
}

function createCompanyOrText(cp, e, editNodeLabel) {
  showCreationPicker(e.clientX, e.clientY, [
    { type: 'company', label: 'Eintrag', icon: '<circle cx="5" cy="12" r="3" fill="currentColor" stroke="none"/><line x1="11" y1="12" x2="22" y2="12"/>' },
    { type: 'textbox', label: 'Nur Text', icon: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>' },
  ], (variant) => {
    saveSnapshot();
    let nearestSector = null, minDist = Infinity;
    state.nodes.filter(n => n.type === 'sector' || n.type === 'center').forEach(s => {
      const d = Math.hypot(cp.x - s.x, cp.y - s.y);
      if (d < minDist) { minDist = d; nearestSector = s; }
    });
    const pos = { x: snapToGrid(cp.x), y: snapToGrid(cp.y) };
    let node;
    if (variant === 'textbox') {
      node = { id: genId(), type: 'textbox', x: pos.x, y: pos.y, label: '' };
    } else {
      node = { id: genId(), type: 'company', x: pos.x, y: pos.y, label: 'Neuer Eintrag', color: nearestSector ? nearestSector.color : '#6c8aff' };
    }
    state.nodes.push(node);
    if (nearestSector && minDist < 600) {
      state.connections.push({ id: genId(), from: nearestSector.id, to: node.id, color: nearestSector.color });
    }
    rebuildIndex();
    emit('render');
    if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
    setTimeout(() => editNodeLabel(node.id), 100);
  });
}

function createSticky(cp, editNodeLabel) {
  saveSnapshot();
  const node = { id: genId(), type: 'sticky', x: snapToGrid(cp.x), y: snapToGrid(cp.y), label: '', color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], width: 160, height: 120 };
  state.nodes.push(node);
  rebuildIndex();
  emit('render');
  if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
  setTimeout(() => editNodeLabel(node.id), 100);
}

function createShape(cp, e, editNodeLabel) {
  showCreationPicker(e.clientX, e.clientY, [
    { type: 'rect', label: 'Rechteck', icon: '<rect x="4" y="6" width="16" height="12" rx="2"/>' },
    { type: 'circle', label: 'Kreis', icon: '<circle cx="12" cy="12" r="8"/>' },
    { type: 'textbox', label: 'Textbox', icon: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>' },
  ], (shapeType) => {
    saveSnapshot();
    const w = shapeType === 'circle' ? 100 : (shapeType === 'textbox' ? null : 140);
    const h = shapeType === 'circle' ? 100 : (shapeType === 'textbox' ? null : 80);
    const node = { id: genId(), type: shapeType, x: snapToGrid(cp.x), y: snapToGrid(cp.y), label: '', color: null, borderColor: null, width: w, height: h };
    state.nodes.push(node);
    rebuildIndex();
    emit('render');
    if (state.physicsLayout) setTimeout(() => runForceLayout({ alpha: 0.5 }), 50);
    setTimeout(() => editNodeLabel(node.id), 100);
  });
}

// ─── Creation Variant Picker ───

let pickerCleanup = null;

export function showCreationPicker(screenX, screenY, variants, onPick) {
  const popup = document.getElementById('quick-add-popup');
  if (!popup) { onPick(variants[0].type); return; }

  popup.innerHTML = variants.map(v =>
    `<button class="quick-add-btn" data-variant="${v.type}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${v.icon}</svg>
      ${v.label}
    </button>`
  ).join('');

  const pw = 200, ph = 44;
  popup.style.left = Math.min(screenX, window.innerWidth - pw - 8) + 'px';
  popup.style.top = Math.min(screenY, window.innerHeight - ph - 8) + 'px';
  popup.classList.add('open');

  if (pickerCleanup) pickerCleanup();

  function onClick(e) {
    const btn = e.target.closest('[data-variant]');
    if (!btn) return;
    e.stopPropagation();
    hide();
    onPick(btn.dataset.variant);
  }
  function onOutside(e) { if (!popup.contains(e.target)) hide(); }
  function onKey(e) { if (e.key === 'Escape') hide(); }

  function hide() {
    popup.classList.remove('open');
    if (pickerCleanup) { pickerCleanup(); pickerCleanup = null; }
  }

  popup.addEventListener('click', onClick);
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey);

  pickerCleanup = () => {
    popup.removeEventListener('click', onClick);
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
  };
}
