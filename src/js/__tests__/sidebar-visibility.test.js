/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-06T09:55:00+01:00
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { getHiddenNodeIds } from '../sidebar.js';

describe('getHiddenNodeIds', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.groups = [];
    state.hiddenSectors = new Set();
    state.hiddenNodes = new Set();
    nodeIndex.clear();
  });

  it('returns empty set when nothing hidden', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0 },
      { id: 2, type: 'company', x: 10, y: 10 },
    ];
    state.connections = [{ id: 100, from: 1, to: 2 }];
    rebuildIndex();
    const hidden = getHiddenNodeIds();
    expect(hidden.size).toBe(0);
  });

  it('includes individually hidden nodes', () => {
    state.nodes = [{ id: 5, type: 'company', x: 0, y: 0 }];
    rebuildIndex();
    state.hiddenNodes.add(5);
    const hidden = getHiddenNodeIds();
    expect(hidden.has(5)).toBe(true);
  });

  it('includes hidden sector and its exclusive children', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0 },
      { id: 2, type: 'company', x: 10, y: 10 },
    ];
    state.connections = [{ id: 100, from: 1, to: 2 }];
    rebuildIndex();
    state.hiddenSectors.add(1);
    const hidden = getHiddenNodeIds();
    expect(hidden.has(1)).toBe(true);
    expect(hidden.has(2)).toBe(true);
  });

  it('does not hide node connected to multiple sectors when only one is hidden', () => {
    state.nodes = [
      { id: 1, type: 'sector', x: 0, y: 0 },
      { id: 2, type: 'sector', x: 100, y: 0 },
      { id: 3, type: 'company', x: 50, y: 50 },
    ];
    state.connections = [
      { id: 100, from: 1, to: 3 },
      { id: 101, from: 2, to: 3 },
    ];
    rebuildIndex();
    state.hiddenSectors.add(1);
    const hidden = getHiddenNodeIds();
    expect(hidden.has(1)).toBe(true);
    expect(hidden.has(3)).toBe(false);
  });

  it('includes nodes from hidden custom groups', () => {
    state.nodes = [{ id: 10, type: 'company', x: 0, y: 0 }];
    rebuildIndex();
    state.groups = [{ id: 99, name: 'Test', nodeIds: [10], hidden: true }];
    const hidden = getHiddenNodeIds();
    expect(hidden.has(10)).toBe(true);
  });
});
