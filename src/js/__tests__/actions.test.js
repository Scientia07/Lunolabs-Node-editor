/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { deleteSelected, duplicateSelected } from '../actions.js';

/**
 * Test helpers
 */
function makeNode(id, x = 0, y = 0) {
  return { id, x, y, label: `Node ${id}`, color: '#fff' };
}

function makeConn(id, from, to, color = '#6c8aff') {
  return { id, from, to, color };
}

describe('actions.js', () => {
  let renderCalled;
  let fullRender;

  beforeEach(() => {
    // Reset state
    state.nodes = [makeNode(1, 100, 100), makeNode(2, 200, 200), makeNode(3, 300, 300)];
    state.connections = [makeConn(10, 1, 2), makeConn(11, 2, 3)];
    state.selectedIds = new Set();
    state.undoStack = [];
    state.redoStack = [];
    state.nextId = 20;
    rebuildIndex();

    // Track render calls
    renderCalled = false;
    fullRender = vi.fn(() => { renderCalled = true; });
  });

  // ─── deleteSelected ───

  describe('deleteSelected', () => {
    it('does nothing when nothing is selected (no render call)', () => {
      deleteSelected(fullRender);

      expect(fullRender).not.toHaveBeenCalled();
      expect(state.nodes).toHaveLength(3);
      expect(state.connections).toHaveLength(2);
    });

    it('does not push an undo snapshot when nothing is selected', () => {
      deleteSelected(fullRender);

      expect(state.undoStack).toHaveLength(0);
    });

    it('removes a single selected node', () => {
      state.selectedIds.add(3);
      deleteSelected(fullRender);

      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.find(n => n.id === 3)).toBeUndefined();
    });

    it('removes connections where the deleted node is the "from" endpoint', () => {
      state.selectedIds.add(1);
      deleteSelected(fullRender);

      // Connection 10 (1->2) should be removed
      expect(state.connections.find(c => c.from === 1)).toBeUndefined();
      // Connection 11 (2->3) should remain
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].id).toBe(11);
    });

    it('removes connections where the deleted node is the "to" endpoint', () => {
      state.selectedIds.add(2);
      deleteSelected(fullRender);

      // Both connections involve node 2 (1->2 and 2->3), so both removed
      expect(state.connections).toHaveLength(0);
    });

    it('removes multiple selected nodes and all their connections', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      deleteSelected(fullRender);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe(3);
      expect(state.connections).toHaveLength(0);
    });

    it('clears selection after delete', () => {
      state.selectedIds.add(1);
      deleteSelected(fullRender);

      expect(state.selectedIds.size).toBe(0);
    });

    it('saves an undo snapshot before deleting', () => {
      state.selectedIds.add(1);
      deleteSelected(fullRender);

      expect(state.undoStack).toHaveLength(1);
      const snap = JSON.parse(state.undoStack[0]);
      // Snapshot should contain the original 3 nodes
      expect(snap.nodes).toHaveLength(3);
      expect(snap.connections).toHaveLength(2);
    });

    it('calls fullRender after delete', () => {
      state.selectedIds.add(1);
      deleteSelected(fullRender);

      expect(fullRender).toHaveBeenCalledOnce();
    });

    it('rebuilds the node index after delete', () => {
      state.selectedIds.add(2);
      deleteSelected(fullRender);

      expect(nodeIndex.has(2)).toBe(false);
      expect(nodeIndex.has(1)).toBe(true);
      expect(nodeIndex.has(3)).toBe(true);
    });
  });

  // ─── duplicateSelected ───

  describe('duplicateSelected', () => {
    it('does nothing when nothing is selected (no render call)', () => {
      duplicateSelected(fullRender);

      expect(fullRender).not.toHaveBeenCalled();
      expect(state.nodes).toHaveLength(3);
    });

    it('does not push an undo snapshot when nothing is selected', () => {
      duplicateSelected(fullRender);

      expect(state.undoStack).toHaveLength(0);
    });

    it('duplicates a single selected node with +30 offset', () => {
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      expect(state.nodes).toHaveLength(4);
      const dup = state.nodes[3]; // appended at end
      expect(dup.x).toBe(130); // 100 + 30
      expect(dup.y).toBe(130);
      expect(dup.id).toBe(20); // nextId was 20
    });

    it('preserves all properties of the duplicated node', () => {
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      const original = state.nodes.find(n => n.id === 1);
      const dup = state.nodes.find(n => n.id === 20);
      expect(dup.label).toBe(original.label);
      expect(dup.color).toBe(original.color);
    });

    it('duplicates multiple selected nodes', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(fullRender);

      expect(state.nodes).toHaveLength(5);
    });

    it('duplicates internal connections between selected nodes', () => {
      // Select nodes 1 and 2 -- connection 10 (1->2) is internal
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(fullRender);

      // Original 2 connections + 1 duplicated internal connection
      expect(state.connections).toHaveLength(3);
      const newConn = state.connections[2];
      // New connection should link the duplicated node ids (20 and 21)
      expect(newConn.from).toBe(20);
      expect(newConn.to).toBe(21);
      expect(newConn.color).toBe('#6c8aff');
    });

    it('duplicates all internal connections when all nodes are selected', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      state.selectedIds.add(3);
      duplicateSelected(fullRender);

      // Original 2 connections + 2 duplicated connections
      expect(state.connections).toHaveLength(4);
    });

    it('does NOT duplicate connections where only one endpoint is selected', () => {
      // Select only node 1 -- connection 10 (1->2) has node 2 unselected
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      // No new connections should be created
      expect(state.connections).toHaveLength(2);
    });

    it('selects only the new duplicates, not the originals', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(fullRender);

      expect(state.selectedIds.has(1)).toBe(false);
      expect(state.selectedIds.has(2)).toBe(false);
      expect(state.selectedIds.has(20)).toBe(true);
      expect(state.selectedIds.has(21)).toBe(true);
      expect(state.selectedIds.size).toBe(2);
    });

    it('saves an undo snapshot before duplicating', () => {
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      expect(state.undoStack).toHaveLength(1);
      const snap = JSON.parse(state.undoStack[0]);
      expect(snap.nodes).toHaveLength(3); // snapshot has original state
    });

    it('increments nextId for each duplicated node and connection', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(fullRender);

      // 2 nodes (ids 20, 21) + 1 connection (id 22) = nextId should be 23
      expect(state.nextId).toBe(23);
    });

    it('calls fullRender after duplication', () => {
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      expect(fullRender).toHaveBeenCalledOnce();
    });

    it('rebuilds the node index after duplication', () => {
      state.selectedIds.add(1);
      duplicateSelected(fullRender);

      expect(nodeIndex.has(20)).toBe(true);
      expect(nodeIndex.get(20).x).toBe(130);
    });
  });
});
