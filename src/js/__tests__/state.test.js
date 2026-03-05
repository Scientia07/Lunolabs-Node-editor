/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  state,
  nodeIndex,
  rebuildIndex,
  genId,
  saveSnapshot,
  undo,
  redo,
  on,
  off,
  emit,
} from '../state.js';
import { MAX_UNDO } from '../constants.js';

// ─── Reset helper ───

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

  // Clear all event-bus listeners between tests by emitting nothing —
  // we re-register per-test as needed. The listeners Map is module-private,
  // so we remove known events manually.
  const noop = () => {};
  off('render', noop);
  off('save', noop);
});

// ─── genId ───

describe('genId()', () => {
  it('returns incrementing IDs starting from current nextId', () => {
    expect(genId()).toBe(1);
    expect(genId()).toBe(2);
    expect(genId()).toBe(3);
  });

  it('continues from a custom starting value', () => {
    state.nextId = 100;
    expect(genId()).toBe(100);
    expect(genId()).toBe(101);
  });

  it('increments state.nextId as a side-effect', () => {
    genId();
    expect(state.nextId).toBe(2);
  });
});

// ─── rebuildIndex ───

describe('rebuildIndex()', () => {
  it('populates nodeIndex from state.nodes', () => {
    const a = { id: 1, label: 'A' };
    const b = { id: 2, label: 'B' };
    state.nodes = [a, b];

    rebuildIndex();

    expect(nodeIndex.size).toBe(2);
    expect(nodeIndex.get(1)).toBe(a);
    expect(nodeIndex.get(2)).toBe(b);
  });

  it('clears stale entries that are no longer in state.nodes', () => {
    const old = { id: 99, label: 'old' };
    nodeIndex.set(99, old);

    state.nodes = [{ id: 1, label: 'new' }];
    rebuildIndex();

    expect(nodeIndex.has(99)).toBe(false);
    expect(nodeIndex.size).toBe(1);
  });

  it('handles empty nodes array', () => {
    nodeIndex.set(1, { id: 1 });
    state.nodes = [];

    rebuildIndex();

    expect(nodeIndex.size).toBe(0);
  });
});

// ─── saveSnapshot ───

describe('saveSnapshot()', () => {
  it('pushes a snapshot onto undoStack', () => {
    state.nodes = [{ id: 1, x: 10, y: 20 }];
    saveSnapshot();

    expect(state.undoStack.length).toBe(1);
    const snap = JSON.parse(state.undoStack[0]);
    expect(snap.nodes).toEqual([{ id: 1, x: 10, y: 20 }]);
  });

  it('clears the redoStack on save', () => {
    state.redoStack = ['placeholder'];
    saveSnapshot();

    expect(state.redoStack).toEqual([]);
  });

  it('captures connections, nextId, groups, and hiddenSectors', () => {
    state.connections = [{ from: 1, to: 2 }];
    state.nextId = 5;
    state.groups = [{ id: 'g1', name: 'Group 1', nodeIds: [1] }];
    state.hiddenSectors = new Set(['s1', 's2']);

    saveSnapshot();

    const snap = JSON.parse(state.undoStack[0]);
    expect(snap.connections).toEqual([{ from: 1, to: 2 }]);
    expect(snap.nextId).toBe(5);
    expect(snap.groups).toEqual([{ id: 'g1', name: 'Group 1', nodeIds: [1] }]);
    expect(snap.hiddenSectors).toEqual(['s1', 's2']);
  });

  it('respects MAX_UNDO limit by shifting oldest entries', () => {
    for (let i = 0; i < MAX_UNDO + 10; i++) {
      state.nodes = [{ id: i }];
      saveSnapshot();
    }

    expect(state.undoStack.length).toBe(MAX_UNDO);

    // The oldest snapshot should be the 11th one (index 10), not the 1st
    const oldest = JSON.parse(state.undoStack[0]);
    expect(oldest.nodes[0].id).toBe(10);
  });
});

// ─── undo / redo ───

describe('undo()', () => {
  beforeEach(() => {
    // Register dummy listeners so emit('render') / emit('save') don't fail
    on('render', () => {});
    on('save', () => {});
  });

  it('does nothing when undoStack is empty', () => {
    state.nodes = [{ id: 1 }];
    undo();
    // State unchanged
    expect(state.nodes).toEqual([{ id: 1 }]);
  });

  it('restores previous state from undoStack', () => {
    state.nodes = [{ id: 1, label: 'before' }];
    state.connections = [];
    state.nextId = 2;
    state.groups = [];
    state.hiddenSectors = new Set();
    saveSnapshot();

    // Modify state
    state.nodes = [{ id: 1, label: 'after' }, { id: 2, label: 'new' }];
    state.nextId = 3;

    undo();

    expect(state.nodes).toEqual([{ id: 1, label: 'before' }]);
    expect(state.nextId).toBe(2);
  });

  it('pushes current state onto redoStack', () => {
    saveSnapshot();
    state.nodes = [{ id: 99 }];

    undo();

    expect(state.redoStack.length).toBe(1);
    const snap = JSON.parse(state.redoStack[0]);
    expect(snap.nodes).toEqual([{ id: 99 }]);
  });

  it('rebuilds nodeIndex after undo', () => {
    const node = { id: 1, label: 'A' };
    state.nodes = [node];
    rebuildIndex();
    saveSnapshot();

    state.nodes = [];
    nodeIndex.clear();

    undo();

    expect(nodeIndex.size).toBe(1);
    expect(nodeIndex.get(1)).toEqual({ id: 1, label: 'A' });
  });

  it('clears selectedIds after undo', () => {
    saveSnapshot();
    state.selectedIds.add(1);
    state.selectedIds.add(2);

    undo();

    expect(state.selectedIds.size).toBe(0);
  });

  it('emits render and save events', () => {
    const renderSpy = vi.fn();
    const saveSpy = vi.fn();
    on('render', renderSpy);
    on('save', saveSpy);

    saveSnapshot();
    undo();

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});

describe('redo()', () => {
  beforeEach(() => {
    on('render', () => {});
    on('save', () => {});
  });

  it('does nothing when redoStack is empty', () => {
    state.nodes = [{ id: 1 }];
    redo();
    expect(state.nodes).toEqual([{ id: 1 }]);
  });

  it('re-applies a previously undone state', () => {
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.groups = [];
    state.hiddenSectors = new Set();
    saveSnapshot();

    state.nodes = [{ id: 1, label: 'added' }];
    state.nextId = 2;
    saveSnapshot();

    // Undo twice to go back to empty
    undo();

    // Now redo to get the added node back
    redo();

    expect(state.nodes).toEqual([{ id: 1, label: 'added' }]);
    expect(state.nextId).toBe(2);
  });

  it('pushes current state onto undoStack when redoing', () => {
    saveSnapshot();
    state.nodes = [{ id: 5 }];
    saveSnapshot();

    undo();
    const undoLenBefore = state.undoStack.length;

    redo();

    expect(state.undoStack.length).toBe(undoLenBefore + 1);
  });

  it('restores hiddenSectors as a Set', () => {
    // Save snapshot of initial empty state
    saveSnapshot();

    // Change hiddenSectors, then save again
    state.hiddenSectors = new Set(['sector-a', 'sector-b']);

    // Undo: pops the empty-state snapshot, pushes current (with sectors) to redo
    undo();
    expect(state.hiddenSectors.size).toBe(0);

    // Redo: pops the sectors snapshot from redoStack
    redo();
    expect(state.hiddenSectors).toBeInstanceOf(Set);
    expect(state.hiddenSectors.has('sector-a')).toBe(true);
    expect(state.hiddenSectors.has('sector-b')).toBe(true);
  });
});

// ─── Event Bus ───

describe('Event Bus: on / emit / off', () => {
  it('delivers events with arguments to registered listeners', () => {
    const spy = vi.fn();
    on('test-event', spy);

    emit('test-event', 'arg1', 42);

    expect(spy).toHaveBeenCalledWith('arg1', 42);

    // Cleanup
    off('test-event', spy);
  });

  it('supports multiple listeners on the same event', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    on('multi', spy1);
    on('multi', spy2);

    emit('multi', 'data');

    expect(spy1).toHaveBeenCalledWith('data');
    expect(spy2).toHaveBeenCalledWith('data');

    off('multi', spy1);
    off('multi', spy2);
  });

  it('off() removes a specific listener', () => {
    const spy = vi.fn();
    on('removable', spy);

    off('removable', spy);
    emit('removable');

    expect(spy).not.toHaveBeenCalled();
  });

  it('off() on non-existent event does not throw', () => {
    const spy = vi.fn();
    expect(() => off('nonexistent', spy)).not.toThrow();
  });

  it('emit with no listeners does not throw', () => {
    expect(() => emit('no-listeners-here', 1, 2, 3)).not.toThrow();
  });

  it('emit with zero arguments works', () => {
    const spy = vi.fn();
    on('no-args', spy);

    emit('no-args');

    expect(spy).toHaveBeenCalledWith();
    off('no-args', spy);
  });

  it('removing one listener does not affect others on the same event', () => {
    const keep = vi.fn();
    const remove = vi.fn();
    on('partial', keep);
    on('partial', remove);

    off('partial', remove);
    emit('partial');

    expect(keep).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    off('partial', keep);
  });
});
