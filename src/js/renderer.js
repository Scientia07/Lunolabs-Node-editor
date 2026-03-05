/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Node & Connection Rendering ───
import { state, nodeIndex } from './state.js';
import { getContrastColor, getGradientCSS, esc } from './utils.js';

let nodesLayer, svgLayer;

// P1: O(1) DOM element lookup by node ID — eliminates querySelector scans
const domCache = new Map();
export { domCache };

export function initRenderer() {
  nodesLayer = document.getElementById('nodes-layer');
  svgLayer = document.getElementById('connections-layer');
}

export function getNodesLayer() { return nodesLayer; }
export function getSvgLayer() { return svgLayer; }

export function finishActiveEdit() {
  const active = nodesLayer.querySelector('[contenteditable="true"]');
  if (active) active.blur();
}

export function renderNodes() {
  finishActiveEdit();
  nodesLayer.innerHTML = '';
  domCache.clear();
  state.nodes.forEach(n => {
    const el = createNodeElement(n);
    domCache.set(n.id, el);
    nodesLayer.appendChild(el);
  });
}

// Unified node element creation — handles all node types from both apps
export function createNodeElement(n) {
  const el = document.createElement('div');
  el.dataset.id = n.id;
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';

  // Apply custom font if set
  if (n.font) el.style.fontFamily = n.font;
  if (n.fontSize) el.style.fontSize = n.fontSize + 'px';
  if (n.fontWeight) el.style.fontWeight = n.fontWeight;
  if (n.opacity != null && n.opacity !== 1) el.style.opacity = n.opacity;

  if (n.type === 'center') {
    el.className = 'node node-center';
    el.style.background = getGradientCSS(n);
    el.style.color = getContrastColor(n.color || '#4a6cf7');

  } else if (n.type === 'sector') {
    // Circle variant when size field is present (netzwerk projects)
    if (n.size) {
      el.className = `node node-sector node-sector--circle size-${n.size}`;
    } else {
      el.className = 'node node-sector';
    }
    el.style.background = getGradientCSS(n);
    el.style.color = getContrastColor(n.color || '#6c8aff');
    if (n.width) el.style.width = n.width + 'px';
    if (n.height) el.style.height = n.height + 'px';

  } else if (n.type === 'company') {
    // Text variant when parentId present (netzwerk projects)
    if (n.parentId != null) {
      el.className = 'node node-company node-company--text' + (n.underlined ? ' underlined' : '');
    } else {
      el.className = 'node node-company';
      // Add color dot for card-style companies
      const dot = document.createElement('span');
      dot.className = 'color-dot';
      dot.style.background = n.color || '#6c8aff';
      el.appendChild(dot);
    }

  } else if (n.type === 'sticky') {
    el.className = 'node node-sticky';
    el.style.background = n.color || '#fef08a';
    if (n.width) el.style.width = n.width + 'px';
    if (n.height) { el.style.minHeight = n.height + 'px'; el.style.height = n.height + 'px'; }
    el.appendChild(Object.assign(document.createElement('div'), { className: 'sticky-fold' }));
    el.appendChild(Object.assign(document.createElement('div'), { className: 'resize-handle' }));

  } else if (n.type === 'rect') {
    el.className = 'node node-rect';
    el.style.background = n.color || 'var(--bg-elevated)';
    el.style.borderColor = n.borderColor || 'var(--border)';
    if (n.width) el.style.width = n.width + 'px';
    if (n.height) el.style.height = n.height + 'px';

  } else if (n.type === 'circle') {
    el.className = 'node node-circle';
    el.style.background = n.color || 'var(--bg-elevated)';
    el.style.borderColor = n.borderColor || 'var(--border)';
    if (n.width) {
      el.style.width = n.width + 'px';
      el.style.height = n.width + 'px';
      el.style.minWidth = n.width + 'px';
      el.style.minHeight = n.width + 'px';
    }

  } else if (n.type === 'textbox') {
    el.className = 'node node-textbox';
  }

  // Label
  const label = document.createElement('span');
  label.className = 'node-label';
  label.setAttribute('contenteditable', 'false');
  if (n.label && n.label.includes('\n')) {
    label.innerHTML = n.label.split('\n').map(l => esc(l)).join('<br>');
  } else {
    label.textContent = n.label || '';
  }
  el.appendChild(label);

  // Anchors
  ['top', 'bottom', 'left', 'right'].forEach(pos => {
    const a = document.createElement('div');
    a.className = 'anchor anchor-' + pos;
    a.dataset.anchor = pos;
    el.appendChild(a);
  });

  if (state.selectedIds.has(n.id)) el.classList.add('selected');
  return el;
}

// Compute connection endpoint coordinates
export function getConnectionEndpoints(c) {
  const fromNode = nodeIndex.get(c.from);
  const toNode = nodeIndex.get(c.to);
  if (!fromNode || !toNode) return null;

  let fc, tc;
  if (c.fromAnchor || c.toAnchor) {
    fc = c.fromAnchor ? getNodeAnchorPoint(fromNode, c.fromAnchor) : getNodeCenter(fromNode);
    tc = c.toAnchor ? getNodeAnchorPoint(toNode, c.toAnchor) : getNodeCenter(toNode);
  } else {
    const auto = autoBestAnchor(fromNode, toNode);
    fc = auto.from;
    tc = auto.to;
  }
  return { fc, tc };
}

// Unified connection rendering — supports bezier + straight
export function renderConnections() {
  svgLayer.innerHTML = '';
  const connStyle = state.connectionStyle || 'bezier';

  state.connections.forEach(c => {
    const pts = getConnectionEndpoints(c);
    if (!pts) return;
    const { fc, tc } = pts;
    const style = c.style || connStyle;
    const isSelected = state.selectedConnId === c.id;

    if (style === 'straight') {
      // Invisible wider hit area
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', fc.x); hit.setAttribute('y1', fc.y);
      hit.setAttribute('x2', tc.x); hit.setAttribute('y2', tc.y);
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '12');
      hit.setAttribute('class', 'conn-hit');
      hit.dataset.id = c.id;
      svgLayer.appendChild(hit);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fc.x);
      line.setAttribute('y1', fc.y);
      line.setAttribute('x2', tc.x);
      line.setAttribute('y2', tc.y);
      line.setAttribute('stroke', c.color || '#6c8aff');
      line.setAttribute('stroke-width', isSelected ? '3' : '1.5');
      line.setAttribute('stroke-opacity', isSelected ? '0.9' : '0.45');
      line.dataset.id = c.id;
      svgLayer.appendChild(line);
    } else {
      const dx = tc.x - fc.x;
      const dy = tc.y - fc.y;
      let d;
      if (Math.abs(dx) > Math.abs(dy)) {
        d = `M${fc.x},${fc.y} C${fc.x + dx * 0.4},${fc.y} ${tc.x - dx * 0.4},${tc.y} ${tc.x},${tc.y}`;
      } else {
        d = `M${fc.x},${fc.y} C${fc.x},${fc.y + dy * 0.4} ${tc.x},${tc.y - dy * 0.4} ${tc.x},${tc.y}`;
      }

      // Invisible wider hit area
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', d);
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '12');
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('class', 'conn-hit');
      hitPath.dataset.id = c.id;
      svgLayer.appendChild(hitPath);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', c.color || '#6c8aff');
      path.setAttribute('stroke-width', isSelected ? '3' : '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-opacity', isSelected ? '0.9' : '0.6');
      path.dataset.id = c.id;
      svgLayer.appendChild(path);
    }

    // Draw endpoint handles when connection is selected
    if (isSelected) {
      renderEndpointHandle(fc, c.id, 'from');
      renderEndpointHandle(tc, c.id, 'to');
    }
  });
}

function renderEndpointHandle(pt, connId, end) {
  // Outer ring
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', pt.x);
  ring.setAttribute('cy', pt.y);
  ring.setAttribute('r', '10');
  ring.setAttribute('fill', 'transparent');
  ring.setAttribute('stroke', 'var(--accent, #6c8aff)');
  ring.setAttribute('stroke-width', '2');
  ring.setAttribute('stroke-dasharray', '3,2');
  ring.setAttribute('class', 'conn-endpoint-ring');
  ring.dataset.connId = connId;
  ring.dataset.end = end;
  svgLayer.appendChild(ring);

  // Inner handle (draggable)
  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  handle.setAttribute('cx', pt.x);
  handle.setAttribute('cy', pt.y);
  handle.setAttribute('r', '6');
  handle.setAttribute('fill', 'var(--accent, #6c8aff)');
  handle.setAttribute('stroke', 'var(--bg, #1a1a2e)');
  handle.setAttribute('stroke-width', '2');
  handle.setAttribute('class', 'conn-endpoint');
  handle.setAttribute('style', 'cursor:grab');
  handle.dataset.connId = connId;
  handle.dataset.end = end;
  svgLayer.appendChild(handle);
}

export function getNodeCenter(n) {
  const el = domCache.get(n.id);
  if (el) return { x: n.x + el.offsetWidth / 2, y: n.y + el.offsetHeight / 2 };
  return { x: n.x + 60, y: n.y + 30 };
}

// Get the position of a specific anchor point on a node
export function getNodeAnchorPoint(n, anchor) {
  const el = domCache.get(n.id);
  const w = el ? el.offsetWidth : 120;
  const h = el ? el.offsetHeight : 60;
  switch (anchor) {
    case 'top':    return { x: n.x + w / 2, y: n.y };
    case 'bottom': return { x: n.x + w / 2, y: n.y + h };
    case 'left':   return { x: n.x,         y: n.y + h / 2 };
    case 'right':  return { x: n.x + w,     y: n.y + h / 2 };
    default:       return getNodeCenter(n);
  }
}

// Auto-detect best anchor based on relative positions of two nodes
function autoBestAnchor(fromNode, toNode) {
  const fc = getNodeCenter(fromNode);
  const tc = getNodeCenter(toNode);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  // Pick anchors based on dominant direction
  let fromA, toA;
  if (Math.abs(dx) > Math.abs(dy)) {
    fromA = dx > 0 ? 'right' : 'left';
    toA = dx > 0 ? 'left' : 'right';
  } else {
    fromA = dy > 0 ? 'bottom' : 'top';
    toA = dy > 0 ? 'top' : 'bottom';
  }
  return {
    from: getNodeAnchorPoint(fromNode, fromA),
    to: getNodeAnchorPoint(toNode, toA)
  };
}

// P7: Track previous selection to only update changed nodes
let prevSelectedIds = new Set();

export function renderSelectionState() {
  // Determine which nodes changed selection state
  const toAdd = new Set();
  const toRemove = new Set();
  for (const id of state.selectedIds) {
    if (!prevSelectedIds.has(id)) toAdd.add(id);
  }
  for (const id of prevSelectedIds) {
    if (!state.selectedIds.has(id)) toRemove.add(id);
  }

  // Only touch DOM elements that actually changed
  for (const id of toAdd) {
    const el = domCache.get(id);
    if (el) el.classList.add('selected');
  }
  for (const id of toRemove) {
    const el = domCache.get(id);
    if (el) el.classList.remove('selected');
  }

  prevSelectedIds = new Set(state.selectedIds);
}
