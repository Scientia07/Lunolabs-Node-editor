// ─── Mouse Interactions ───
import { state, nodeIndex, genId, saveSnapshot, rebuildIndex, emit } from './state.js';
import { screenToCanvas, snapToGrid } from './utils.js';
import { renderConnections, getConnectionEndpoints, getNodeCenter, getNodeAnchorPoint, renderSelectionState, getNodesLayer, getSvgLayer, domCache } from './renderer.js';
import { updateTransform } from './transform.js';
import { updateMinimap } from './minimap.js';
import { autoSave } from './persistence.js';
import { closeMenus } from './context-menu.js';
import { showNodePopup, hideNodePopup, repositionNodePopup } from './node-popup.js';
import { showQuickAdd } from './quick-add.js';
import { showConnPopup, hideConnPopup } from './conn-popup.js';
import { pinNode, isLayoutRunning, runForceLayout } from './force-layout.js';
import { handleToolCreation } from './node-creation.js';

let isDragging = false, isPanning = false, isSelecting = false, isResizing = false;
let isDraggingEndpoint = false;
let popupJustOpened = false;
let dragStartX = 0, dragStartY = 0;
let dragOffsets = [];
let spaceHeld = false;
let connectTempLine = null;
let connectFromAnchor = null;
let endpointDrag = null; // { connId, end ('from'|'to'), tempLine }
// P2: RAF-gate mousemove — cap at 60fps instead of 120+ Hz
let rafPending = false;

export function initInteractions() {
  const canvasContainer = document.getElementById('canvas-container');
  const selRect = document.getElementById('selection-rect');

  canvasContainer.addEventListener('mousedown', (e) => onMouseDown(e, canvasContainer, selRect));
  // Bind mousemove/mouseup on document so drags work even when cursor leaves canvas (e.g. over sidebar)
  document.addEventListener('mousemove', (e) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      onMouseMove(e, canvasContainer, selRect);
    });
  });
  document.addEventListener('mouseup', (e) => onMouseUp(e, canvasContainer, selRect));
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
    if (!e.target.closest('.color-popup') && !e.target.closest('.popup-panel') && !e.target.closest('.node-popup') && !e.target.closest('.ctx-item')) {
      // Don't close popups that were just opened this frame (e.g. sector tool opens gradient popup on mousedown)
      if (!popupJustOpened) {
        document.getElementById('color-popup')?.classList.remove('open');
        document.getElementById('gradient-popup')?.classList.remove('open');
      }
    }
    popupJustOpened = false;
    if (!e.target.closest('.dropdown-wrap')) {
      document.getElementById('shapes-dropdown').classList.remove('open');
      document.getElementById('export-dropdown').classList.remove('open');
      document.getElementById('import-dropdown').classList.remove('open');
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

  // Don't intercept clicks inside contenteditable labels (sticky note editing)
  if (e.target.closest('[contenteditable="true"]')) return;

  if (e.button === 1 || (e.button === 0 && spaceHeld)) {
    isPanning = true;
    dragStartX = e.clientX - state.panX;
    dragStartY = e.clientY - state.panY;
    canvasContainer.classList.add('panning');
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;

  // Check for endpoint handle drag on selected connection
  const endpointEl = e.target.closest('.conn-endpoint');
  if (endpointEl) {
    const connId = parseInt(endpointEl.dataset.connId, 10);
    const end = endpointEl.dataset.end; // 'from' or 'to'
    const conn = state.connections.find(c => c.id === connId);
    if (conn) {
      isDraggingEndpoint = true;
      saveSnapshot();
      const svgLayer = getSvgLayer();
      const cp = screenToCanvas(e.clientX, e.clientY);
      const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.setAttribute('x1', cp.x);
      tempLine.setAttribute('y1', cp.y);
      tempLine.setAttribute('x2', cp.x);
      tempLine.setAttribute('y2', cp.y);
      tempLine.setAttribute('stroke', conn.color || '#6c8aff');
      tempLine.setAttribute('stroke-width', '2');
      tempLine.setAttribute('stroke-dasharray', '6,4');
      tempLine.setAttribute('stroke-opacity', '0.7');
      svgLayer.appendChild(tempLine);
      endpointDrag = { connId, end, conn, tempLine };
      e.preventDefault();
    }
    return;
  }

  // Check for click on connection line/path to select it (includes hit areas)
  const connEl = e.target.closest('path[data-id]') || e.target.closest('line[data-id]');
  if (connEl && !connEl.classList.contains('conn-endpoint') && !connEl.classList.contains('conn-endpoint-ring')) {
    const connId = parseInt(connEl.dataset.id, 10);
    state.selectedConnId = (state.selectedConnId === connId) ? null : connId;
    state.selectedIds.clear();
    hideNodePopup();
    if (state.selectedConnId !== null) {
      showConnPopup(state.selectedConnId);
    } else {
      hideConnPopup();
    }
    renderSelectionState();
    renderConnections();
    e.preventDefault();
    return;
  }

  const target = e.target.closest('.node');
  const anchor = e.target.closest('.anchor');
  const resizeH = e.target.closest('.resize-handle');
  const cp = screenToCanvas(e.clientX, e.clientY);

  if (anchor && target) { startConnection(parseInt(target.dataset.id, 10), e, anchor.dataset.anchor); return; }

  if (resizeH && target) {
    isResizing = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffsets = [{ id: parseInt(target.dataset.id, 10), origW: target.offsetWidth, origH: target.offsetHeight }];
    saveSnapshot();
    e.preventDefault();
    return;
  }

  if (state.tool === 'connect' && target) {
    const anchorEl = e.target.closest('.anchor');
    startConnection(parseInt(target.dataset.id, 10), e, anchorEl?.dataset.anchor || null);
    return;
  }

  if (target && (state.tool === 'select' || state.tool === 'connect')) {
    const nid = parseInt(target.dataset.id, 10);
    if (e.shiftKey) {
      state.selectedIds.has(nid) ? state.selectedIds.delete(nid) : state.selectedIds.add(nid);
    } else if (!state.selectedIds.has(nid)) {
      state.selectedIds.clear();
      state.selectedIds.add(nid);
    }
    renderSelectionState();
    renderConnections(); // Re-render to show focus effect on sector/center connections

    // Hide connection popup when selecting nodes
    hideConnPopup();
    // Show/hide node popup based on selection count
    if (state.selectedIds.size === 1) {
      const selectedId = [...state.selectedIds][0];
      showNodePopup(selectedId);
    } else {
      hideNodePopup();
    }

    isDragging = true;
    dragStartX = cp.x;
    dragStartY = cp.y;
    dragOffsets = [];
    state.selectedIds.forEach(id => {
      const n = nodeIndex.get(id);
      if (n) dragOffsets.push({ id, ox: n.x - cp.x, oy: n.y - cp.y });
    });
    saveSnapshot();
    // Pin dragged nodes in force layout
    state.selectedIds.forEach(id => pinNode(id));
    e.preventDefault();
    return;
  }

  if (!target) {
    if (handleToolCreation(state.tool, cp, e, editNodeLabel)) {
      if (state.tool === 'sector') popupJustOpened = true;
      return;
    }

    // Deselect connection when clicking empty canvas
    if (state.selectedConnId !== null) {
      state.selectedConnId = null;
      hideConnPopup();
      renderConnections();
    }

    if (state.tool === 'select') {
      if (!e.shiftKey) state.selectedIds.clear();
      renderSelectionState();
      renderConnections(); // Clear focus effect
      hideNodePopup();
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
  if (isDraggingEndpoint && endpointDrag) {
    const cp = screenToCanvas(e.clientX, e.clientY);
    // Update temp line to cursor
    const conn = endpointDrag.conn;
    const pts = getConnectionEndpoints(conn);
    if (pts) {
      if (endpointDrag.end === 'from') {
        endpointDrag.tempLine.setAttribute('x1', cp.x);
        endpointDrag.tempLine.setAttribute('y1', cp.y);
        endpointDrag.tempLine.setAttribute('x2', pts.tc.x);
        endpointDrag.tempLine.setAttribute('y2', pts.tc.y);
      } else {
        endpointDrag.tempLine.setAttribute('x1', pts.fc.x);
        endpointDrag.tempLine.setAttribute('y1', pts.fc.y);
        endpointDrag.tempLine.setAttribute('x2', cp.x);
        endpointDrag.tempLine.setAttribute('y2', cp.y);
      }
    }
    // Highlight nearest anchor on hover
    highlightNearestAnchor(e.clientX, e.clientY);
    return;
  }

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
      const el = domCache.get(d.id);
      if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
    });
    renderConnections();
    updateMinimap();
    repositionNodePopup();
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
      if (node.type === 'circle') {
        // Circle: keep aspect ratio (width = height)
        node.height = node.width;
      } else {
        node.height = Math.max(60, d.origH + (e.clientY - dragStartY) / state.zoom);
      }
      const el = domCache.get(d.id);
      if (el) {
        el.style.width = node.width + 'px';
        el.style.minHeight = node.height + 'px';
        el.style.height = node.height + 'px';
        if (node.type === 'circle') { el.style.minWidth = node.width + 'px'; }
      }
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
  if (isPanning) { isPanning = false; canvasContainer.classList.remove('panning'); autoSave(); return; }
  if (isDragging) {
    isDragging = false;
    autoSave();
    if (state.physicsLayout && !isLayoutRunning()) {
      runForceLayout({ alpha: 0.3 });
    }
    return;
  }
  if (isResizing) { isResizing = false; autoSave(); return; }

  if (isDraggingEndpoint && endpointDrag) {
    isDraggingEndpoint = false;
    if (endpointDrag.tempLine) endpointDrag.tempLine.remove();
    clearAnchorHighlights();

    // Find which node+anchor we landed on (prevent self-loops)
    const result = findNearestAnchor(e.clientX, e.clientY);
    if (result) {
      const conn = endpointDrag.conn;
      const otherId = endpointDrag.end === 'from' ? conn.to : conn.from;
      if (result.nodeId !== otherId) {
        if (endpointDrag.end === 'from') {
          conn.from = result.nodeId;
          conn.fromAnchor = result.anchor;
        } else {
          conn.to = result.nodeId;
          conn.toAnchor = result.anchor;
        }
      }
    }
    endpointDrag = null;
    renderConnections();
    autoSave();
    return;
  }

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
        const el = domCache.get(n.id);
        if (!el) return;
        const cx = n.x + el.offsetWidth / 2;
        const cy = n.y + el.offsetHeight / 2;
        if (cx >= tl.x && cx <= br.x && cy >= tl.y && cy <= br.y) state.selectedIds.add(n.id);
      });
      renderSelectionState();
      // Show popup only if exactly 1 node selected by rubber-band
      if (state.selectedIds.size === 1) {
        showNodePopup([...state.selectedIds][0]);
      } else {
        hideNodePopup();
      }
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
          const toAnchor = e.target.closest('.anchor')?.dataset.anchor || null;
          const conn = { id: genId(), from: state.connectingFrom, to: toId, color: state.connectionColor };
          if (connectFromAnchor) conn.fromAnchor = connectFromAnchor;
          if (toAnchor) conn.toAnchor = toAnchor;
          state.connections.push(conn);
          renderConnections();
          autoSave();
        }
      }
    } else {
      // Dragged to empty canvas — show quick-add popup
      const cp = screenToCanvas(e.clientX, e.clientY);
      showQuickAdd(e.clientX, e.clientY, cp, state.connectingFrom, connectFromAnchor);
    }
    state.connectingFrom = null;
    connectFromAnchor = null;
  }
}

function startConnection(fromId, e, anchorPos) {
  state.connectingFrom = fromId;
  connectFromAnchor = anchorPos || null;
  const fromNode = nodeIndex.get(fromId);
  const fc = anchorPos ? getNodeAnchorPoint(fromNode, anchorPos) : getNodeCenter(fromNode);
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
  const nodeEl = domCache.get(id);
  const el = nodeEl?.querySelector('.node-label');
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

// ─── Endpoint Drag Helpers ───

const ANCHOR_SNAP_DIST = 40; // max distance in screen pixels to snap to an anchor

// Find the nearest anchor on any node within snap distance
function findNearestAnchor(screenX, screenY) {
  const cp = screenToCanvas(screenX, screenY);
  let best = null, bestDist = Infinity;

  for (const n of state.nodes) {
    for (const pos of ['top', 'bottom', 'left', 'right']) {
      const pt = getNodeAnchorPoint(n, pos);
      const d = Math.hypot(cp.x - pt.x, cp.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = { nodeId: n.id, anchor: pos, pt };
      }
    }
  }

  // Also consider node centers (no specific anchor)
  for (const n of state.nodes) {
    const ct = getNodeCenter(n);
    const d = Math.hypot(cp.x - ct.x, cp.y - ct.y);
    if (d < bestDist) {
      bestDist = d;
      best = { nodeId: n.id, anchor: null, pt: ct };
    }
  }

  const snapDist = ANCHOR_SNAP_DIST / state.zoom;
  return bestDist <= snapDist ? best : null;
}

// Highlight the nearest anchor dot while dragging
function highlightNearestAnchor(screenX, screenY) {
  clearAnchorHighlights();
  const result = findNearestAnchor(screenX, screenY);
  if (!result) return;

  const cachedNode = domCache.get(result.nodeId);
  if (!cachedNode) return;
  if (result.anchor) {
    const anchorEl = cachedNode.querySelector(`.anchor-${result.anchor}`);
    if (anchorEl) anchorEl.classList.add('anchor-highlight');
  } else {
    cachedNode.classList.add('drop-target');
  }
}

function clearAnchorHighlights() {
  const nodesLayer = getNodesLayer();
  nodesLayer.querySelectorAll('.anchor-highlight').forEach(el => el.classList.remove('anchor-highlight'));
  nodesLayer.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
}
