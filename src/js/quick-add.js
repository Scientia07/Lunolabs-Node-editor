/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
// ─── Quick-Add Popup (drag-to-create from anchor) ───
import { state, nodeIndex, genId, saveSnapshot, rebuildIndex, emit } from './state.js';
import { snapToGrid } from './utils.js';
import { autoSave } from './persistence.js';
import { editNodeLabel } from './interactions.js';
import { renderConnections } from './renderer.js';

let popup = null;
let cleanup = null;

export function initQuickAdd() {
  popup = document.getElementById('quick-add-popup');
}

export function showQuickAdd(screenX, screenY, canvasPos, fromId, fromAnchor) {
  if (!popup) return;

  // Rebuild content (may have been replaced by creation picker)
  popup.innerHTML = `
    <button class="quick-add-btn" data-type="sector">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      Sektor
    </button>
    <button class="quick-add-btn" data-type="company">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
      Eintrag
    </button>`;

  // Position popup at cursor, clamped to viewport
  const pw = 200, ph = 44;
  const x = Math.min(screenX, window.innerWidth - pw - 8);
  const y = Math.min(screenY, window.innerHeight - ph - 8);
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.classList.add('open');

  // Clean up previous listeners
  if (cleanup) cleanup();

  const fromNode = nodeIndex.get(fromId);

  function create(type) {
    saveSnapshot();
    const pos = { x: snapToGrid(canvasPos.x), y: snapToGrid(canvasPos.y) };
    let node;
    if (type === 'sector') {
      node = { id: genId(), type: 'sector', x: pos.x, y: pos.y, label: 'Neuer Sektor', color: '#6c8aff', color2: '#a78bfa', gradAngle: 135 };
    } else {
      node = { id: genId(), type: 'company', x: pos.x, y: pos.y, label: 'Neuer Eintrag', color: fromNode ? fromNode.color : '#6c8aff' };
    }
    state.nodes.push(node);

    // Auto-connect back to source
    const conn = { id: genId(), from: fromId, to: node.id, color: fromNode ? fromNode.color : '#6c8aff' };
    if (fromAnchor) conn.fromAnchor = fromAnchor;
    state.connections.push(conn);

    rebuildIndex();
    emit('render');
    renderConnections();
    autoSave();
    setTimeout(() => editNodeLabel(node.id), 100);
    hide();
  }

  function onBtn(e) {
    const btn = e.target.closest('.quick-add-btn');
    if (!btn) return;
    e.stopPropagation();
    create(btn.dataset.type);
  }

  function onOutside(e) {
    if (!popup.contains(e.target)) hide();
  }

  function onKey(e) {
    if (e.key === 'Escape') hide();
  }

  function hide() {
    popup.classList.remove('open');
    if (cleanup) { cleanup(); cleanup = null; }
  }

  popup.addEventListener('click', onBtn);
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey);

  cleanup = () => {
    popup.removeEventListener('click', onBtn);
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
  };
}
