import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { deleteSelected, duplicateSelected } from '../actions.js';

describe('actions.js', () => {
  let renderCalled;

  beforeEach(() => {
    state.nodes = [
      { id: 1, x: 0, y: 0, type: 'rect', label: 'A' },
      { id: 2, x: 100, y: 100, type: 'rect', label: 'B' },
      { id: 3, x: 200, y: 200, type: 'rect', label: 'C' },
    ];
    state.connections = [
      { id: 10, from: 1, to: 2, color: '#fff' },
      { id: 11, from: 2, to: 3, color: '#fff' },
    ];
    state.nextId = 20;
    state.selectedIds = new Set();
    state.undoStack = [];
    state.redoStack = [];
    state.groups = [];
    state.hiddenSectors = new Set();
    rebuildIndex();
    renderCalled = false;
  });

  describe('deleteSelected', () => {
    it('removes selected nodes and their connections', () => {
      state.selectedIds.add(2);
      deleteSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(2);
      expect(nodeIndex.has(2)).toBe(false);
      // Both connections involving node 2 should be removed
      expect(state.connections.length).toBe(0);
      expect(renderCalled).toBe(true);
    });

    it('does nothing when nothing selected', () => {
      deleteSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(3);
      expect(renderCalled).toBe(false);
    });

    it('clears selection after delete', () => {
      state.selectedIds.add(1);
      deleteSelected(() => {});
      expect(state.selectedIds.size).toBe(0);
    });

    it('saves undo snapshot before delete', () => {
      state.selectedIds.add(1);
      deleteSelected(() => {});
      expect(state.undoStack.length).toBe(1);
    });
  });

  describe('duplicateSelected', () => {
    it('duplicates selected nodes with offset', () => {
      state.selectedIds.add(1);
      duplicateSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(4);
      const duped = state.nodes[3];
      expect(duped.x).toBe(30); // original 0 + 30
      expect(duped.y).toBe(30);
      expect(duped.label).toBe('A');
      expect(renderCalled).toBe(true);
    });

    it('duplicates internal connections between selected nodes', () => {
      state.selectedIds.add(1);
      state.selectedIds.add(2);
      duplicateSelected(() => {});
      // Original 2 connections + 1 duplicated internal connection
      expect(state.connections.length).toBe(3);
    });

    it('selects only the new duplicates', () => {
      state.selectedIds.add(1);
      duplicateSelected(() => {});
      expect(state.selectedIds.has(1)).toBe(false);
      expect(state.selectedIds.size).toBe(1);
    });

    it('does nothing when nothing selected', () => {
      duplicateSelected(() => { renderCalled = true; });
      expect(state.nodes.length).toBe(3);
      expect(renderCalled).toBe(false);
    });
  });
});
