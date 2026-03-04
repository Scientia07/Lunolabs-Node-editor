/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Node & Connection Rendering ───
import { state, nodeIndex } from './state.js';
import { getContrastColor, getGradientCSS } from './utils.js';

let nodesLayer, svgLayer;

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
  state.nodes.forEach(n => nodesLayer.appendChild(createNodeElement(n)));
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
    label.innerHTML = n.label.split('\n').map(l => {
      // Escape HTML entities for safety
      const safe = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return safe;
    }).join('<br>');
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

// Unified connection rendering — supports bezier + straight
export function renderConnections() {
  svgLayer.innerHTML = '';
  const connStyle = state.connectionStyle || 'bezier';

  state.connections.forEach(c => {
    const fromNode = nodeIndex.get(c.from);
    const toNode = nodeIndex.get(c.to);
    if (!fromNode || !toNode) return;

    const fc = getNodeCenter(fromNode);
    const tc = getNodeCenter(toNode);
    const style = c.style || connStyle;

    if (style === 'straight') {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fc.x);
      line.setAttribute('y1', fc.y);
      line.setAttribute('x2', tc.x);
      line.setAttribute('y2', tc.y);
      line.setAttribute('stroke', c.color || '#6c8aff');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-opacity', '0.45');
      line.dataset.id = c.id;
      svgLayer.appendChild(line);
    } else {
      const dx = tc.x - fc.x;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${fc.x},${fc.y} C${fc.x + dx * 0.4},${fc.y} ${tc.x - dx * 0.4},${tc.y} ${tc.x},${tc.y}`);
      path.setAttribute('stroke', c.color || '#6c8aff');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-opacity', '0.6');
      path.dataset.id = c.id;
      svgLayer.appendChild(path);
    }
  });
}

export function getNodeCenter(n) {
  const el = nodesLayer.querySelector(`[data-id="${n.id}"]`);
  if (el) return { x: n.x + el.offsetWidth / 2, y: n.y + el.offsetHeight / 2 };
  return { x: n.x + 60, y: n.y + 30 };
}

export function renderSelectionState() {
  nodesLayer.querySelectorAll('.node').forEach(el => {
    el.classList.toggle('selected', state.selectedIds.has(parseInt(el.dataset.id, 10)));
  });
}
