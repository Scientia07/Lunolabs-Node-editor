/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-09
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM and dependencies before importing
vi.mock('../renderer.js', () => ({
  getNodeCenter: (n) => ({ x: n.x + 50, y: n.y + 25 }),
  getNodesLayer: () => document.createElement('div'),
  domCache: new Map()
}));

let toastCalls = [];
vi.mock('../utils.js', () => ({
  getContrastColor: () => '#ffffff',
  getNodesBoundingBox: (nodes) => {
    if (!nodes.length) return null;
    return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  },
  showToast: (msg) => { toastCalls.push(msg); }
}));

import { state, nodeIndex } from '../state.js';
import { exportSVG } from '../export-svg.js';

let capturedBlob = null;

beforeEach(() => {
  state.nodes = [];
  state.connections = [];
  state.connectionStyle = 'bezier';
  state.showLegend = false;
  nodeIndex.clear();
  toastCalls = [];
  capturedBlob = null;

  globalThis.URL.createObjectURL = vi.fn((blob) => {
    capturedBlob = blob;
    return 'blob:test';
  });
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('exportSVG', () => {
  it('shows toast for empty nodes', () => {
    exportSVG();
    expect(toastCalls).toContain('Keine Elemente zum Exportieren');
    expect(capturedBlob).toBeNull();
  });

  it('creates SVG blob for sector node', () => {
    state.nodes = [{ id: 1, type: 'sector', x: 100, y: 100, label: 'Test', color: '#ff0000' }];
    nodeIndex.set(1, state.nodes[0]);

    exportSVG();

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob.type).toBe('image/svg+xml;charset=utf-8');
    expect(toastCalls).toContain('SVG exportiert!');
  });

  it('creates SVG blob for company card', () => {
    state.nodes = [{ id: 1, type: 'company', x: 50, y: 50, label: 'Test Co', color: '#6c8aff' }];
    nodeIndex.set(1, state.nodes[0]);

    exportSVG();

    expect(capturedBlob).not.toBeNull();
    expect(toastCalls).toContain('SVG exportiert!');
  });

  it('handles sticky notes', () => {
    state.nodes = [{ id: 1, type: 'sticky', x: 0, y: 0, label: 'Note text here', color: '#fef08a', width: 160, height: 120 }];
    nodeIndex.set(1, state.nodes[0]);

    exportSVG();
    expect(capturedBlob).not.toBeNull();
  });

  it('handles connections with labels', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0, label: 'A', color: '#ff0000' },
      { id: 2, type: 'company', x: 200, y: 200, label: 'B', color: '#00ff00' }
    ];
    state.connections = [{ id: 10, from: 1, to: 2, color: '#6c8aff', label: 'Link' }];
    nodeIndex.set(1, state.nodes[0]);
    nodeIndex.set(2, state.nodes[1]);

    exportSVG();
    expect(capturedBlob).not.toBeNull();
  });

  it('respects excludeNodeIds', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0, label: 'Keep', color: '#ff0000' },
      { id: 2, type: 'sector', x: 100, y: 100, label: 'Skip', color: '#00ff00' }
    ];
    state.connections = [{ id: 10, from: 1, to: 2 }];
    nodeIndex.set(1, state.nodes[0]);
    nodeIndex.set(2, state.nodes[1]);

    exportSVG(new Set([2]));
    // Connection should be filtered too since node 2 is excluded
    expect(toastCalls).toContain('SVG exportiert!');
  });

  it('handles all shape types without error', () => {
    state.nodes = [
      { id: 1, type: 'rect', x: 0, y: 0, label: 'R', width: 140, height: 80 },
      { id: 2, type: 'circle', x: 200, y: 0, label: 'C', width: 100, height: 100 },
      { id: 3, type: 'textbox', x: 0, y: 200, label: 'Text content', width: 200 },
      { id: 4, type: 'center', x: 200, y: 200, label: 'Hub', color: '#333', color2: '#666', size: 'lg' }
    ];
    state.nodes.forEach(n => nodeIndex.set(n.id, n));

    exportSVG();
    expect(capturedBlob).not.toBeNull();
    expect(toastCalls).toContain('SVG exportiert!');
  });
});
