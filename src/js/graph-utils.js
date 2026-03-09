/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-09
 */
/**
 * graph-utils.js — Pure graph algorithms extracted from sidebar.js
 *
 * All functions are pure: data in → data out, no DOM, no module-level state.
 * This makes them independently testable and reusable.
 */

/**
 * Build adjacency map from connections array.
 * @param {Array<{from: string, to: string}>} connections
 * @returns {Map<string, Set<string>>} nodeId → Set of neighbor IDs
 */
export function buildAdjacencyMap(connections) {
  const adj = new Map();
  for (const c of connections) {
    if (!adj.has(c.from)) adj.set(c.from, new Set());
    if (!adj.has(c.to)) adj.set(c.to, new Set());
    adj.get(c.from).add(c.to);
    adj.get(c.to).add(c.from);
  }
  return adj;
}

/**
 * Get neighbors of a node, filtered to only those that exist in nodeIndex.
 * @param {Map<string, Set<string>>} adjMap
 * @param {string} nodeId
 * @param {Map<string, object>} nodeIndex
 * @returns {string[]}
 */
export function getNeighbors(adjMap, nodeId, nodeIndex) {
  const neighbors = adjMap.get(nodeId);
  if (!neighbors) return [];
  return [...neighbors].filter(id => nodeIndex.has(id));
}

/**
 * BFS from the most-connected node to build layers by graph distance.
 * @param {Array<{id: string, label?: string}>} nodes
 * @param {Array<{from: string, to: string}>} connections
 * @param {Map<string, object>} nodeIndex
 * @param {Map<string, Set<string>>} [adjMap] - optional pre-built adjacency map
 * @returns {Array<Array<object>>} layers of node objects
 */
export function buildHierarchyLayers(nodes, connections, nodeIndex, adjMap) {
  if (!nodes.length) return [];

  if (!adjMap) adjMap = buildAdjacencyMap(connections);

  // Count connections per node
  const connCounts = new Map();
  for (const n of nodes) connCounts.set(n.id, 0);
  for (const c of connections) {
    if (connCounts.has(c.from)) connCounts.set(c.from, connCounts.get(c.from) + 1);
    if (connCounts.has(c.to)) connCounts.set(c.to, connCounts.get(c.to) + 1);
  }

  // Start BFS from the node with the most connections
  const sorted = [...connCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return [];

  const visited = new Set();
  const layers = [];
  const queue = [sorted[0][0]];
  visited.add(sorted[0][0]);

  while (queue.length) {
    const layerNodes = queue.map(id => nodeIndex.get(id)).filter(Boolean);
    // Sort within layer: most connections first
    layerNodes.sort((a, b) => (connCounts.get(b.id) || 0) - (connCounts.get(a.id) || 0));
    layers.push(layerNodes);

    const nextQueue = [];
    for (const id of queue) {
      for (const neighborId of getNeighbors(adjMap, id, nodeIndex)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          nextQueue.push(neighborId);
        }
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
  }

  // Add disconnected nodes as a final layer
  const disconnected = nodes.filter(n => !visited.has(n.id));
  if (disconnected.length) {
    disconnected.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    layers.push(disconnected);
  }

  return layers;
}

/**
 * Compute set of all node IDs that should be hidden.
 * @param {object} params
 * @param {Set<string>} params.hiddenSectors
 * @param {Array<{id: string, nodeIds: string[], hidden: boolean}>} params.groups
 * @param {Set<string>} params.hiddenNodes
 * @param {Map<string, Set<string>>} params.adjMap
 * @param {Map<string, object>} params.nodeIndex
 * @returns {Set<string>}
 */
export function computeHiddenNodeIds({ hiddenSectors, groups, hiddenNodes, adjMap, nodeIndex }) {
  const hidden = new Set();

  for (const sid of hiddenSectors) {
    hidden.add(sid);
    const neighbors = getNeighbors(adjMap, sid, nodeIndex);
    for (const nid of neighbors) {
      const otherSectors = getNeighbors(adjMap, nid, nodeIndex).filter(
        id => {
          const node = nodeIndex.get(id);
          return (node?.type === 'sector' || node?.type === 'center') && !hiddenSectors.has(id);
        }
      );
      if (otherSectors.length === 0) hidden.add(nid);
    }
  }

  for (const g of groups) {
    if (g.hidden) {
      for (const nid of g.nodeIds) hidden.add(nid);
    }
  }

  for (const nid of hiddenNodes) {
    hidden.add(nid);
  }

  return hidden;
}
