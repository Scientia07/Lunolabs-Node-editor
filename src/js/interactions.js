/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Mouse Interactions ───
import { state, nodeIndex, genId, saveSnapshot, rebuildIndex } from './state.js';
import { screenToCanvas, snapToGrid } from './utils.js';
import { renderConnections, getNodeCenter, renderSelectionState, getNodesLayer, getSvgLayer } from './renderer.js';
import { updateTransform } from './transform.js';
import { updateMinimap } from './minimap.js';
import { autoSave } from './persistence.js';
import { closeMenus } from './context-menu.js';
import { showColorPopup } from './color-popup.js';
import { showGradientPopup, overrideGradApply } from './gradient-popup.js';
import { STICKY_COLORS } from './constants.js';

let isDragging = false, isPanning = false, isSelecting = false, isResizing = false;
let _popupJustOpened = false;
let dragStartX = 0, dragStartY = 0;
let dragOffsets = [];
let spaceHeld = false;
let connectTempLine = null;
let fullRenderFn;

export function initInteractions(fullRender) {
  fullRenderFn = fullRender;
  const canvasContainer = document.getElementById('canvas-container');
  const selRect = document.getElementById('selection-rect');

  canvasContainer.addEventListener('mousedown', (e) => onMouseDown(e, canvasContainer, selRect));
  canvasContainer.addEventListener('mousemove', (e) => onMouseMove(e, canvasContainer, selRect));
  canvasContainer.addEventListener('mouseup', (e) => onMouseUp(e, canvasContainer, selRect));
  canvasContainer.addEventListener('dblclick', (e) => {
    const target = e.target.closest('.node');
    if (target) { editNodeLabel(parseInt(target.dataset.id, 10)); e.preventDefault(); }
  });
  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { zoomTo } = require_zoomTo();
    zoomTo(state.zoom * (e.deltaY > 0 ? 0.92 : 1.08), e.clientX, e.clientY);
  }, { passive: false });

  // Close menus on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
      document.getElementById('context-menu').classList.remove('open');
    }
    if (!e.target.closest('.color-popup') && !e.target.closest('.popup-panel') && !e.target.closest('.ctx-item')) {
      // Don't close popups that were just opened this frame (e.g. sector tool opens gradient popup on mousedown)
      if (!_popupJustOpened) {
        document.getElementById('color-popup')?.classList.remove('open');
        document.getElementById('gradient-popup')?.classList.remove('open');
        document.getElementById('font-popup')?.classList.remove('open');
      }
    }
    _popupJustOpened = false;
    if (!e.target.closest('.dropdown-wrap')) {
      document.getElementById('shapes-dropdown').classList.remove('open');
      document.getElementById('export-dropdown').classList.remove('open');
    }
  });
}

// Lazy import to avoid circular dependency
function require_zoomTo() {
  // This works because by the time it's called, all modules are loaded
  return { zoomTo: _zoomToRef };
}
let _zoomToRef;
export function setZoomToRef(fn) { _zoomToRef = fn; }

export function isSpaceHeld() { return spaceHeld; }
export function setSpaceHeld(v) { spaceHeld = v; }

function onMouseDown(e, canvasContainer, selRect) {
  closeMenus();

  if (e.button === 1 || (e.button === 0 && spaceHeld)) {
    isPanning = true;
    dragStartX = e.clientX - state.panX;
    dragStartY = e.clientY - state.panY;
    canvasContainer.classList.add('panning');
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;

  const target = e.target.closest('.node');
  const anchor = e.target.closest('.anchor');
  const resizeH = e.target.closest('.resize-handle');
  const cp = screenToCanvas(e.clientX, e.clientY);

  if (anchor && target) { startConnection(parseInt(target.dataset.id, 10), e); return; }

  if (resizeH && target) {
    isResizing = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffsets = [{ id: parseInt(target.dataset.id, 10), origW: target.offsetWidth, origH: target.offsetHeight }];
    saveSnapshot();
    e.preventDefault();
    return;
  }

  if (state.tool === 'connect' && target) { startConnection(parseInt(target.dataset.id, 10), e); return; }

  if (target && (state.tool === 'select' || state.tool === 'connect')) {
    const nid = parseInt(target.dataset.id, 10);
    if (e.shiftKey) {
      state.selectedIds.has(nid) ? state.selectedIds.delete(nid) : state.selectedIds.add(nid);
    } else if (!state.selectedIds.has(nid)) {
      state.selectedIds.clear();
      state.selectedIds.add(nid);
    }
    renderSelectionState();

    isDragging = true;
    dragStartX = cp.x;
    dragStartY = cp.y;
    dragOffsets = [];
    state.selectedIds.forEach(id => {
      const n = nodeIndex.get(id);
      if (n) dragOffsets.push({ id, ox: n.x - cp.x, oy: n.y - cp.y });
    });
    saveSnapshot();
    e.preventDefault();
    return;
  }

  if (!target) {
    if (state.tool === 'sector') {
      // Use gradient popup for new sector
      _popupJustOpened = true;
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
        fullRenderFn();
        setTimeout(() => editNodeLabel(node.id), 100);
      });
      return;
    }

    if (state.tool === 'company') {
      saveSnapshot();
      let nearestSector = null, minDist = Infinity;
      state.nodes.filter(n => n.type === 'sector' || n.type === 'center').forEach(s => {
        const d = Math.hypot(cp.x - s.x, cp.y - s.y);
        if (d < minDist) { minDist = d; nearestSector = s; }
      });
      const node = { id: genId(), type: 'company', x: snapToGrid(cp.x), y: snapToGrid(cp.y), label: 'Neuer Eintrag', color: nearestSector ? nearestSector.color : '#6c8aff' };
      state.nodes.push(node);
      if (nearestSector && minDist < 600) {
        state.connections.push({ id: genId(), from: nearestSector.id, to: node.id, color: nearestSector.color });
      }
      rebuildIndex();
      fullRenderFn();
      setTimeout(() => editNodeLabel(node.id), 100);
      return;
    }

    if (state.tool === 'sticky') {
      saveSnapshot();
      const node = { id: genId(), type: 'sticky', x: snapToGrid(cp.x), y: snapToGrid(cp.y), label: '', color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], width: 160, height: 120 };
      state.nodes.push(node);
      rebuildIndex();
      fullRenderFn();
      setTimeout(() => editNodeLabel(node.id), 100);
      return;
    }

    if (state.tool === 'shape') {
      saveSnapshot();
      const node = { id: genId(), type: state.shapeType, x: snapToGrid(cp.x), y: snapToGrid(cp.y), label: '', color: null, borderColor: null, width: state.shapeType === 'circle' ? 100 : (state.shapeType === 'textbox' ? null : 140), height: state.shapeType === 'circle' ? 100 : (state.shapeType === 'textbox' ? null : 80) };
      state.nodes.push(node);
      rebuildIndex();
      fullRenderFn();
      setTimeout(() => editNodeLabel(node.id), 100);
      return;
    }

    if (state.tool === 'select') {
      if (!e.shiftKey) state.selectedIds.clear();
      renderSelectionState();
      isSelecting = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      selRect.style.left = e.clientX + 'px';
      selRect.style.top = e.clientY + 'px';
      selRect.style.width = '0';
      selRect.style.height = '0';
      selRect.style.display = 'block';
      canvasContainer.classList.add('selecting');
    }
  }
}

function onMouseMove(e, canvasContainer) {
  const nodesLayer = getNodesLayer();

  if (isPanning) {
    state.panX = e.clientX - dragStartX;
    state.panY = e.clientY - dragStartY;
    updateTransform();
    return;
  }

  if (isDragging) {
    const cp = screenToCanvas(e.clientX, e.clientY);
    dragOffsets.forEach(d => {
      const node = nodeIndex.get(d.id);
      if (!node) return;
      node.x = e.altKey ? cp.x + d.ox : snapToGrid(cp.x + d.ox);
      node.y = e.altKey ? cp.y + d.oy : snapToGrid(cp.y + d.oy);
      const el = nodesLayer.querySelector(`[data-id="${d.id}"]`);
      if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
    });
    renderConnections();
    updateMinimap();
    return;
  }

  if (isSelecting) {
    const selRect = document.getElementById('selection-rect');
    selRect.style.left = Math.min(e.clientX, dragStartX) + 'px';
    selRect.style.top = Math.min(e.clientY, dragStartY) + 'px';
    selRect.style.width = Math.abs(e.clientX - dragStartX) + 'px';
    selRect.style.height = Math.abs(e.clientY - dragStartY) + 'px';
    return;
  }

  if (isResizing) {
    const d = dragOffsets[0];
    const node = nodeIndex.get(d.id);
    if (node) {
      node.width = Math.max(80, d.origW + (e.clientX - dragStartX) / state.zoom);
      node.height = Math.max(60, d.origH + (e.clientY - dragStartY) / state.zoom);
      const el = nodesLayer.querySelector(`[data-id="${d.id}"]`);
      if (el) { el.style.width = node.width + 'px'; el.style.minHeight = node.height + 'px'; el.style.height = node.height + 'px'; }
    }
    return;
  }

  if (state.connectingFrom && connectTempLine) {
    const cp = screenToCanvas(e.clientX, e.clientY);
    connectTempLine.setAttribute('x2', cp.x);
    connectTempLine.setAttribute('y2', cp.y);
  }
}

function onMouseUp(e, canvasContainer) {
  const nodesLayer = getNodesLayer();
  if (isPanning) { isPanning = false; canvasContainer.classList.remove('panning'); autoSave(); return; }
  if (isDragging) { isDragging = false; autoSave(); return; }
  if (isResizing) { isResizing = false; autoSave(); return; }

  if (isSelecting) {
    isSelecting = false;
    const selRect = document.getElementById('selection-rect');
    selRect.style.display = 'none';
    canvasContainer.classList.remove('selecting');
    const rx = Math.min(e.clientX, dragStartX);
    const ry = Math.min(e.clientY, dragStartY);
    const rw = Math.abs(e.clientX - dragStartX);
    const rh = Math.abs(e.clientY - dragStartY);
    if (rw > 5 && rh > 5) {
      const tl = screenToCanvas(rx, ry);
      const br = screenToCanvas(rx + rw, ry + rh);
      state.nodes.forEach(n => {
        const el = nodesLayer.querySelector(`[data-id="${n.id}"]`);
        if (!el) return;
        const cx = n.x + el.offsetWidth / 2;
        const cy = n.y + el.offsetHeight / 2;
        if (cx >= tl.x && cx <= br.x && cy >= tl.y && cy <= br.y) state.selectedIds.add(n.id);
      });
      renderSelectionState();
    }
    return;
  }

  if (state.connectingFrom !== null) {
    if (connectTempLine) { connectTempLine.remove(); connectTempLine = null; }
    canvasContainer.classList.remove('connecting');
    const target = e.target.closest('.node');
    if (target) {
      const toId = parseInt(target.dataset.id, 10);
      if (toId !== state.connectingFrom) {
        const exists = state.connections.some(c =>
          (c.from === state.connectingFrom && c.to === toId) ||
          (c.from === toId && c.to === state.connectingFrom)
        );
        if (!exists) {
          saveSnapshot();
          state.connections.push({ id: genId(), from: state.connectingFrom, to: toId, color: state.connectionColor });
          renderConnections();
          autoSave();
        }
      }
    }
    state.connectingFrom = null;
  }
}

function startConnection(fromId, e) {
  state.connectingFrom = fromId;
  const fromNode = nodeIndex.get(fromId);
  const fc = getNodeCenter(fromNode);
  const svgLayer = getSvgLayer();
  connectTempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  connectTempLine.setAttribute('x1', fc.x);
  connectTempLine.setAttribute('y1', fc.y);
  connectTempLine.setAttribute('x2', fc.x);
  connectTempLine.setAttribute('y2', fc.y);
  connectTempLine.setAttribute('stroke', state.connectionColor);
  connectTempLine.setAttribute('stroke-width', '2');
  connectTempLine.setAttribute('stroke-dasharray', '6,4');
  connectTempLine.setAttribute('stroke-opacity', '0.7');
  svgLayer.appendChild(connectTempLine);
  document.getElementById('canvas-container').classList.add('connecting');
  e.preventDefault();
}

export function editNodeLabel(id) {
  const nodesLayer = getNodesLayer();
  const el = nodesLayer.querySelector(`[data-id="${id}"] .node-label`);
  if (!el) return;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = () => {
    el.setAttribute('contenteditable', 'false');
    const node = nodeIndex.get(id);
    if (node) { node.label = el.textContent.trim(); autoSave(); }
    el.removeEventListener('blur', finish);
    el.removeEventListener('keydown', onKey);
  };
  const onKey = (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
    if (ev.key === 'Escape') el.blur();
    ev.stopPropagation();
  };
  el.addEventListener('blur', finish);
  el.addEventListener('keydown', onKey);
}
