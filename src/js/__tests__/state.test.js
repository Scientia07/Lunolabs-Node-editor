import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex, genId, saveSnapshot, undo, redo, on, off, emit } from '../state.js';

describe('state.js', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.undoStack = [];
    state.redoStack = [];
    state.selectedIds.clear();
    state.groups = [];
    state.hiddenSectors = new Set();
    nodeIndex.clear();
  });

  describe('genId', () => {
    it('returns incrementing IDs', () => {
      expect(genId()).toBe(1);
      expect(genId()).toBe(2);
      expect(genId()).toBe(3);
    });
  });

  describe('rebuildIndex', () => {
    it('populates nodeIndex from state.nodes', () => {
      const n1 = { id: 1, x: 0, y: 0, type: 'rect' };
      const n2 = { id: 2, x: 10, y: 10, type: 'circle' };
      state.nodes = [n1, n2];
      rebuildIndex();
      expect(nodeIndex.get(1)).toBe(n1);
      expect(nodeIndex.get(2)).toBe(n2);
      expect(nodeIndex.size).toBe(2);
    });

    it('clears stale entries', () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      rebuildIndex();
      state.nodes = [];
      rebuildIndex();
      expect(nodeIndex.size).toBe(0);
    });
  });

  describe('undo/redo', () => {
    it('saveSnapshot captures current state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      saveSnapshot();
      expect(state.undoStack.length).toBe(1);
    });

    it('undo restores previous state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      rebuildIndex();
      saveSnapshot();
      state.nodes = [{ id: 1, x: 99, y: 99, type: 'rect' }];
      undo();
      expect(state.nodes[0].x).toBe(10);
      expect(state.nodes[0].y).toBe(20);
    });

    it('redo re-applies undone state', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      rebuildIndex();
      saveSnapshot();
      state.nodes = [{ id: 1, x: 99, y: 99, type: 'rect' }];
      rebuildIndex();
      undo();
      redo();
      expect(state.nodes[0].x).toBe(99);
    });

    it('preserves node.meta through undo/redo', () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'company', meta: { relevancy: 8 } }];
      rebuildIndex();
      saveSnapshot();
      state.nodes[0].meta.relevancy = 3;
      undo();
      expect(state.nodes[0].meta.relevancy).toBe(8);
      redo();
      expect(state.nodes[0].meta.relevancy).toBe(3);
    });

    it('saveSnapshot clears redo stack', () => {
      saveSnapshot();
      state.redoStack.push('something');
      saveSnapshot();
      expect(state.redoStack.length).toBe(0);
    });
  });

  describe('event bus', () => {
    it('on/emit delivers events', () => {
      let called = false;
      on('test-event', () => { called = true; });
      emit('test-event');
      expect(called).toBe(true);
    });

    it('passes arguments to listeners', () => {
      let received = null;
      on('data', (val) => { received = val; });
      emit('data', 42);
      expect(received).toBe(42);
    });

    it('off removes listener', () => {
      let count = 0;
      const fn = () => { count++; };
      on('inc', fn);
      emit('inc');
      off('inc', fn);
      emit('inc');
      expect(count).toBe(1);
    });

    it('emit with no listeners does not throw', () => {
      expect(() => emit('nonexistent')).not.toThrow();
    });
  });
});
