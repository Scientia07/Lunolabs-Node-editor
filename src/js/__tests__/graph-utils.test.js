/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-09
 */
import { describe, it, expect } from 'vitest';
import { buildAdjacencyMap, getNeighbors, buildHierarchyLayers, computeHiddenNodeIds } from '../graph-utils.js';

// ─── Test helpers ───
function makeNode(id, opts = {}) {
  return { id, label: opts.label || `Node ${id}`, type: opts.type || 'company', ...opts };
}

function makeConn(from, to) {
  return { from, to };
}

function makeNodeIndex(nodes) {
  return new Map(nodes.map(n => [n.id, n]));
}

// ─── buildAdjacencyMap ───
describe('buildAdjacencyMap', () => {
  it('returns empty map for no connections', () => {
    const adj = buildAdjacencyMap([]);
    expect(adj.size).toBe(0);
  });

  it('creates bidirectional entries', () => {
    const adj = buildAdjacencyMap([makeConn('a', 'b')]);
    expect(adj.get('a').has('b')).toBe(true);
    expect(adj.get('b').has('a')).toBe(true);
  });

  it('handles multiple connections from one node', () => {
    const adj = buildAdjacencyMap([makeConn('a', 'b'), makeConn('a', 'c')]);
    expect(adj.get('a').size).toBe(2);
    expect(adj.get('b').size).toBe(1);
    expect(adj.get('c').size).toBe(1);
  });

  it('deduplicates repeated connections', () => {
    const adj = buildAdjacencyMap([makeConn('a', 'b'), makeConn('a', 'b')]);
    expect(adj.get('a').size).toBe(1);
  });
});

// ─── getNeighbors ───
describe('getNeighbors', () => {
  it('returns empty array for unknown node', () => {
    const adj = buildAdjacencyMap([]);
    const idx = makeNodeIndex([]);
    expect(getNeighbors(adj, 'x', idx)).toEqual([]);
  });

  it('filters out neighbors not in nodeIndex', () => {
    const adj = buildAdjacencyMap([makeConn('a', 'b'), makeConn('a', 'c')]);
    const idx = makeNodeIndex([makeNode('a'), makeNode('b')]); // 'c' missing
    const result = getNeighbors(adj, 'a', idx);
    expect(result).toEqual(['b']);
  });

  it('returns all neighbors when all exist in index', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const adj = buildAdjacencyMap([makeConn('a', 'b'), makeConn('a', 'c')]);
    const result = getNeighbors(adj, 'a', makeNodeIndex(nodes));
    expect(result).toHaveLength(2);
    expect(result).toContain('b');
    expect(result).toContain('c');
  });
});

// ─── buildHierarchyLayers ───
describe('buildHierarchyLayers', () => {
  it('returns empty array for no nodes', () => {
    expect(buildHierarchyLayers([], [], new Map())).toEqual([]);
  });

  it('puts single node in first layer', () => {
    const nodes = [makeNode('a')];
    const layers = buildHierarchyLayers(nodes, [], makeNodeIndex(nodes));
    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveLength(1);
    expect(layers[0][0].id).toBe('a');
  });

  it('starts BFS from most-connected node', () => {
    // Hub 'h' connects to a, b, c; 'a' connects to 'd'
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d'), makeNode('h')];
    const conns = [
      makeConn('h', 'a'), makeConn('h', 'b'), makeConn('h', 'c'),
      makeConn('a', 'd')
    ];
    const layers = buildHierarchyLayers(nodes, conns, makeNodeIndex(nodes));

    // Layer 0: hub (most connected)
    expect(layers[0][0].id).toBe('h');
    // Layer 1: a, b, c (direct neighbors of hub)
    expect(layers[1].map(n => n.id).sort()).toEqual(['a', 'b', 'c']);
    // Layer 2: d (neighbor of a)
    expect(layers[2][0].id).toBe('d');
  });

  it('puts disconnected nodes in last layer', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('z', { label: 'Zzz' })];
    const conns = [makeConn('a', 'b')];
    const layers = buildHierarchyLayers(nodes, conns, makeNodeIndex(nodes));

    // BFS: layer 0 = hub (a, most conns), layer 1 = b, layer 2 = z (disconnected)
    expect(layers).toHaveLength(3);
    // Last layer is the disconnected node
    expect(layers[layers.length - 1][0].id).toBe('z');
  });

  it('sorts within layer by connection count descending', () => {
    // Hub connects to a (2 conns total) and b (1 conn total)
    const nodes = [makeNode('hub'), makeNode('a'), makeNode('b'), makeNode('x')];
    const conns = [makeConn('hub', 'a'), makeConn('hub', 'b'), makeConn('a', 'x')];
    const layers = buildHierarchyLayers(nodes, conns, makeNodeIndex(nodes));

    // Layer 1 should have 'a' before 'b' (a has 2 conns, b has 1)
    const layer1Ids = layers[1].map(n => n.id);
    expect(layer1Ids.indexOf('a')).toBeLessThan(layer1Ids.indexOf('b'));
  });

  it('accepts pre-built adjacency map', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const conns = [makeConn('a', 'b')];
    const adj = buildAdjacencyMap(conns);
    const layers = buildHierarchyLayers(nodes, conns, makeNodeIndex(nodes), adj);
    // BFS: layer 0 = a (hub), layer 1 = b (neighbor)
    expect(layers).toHaveLength(2);
    expect(layers[0][0].id).toBe('a');
    expect(layers[1][0].id).toBe('b');
  });
});

// ─── computeHiddenNodeIds ───
describe('computeHiddenNodeIds', () => {
  it('returns empty set when nothing is hidden', () => {
    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(),
      groups: [],
      hiddenNodes: new Set(),
      adjMap: buildAdjacencyMap([]),
      nodeIndex: new Map()
    });
    expect(result.size).toBe(0);
  });

  it('hides sector and its exclusive companies', () => {
    const nodes = [
      makeNode('s1', { type: 'sector' }),
      makeNode('c1', { type: 'company' }),
      makeNode('c2', { type: 'company' })
    ];
    const conns = [makeConn('s1', 'c1'), makeConn('s1', 'c2')];
    const adj = buildAdjacencyMap(conns);

    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(['s1']),
      groups: [],
      hiddenNodes: new Set(),
      adjMap: adj,
      nodeIndex: makeNodeIndex(nodes)
    });

    expect(result.has('s1')).toBe(true);
    expect(result.has('c1')).toBe(true);
    expect(result.has('c2')).toBe(true);
  });

  it('keeps company visible if connected to another visible sector', () => {
    const nodes = [
      makeNode('s1', { type: 'sector' }),
      makeNode('s2', { type: 'sector' }),
      makeNode('c1', { type: 'company' })
    ];
    const conns = [makeConn('s1', 'c1'), makeConn('s2', 'c1')];
    const adj = buildAdjacencyMap(conns);

    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(['s1']),
      groups: [],
      hiddenNodes: new Set(),
      adjMap: adj,
      nodeIndex: makeNodeIndex(nodes)
    });

    expect(result.has('s1')).toBe(true);
    expect(result.has('c1')).toBe(false); // visible via s2
  });

  it('hides nodes from hidden groups', () => {
    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(),
      groups: [{ id: 'g1', name: 'Group 1', nodeIds: ['n1', 'n2'], hidden: true }],
      hiddenNodes: new Set(),
      adjMap: buildAdjacencyMap([]),
      nodeIndex: new Map()
    });

    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(true);
  });

  it('does not hide nodes from visible groups', () => {
    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(),
      groups: [{ id: 'g1', name: 'Group 1', nodeIds: ['n1'], hidden: false }],
      hiddenNodes: new Set(),
      adjMap: buildAdjacencyMap([]),
      nodeIndex: new Map()
    });

    expect(result.has('n1')).toBe(false);
  });

  it('hides individually hidden nodes', () => {
    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(),
      groups: [],
      hiddenNodes: new Set(['n5']),
      adjMap: buildAdjacencyMap([]),
      nodeIndex: new Map()
    });

    expect(result.has('n5')).toBe(true);
  });

  it('combines all three hiding sources', () => {
    const nodes = [
      makeNode('s1', { type: 'sector' }),
      makeNode('c1', { type: 'company' })
    ];
    const conns = [makeConn('s1', 'c1')];
    const adj = buildAdjacencyMap(conns);

    const result = computeHiddenNodeIds({
      hiddenSectors: new Set(['s1']),
      groups: [{ id: 'g1', name: 'G', nodeIds: ['g-node'], hidden: true }],
      hiddenNodes: new Set(['manual-hide']),
      adjMap: adj,
      nodeIndex: makeNodeIndex(nodes)
    });

    expect(result.has('s1')).toBe(true);      // hidden sector
    expect(result.has('c1')).toBe(true);      // exclusive to hidden sector
    expect(result.has('g-node')).toBe(true);  // hidden group
    expect(result.has('manual-hide')).toBe(true); // individually hidden
  });
});
