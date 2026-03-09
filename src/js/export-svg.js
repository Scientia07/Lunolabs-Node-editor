/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-09
 */
// ─── SVG Export (vector output for print & editing) ───
import { state, nodeIndex } from './state.js';
import { getContrastColor, getNodesBoundingBox, showToast } from './utils.js';
import { getNodeCenter, getNodesLayer, domCache } from './renderer.js';

/** Escape text for SVG */
function svgEsc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportSVG(excludeNodeIds) {
  const nodes = excludeNodeIds ? state.nodes.filter(n => !excludeNodeIds.has(n.id)) : state.nodes;
  const connections = excludeNodeIds
    ? state.connections.filter(c => !excludeNodeIds.has(c.from) && !excludeNodeIds.has(c.to))
    : state.connections;

  if (!nodes.length) { showToast('Keine Elemente zum Exportieren'); return; }
  showToast('SVG wird erstellt...');

  const nodesLayer = getNodesLayer();
  const box = getNodesBoundingBox(nodes, nodesLayer);
  if (!box) { showToast('Keine Elemente zum Exportieren'); return; }

  const pad = 20;
  const { minX, minY, maxX, maxY } = box;
  const canvasW = maxX - minX + pad * 2;
  const canvasH = maxY - minY + pad * 2;

  const defs = [];
  const elements = [];
  let gradId = 0;

  // ─── Helper: build gradient def, return fill reference ───
  function addGradient(n, cx, cy, r) {
    const id = `grad-${gradId++}`;
    const angle = (n.gradAngle || 135) * Math.PI / 180;
    const x1 = cx - Math.cos(angle) * r;
    const y1 = cy - Math.sin(angle) * r;
    const x2 = cx + Math.cos(angle) * r;
    const y2 = cy + Math.sin(angle) * r;
    defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${svgEsc(n.color)}"/>
      <stop offset="1" stop-color="${svgEsc(n.color2)}"/>
    </linearGradient>`);
    return `url(#${id})`;
  }

  // ─── Shadow filter for sticky notes ───
  defs.push(`<filter id="shadow-sticky" x="-10%" y="-10%" width="130%" height="130%">
    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.15)"/>
  </filter>`);

  // ─── Draw connections ───
  const connStyle = state.connectionStyle || 'bezier';
  connections.forEach(conn => {
    const fromNode = nodeIndex.get(conn.from);
    const toNode = nodeIndex.get(conn.to);
    if (!fromNode || !toNode) return;

    const fc = getNodeCenter(fromNode);
    const tc = getNodeCenter(toNode);
    const fx = fc.x - minX + pad, fy = fc.y - minY + pad;
    const tx = tc.x - minX + pad, ty = tc.y - minY + pad;
    const style = conn.style || connStyle;

    const color = svgEsc(conn.color || (style === 'straight' ? '#ccc' : '#6c8aff'));
    const width = conn.width || (style === 'straight' ? 1.5 : 2);
    const opacity = style === 'straight' ? 0.45 : 0.7;
    const dash = conn.dash ? ` stroke-dasharray="${svgEsc(conn.dash)}"` : '';

    if (style === 'straight') {
      elements.push(`<line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"${dash}/>`);
    } else {
      const dx = tx - fx;
      const d = `M${fx},${fy} C${fx + dx * 0.4},${fy} ${tx - dx * 0.4},${ty} ${tx},${ty}`;
      elements.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"${dash}/>`);
    }

    // Connection label
    if (conn.label) {
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2;
      const tw = conn.label.length * 6.5 + 12;
      const lh = 20;
      elements.push(`<rect x="${mx - tw / 2}" y="${my - lh / 2}" width="${tw}" height="${lh}" rx="10" fill="#ffffff" fill-opacity="0.9" stroke="#d0d0dd" stroke-width="0.5"/>`);
      elements.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-family="DM Sans, sans-serif" font-size="11" font-weight="400" fill="#1a1a2e">${svgEsc(conn.label)}</text>`);
    }
  });

  // ─── Draw nodes ───
  nodes.forEach(n => {
    const el = domCache.get(n.id);
    const w = el ? el.offsetWidth : (n.width || 140);
    const h = el ? el.offsetHeight : (n.height || 60);
    const x = n.x - minX + pad;
    const y = n.y - minY + pad;

    const opacityAttr = (n.opacity != null && n.opacity !== 1) ? ` opacity="${n.opacity}"` : '';
    const fontFam = n.font || 'DM Sans, sans-serif';
    const fWeight = n.fontWeight || (n.type === 'center' ? '700' : n.type === 'sector' ? '600' : '400');
    const fSize = n.fontSize || (n.type === 'center' ? 15 : n.type === 'sector' ? (n.size === 'lg' ? 14 : 12) : 13);

    if (n.type === 'center' || n.type === 'sector') {
      const isCircle = n.type === 'center' || n.size;
      if (isCircle) {
        const r = Math.min(w, h) / 2;
        const cx = x + w / 2, cy = y + h / 2;
        let fill;
        if (n.color2 && n.color2 !== n.color) {
          fill = addGradient(n, cx, cy, r);
        } else {
          fill = svgEsc(n.color || '#6c8aff');
        }
        elements.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="rgba(255,255,255,0.4)" stroke-width="2"${opacityAttr}/>`);
      } else {
        elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${svgEsc(n.color || '#6c8aff')}" stroke="rgba(0,0,0,0.1)" stroke-width="2"${opacityAttr}/>`);
      }
      // Label
      const textColor = getContrastColor(n.color || '#6c8aff');
      const lines = (n.label || '').split('\n');
      const lh = fSize + 3;
      const sy = y + h / 2 - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => {
        elements.push(`<text x="${x + w / 2}" y="${sy + i * lh}" text-anchor="middle" dominant-baseline="central" font-family="${svgEsc(fontFam)}" font-size="${fSize}" font-weight="${fWeight}" fill="${textColor}"${opacityAttr}>${svgEsc(l)}</text>`);
      });

    } else if (n.type === 'company') {
      if (n.parentId != null) {
        // Text-style company
        elements.push(`<text x="${x}" y="${y + h / 2}" text-anchor="start" dominant-baseline="central" font-family="${svgEsc(fontFam)}" font-size="${fSize}" font-weight="${fWeight}" fill="#1a1d2e"${opacityAttr}>${svgEsc(n.label || '')}</text>`);
        if (n.underlined) {
          const tw = (n.label || '').length * fSize * 0.6;
          elements.push(`<line x1="${x}" y1="${y + h / 2 + 7}" x2="${x + tw}" y2="${y + h / 2 + 7}" stroke="#1a1d2e" stroke-width="0.8"${opacityAttr}/>`);
        }
      } else {
        // Card-style company
        elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f0f0f5" stroke="#d0d0dd" stroke-width="1.5"${opacityAttr}/>`);
        elements.push(`<circle cx="${x + 16}" cy="${y + h / 2}" r="4" fill="${svgEsc(n.color || '#6c8aff')}"${opacityAttr}/>`);
        elements.push(`<text x="${x + w / 2 + 6}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-family="${svgEsc(fontFam)}" font-size="13" font-weight="500" fill="#1a1a2e"${opacityAttr}>${svgEsc(n.label || '')}</text>`);
      }

    } else if (n.type === 'sticky') {
      elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${svgEsc(n.color || '#fef08a')}" filter="url(#shadow-sticky)"${opacityAttr}/>`);
      // Wrap text for sticky notes
      const stickyLines = wrapTextSVG(n.label || '', w - 28);
      stickyLines.forEach((line, i) => {
        elements.push(`<text x="${x + 14}" y="${y + 14 + i * 18 + 13}" text-anchor="start" font-family="${svgEsc(fontFam)}" font-size="13" font-weight="400" fill="#1a1a1a"${opacityAttr}>${svgEsc(line)}</text>`);
      });

    } else if (n.type === 'circle') {
      const r = Math.min(w, h) / 2;
      elements.push(`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${r}" fill="${svgEsc(n.color || '#f0f0f5')}" stroke="${svgEsc(n.borderColor || '#d0d0dd')}" stroke-width="2"${opacityAttr}/>`);
      elements.push(`<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-family="${svgEsc(fontFam)}" font-size="13" font-weight="400" fill="#1a1a2e"${opacityAttr}>${svgEsc(n.label || '')}</text>`);

    } else if (n.type === 'rect') {
      elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${svgEsc(n.color || '#f0f0f5')}" stroke="${svgEsc(n.borderColor || '#d0d0dd')}" stroke-width="2"${opacityAttr}/>`);
      elements.push(`<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-family="${svgEsc(fontFam)}" font-size="13" font-weight="400" fill="#1a1a2e"${opacityAttr}>${svgEsc(n.label || '')}</text>`);

    } else if (n.type === 'textbox') {
      const tbLines = wrapTextSVG(n.label || '', (w || 200) - 16);
      tbLines.forEach((line, i) => {
        elements.push(`<text x="${x + 8}" y="${y + 8 + i * 20 + 14}" text-anchor="start" font-family="${svgEsc(fontFam)}" font-size="14" font-weight="400" fill="#1a1a2e"${opacityAttr}>${svgEsc(line)}</text>`);
      });
    }
  });

  // ─── Draw legend ───
  if (state.showLegend) {
    const sectors = nodes
      .filter(n => n.type === 'sector' || n.type === 'center')
      .map(n => ({ label: n.label || '', color: n.color || '#6c8aff' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));

    if (sectors.length) {
      const lPad = 14, lGap = 6, dotR = 5, lFontSize = 11, lLineH = 20;
      const lH = lPad * 2 + 18 + sectors.length * lLineH;
      const maxLabelW = Math.max(...sectors.map(s => s.label.length * 6.5));
      const lW = lPad * 2 + dotR * 2 + lGap + maxLabelW + 8;
      const lX = canvasW - lW - 16;
      const lY = canvasH - lH - 16;

      elements.push(`<rect x="${lX}" y="${lY}" width="${lW}" height="${lH}" rx="8" fill="#ffffff" fill-opacity="0.92" stroke="#d0d0dd" stroke-width="1"/>`);
      elements.push(`<text x="${lX + lPad}" y="${lY + lPad + 10}" text-anchor="start" font-family="DM Sans, sans-serif" font-size="12" font-weight="600" fill="#1a1a2e">Legende</text>`);

      sectors.forEach((s, i) => {
        const iy = lY + lPad + 18 + i * lLineH;
        elements.push(`<circle cx="${lX + lPad + dotR}" cy="${iy + dotR}" r="${dotR}" fill="${svgEsc(s.color)}"/>`);
        elements.push(`<text x="${lX + lPad + dotR * 2 + lGap}" y="${iy + dotR}" text-anchor="start" dominant-baseline="central" font-family="DM Sans, sans-serif" font-size="${lFontSize}" font-weight="400" fill="#1a1a2e">${svgEsc(s.label)}</text>`);
      });
    }
  }

  // ─── Assemble SVG ───
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <defs>${defs.join('\n')}</defs>
  <rect width="${canvasW}" height="${canvasH}" fill="#ffffff"/>
  ${elements.join('\n  ')}
</svg>`;

  // Download
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'netzwerk-' + new Date().toISOString().slice(0, 10) + '.svg';
  a.click();
  URL.revokeObjectURL(url);
  showToast('SVG exportiert!');
}

/** Simple text wrapping for SVG (no measureText available) */
function wrapTextSVG(text, maxW) {
  const avgCharW = 7; // approximate character width at 13-14px
  const maxChars = Math.floor(maxW / avgCharW);
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
