/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { autoSave, autoSaveNow, autoLoad } from '../persistence.js';

// ─── Helpers ───

/** Minimal valid node for testing */
function makeNode(id, overrides = {}) {
  return { id, x: 0, y: 0, type: 'rect', label: `Node ${id}`, ...overrides };
}

/** Build a valid saved-state object */
function makeSavedState(overrides = {}) {
  return {
    nodes: [makeNode(1), makeNode(2)],
    connections: [{ id: 1, from: 1, to: 2 }],
    nextId: 3,
    zoom: 1.5,
    panX: 100,
    panY: 200,
    gridEnabled: false,
    groups: [{ id: 'g1', name: 'Group 1', nodeIds: [1], hidden: false }],
    hiddenSectors: ['sectorA', 'sectorB'],
    projectTitle: 'Test Project',
    ...overrides,
  };
}

function resetState() {
  state.nodes = [];
  state.connections = [];
  state.nextId = 1;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.gridEnabled = true;
  state.groups = [];
  state.hiddenSectors = new Set();
  state.projectTitle = '';
  state.projectKey = null;
  nodeIndex.clear();
}

// ─── Tests ───

describe('persistence', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  // ─── autoSaveNow ───

  describe('autoSaveNow', () => {
    it('saves state to localStorage under default key', () => {
      state.nodes = [makeNode(1)];
      state.nextId = 2;

      autoSaveNow();

      const raw = localStorage.getItem('network-editor-state');
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw);
      expect(saved.nodes).toHaveLength(1);
      expect(saved.nodes[0].id).toBe(1);
    });

    it('uses project-specific key when state.projectKey is set', () => {
      state.projectKey = 'my-project';
      state.nodes = [makeNode(1)];

      autoSaveNow();

      expect(localStorage.getItem('network-editor-state')).toBeNull();
      const raw = localStorage.getItem('network-editor-my-project');
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw);
      expect(saved.nodes).toHaveLength(1);
    });

    it('saves all expected fields', () => {
      state.nodes = [makeNode(1)];
      state.connections = [{ id: 1, from: 1, to: 1 }];
      state.nextId = 5;
      state.zoom = 2;
      state.panX = 50;
      state.panY = -30;
      state.gridEnabled = false;
      state.groups = [{ id: 'g1', name: 'G', nodeIds: [], hidden: false }];
      state.hiddenSectors = new Set(['s1', 's2']);
      state.projectTitle = 'My Title';

      autoSaveNow();

      const saved = JSON.parse(localStorage.getItem('network-editor-state'));
      expect(saved.nodes).toEqual(state.nodes);
      expect(saved.connections).toEqual(state.connections);
      expect(saved.nextId).toBe(5);
      expect(saved.zoom).toBe(2);
      expect(saved.panX).toBe(50);
      expect(saved.panY).toBe(-30);
      expect(saved.gridEnabled).toBe(false);
      expect(saved.groups).toEqual(state.groups);
      expect(saved.hiddenSectors).toEqual(['s1', 's2']);
      expect(saved.projectTitle).toBe('My Title');
    });

    it('serializes hiddenSectors Set as an array', () => {
      state.hiddenSectors = new Set(['a', 'b', 'c']);

      autoSaveNow();

      const saved = JSON.parse(localStorage.getItem('network-editor-state'));
      expect(Array.isArray(saved.hiddenSectors)).toBe(true);
      expect(saved.hiddenSectors).toContain('a');
      expect(saved.hiddenSectors).toContain('b');
      expect(saved.hiddenSectors).toContain('c');
    });

    it('handles empty state gracefully', () => {
      autoSaveNow();

      const saved = JSON.parse(localStorage.getItem('network-editor-state'));
      expect(saved.nodes).toEqual([]);
      expect(saved.connections).toEqual([]);
      expect(saved.groups).toEqual([]);
      expect(saved.hiddenSectors).toEqual([]);
      expect(saved.projectTitle).toBe('');
    });
  });

  // ─── autoLoad ───

  describe('autoLoad', () => {
    it('loads saved state from localStorage and returns true', () => {
      const data = makeSavedState();
      localStorage.setItem('network-editor-state', JSON.stringify(data));

      const result = autoLoad();

      expect(result).toBe(true);
      expect(state.nodes).toHaveLength(2);
      expect(state.connections).toHaveLength(1);
      expect(state.nextId).toBe(3);
      expect(state.zoom).toBe(1.5);
      expect(state.panX).toBe(100);
      expect(state.panY).toBe(200);
      expect(state.gridEnabled).toBe(false);
      expect(state.groups).toEqual(data.groups);
      expect(state.projectTitle).toBe('Test Project');
    });

    it('returns false when no saved data exists', () => {
      const result = autoLoad();
      expect(result).toBe(false);
    });

    it('returns false for corrupt/invalid data (nodes not array)', () => {
      localStorage.setItem('network-editor-state', JSON.stringify({ nodes: 'not-an-array' }));

      const result = autoLoad();

      expect(result).toBe(false);
      // State should remain unchanged
      expect(state.nodes).toEqual([]);
    });

    it('returns false for unparseable JSON', () => {
      localStorage.setItem('network-editor-state', '{bad json!!!');

      const result = autoLoad();

      expect(result).toBe(false);
    });

    it('rebuilds nodeIndex after load', () => {
      const data = makeSavedState({
        nodes: [makeNode(10, { x: 5, y: 5 }), makeNode(20, { x: 10, y: 10 })],
        nextId: 21,
      });
      localStorage.setItem('network-editor-state', JSON.stringify(data));

      autoLoad();

      expect(nodeIndex.size).toBe(2);
      expect(nodeIndex.get(10)).toBeDefined();
      expect(nodeIndex.get(10).id).toBe(10);
      expect(nodeIndex.get(20)).toBeDefined();
      expect(nodeIndex.get(20).id).toBe(20);
    });

    it('restores hiddenSectors as a Set', () => {
      const data = makeSavedState({ hiddenSectors: ['x', 'y'] });
      localStorage.setItem('network-editor-state', JSON.stringify(data));

      autoLoad();

      expect(state.hiddenSectors).toBeInstanceOf(Set);
      expect(state.hiddenSectors.has('x')).toBe(true);
      expect(state.hiddenSectors.has('y')).toBe(true);
      expect(state.hiddenSectors.size).toBe(2);
    });

    it('loads from project-specific key when projectKey is set', () => {
      state.projectKey = 'proj-1';
      const data = makeSavedState({ projectTitle: 'Project 1' });
      localStorage.setItem('network-editor-proj-1', JSON.stringify(data));

      const result = autoLoad();

      expect(result).toBe(true);
      expect(state.projectTitle).toBe('Project 1');
    });

    it('defaults gridEnabled to true when not explicitly false', () => {
      const data = makeSavedState();
      delete data.gridEnabled;
      localStorage.setItem('network-editor-state', JSON.stringify(data));

      autoLoad();

      expect(state.gridEnabled).toBe(true);
    });

    it('defaults missing optional fields', () => {
      const data = {
        nodes: [makeNode(1)],
        nextId: 2,
      };
      localStorage.setItem('network-editor-state', JSON.stringify(data));

      autoLoad();

      expect(state.connections).toEqual([]);
      expect(state.groups).toEqual([]);
      expect(state.hiddenSectors).toBeInstanceOf(Set);
      expect(state.hiddenSectors.size).toBe(0);
      expect(state.projectTitle).toBe('');
      expect(state.zoom).toBe(1);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
    });
  });

  // ─── autoSave debounce ───

  describe('autoSave debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not save immediately when autoSave is called', () => {
      state.nodes = [makeNode(1)];

      autoSave();

      expect(localStorage.getItem('network-editor-state')).toBeNull();
    });

    it('saves after 500ms', () => {
      state.nodes = [makeNode(1)];

      autoSave();
      vi.advanceTimersByTime(500);

      const raw = localStorage.getItem('network-editor-state');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw).nodes).toHaveLength(1);
    });

    it('multiple rapid autoSave calls result in one save after 500ms', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      autoSave();
      vi.advanceTimersByTime(100);
      state.nodes = [makeNode(1)];
      autoSave();
      vi.advanceTimersByTime(100);
      state.nodes = [makeNode(1), makeNode(2)];
      autoSave();
      vi.advanceTimersByTime(100);
      state.nodes = [makeNode(1), makeNode(2), makeNode(3)];
      autoSave();

      // Only 300ms since last call, should not have saved yet
      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      // Now it should have saved exactly once with the final state
      const calls = spy.mock.calls.filter(([key]) => key === 'network-editor-state');
      expect(calls).toHaveLength(1);
      const saved = JSON.parse(calls[0][1]);
      expect(saved.nodes).toHaveLength(3);

      spy.mockRestore();
    });

    it('autoSaveNow cancels pending debounced save and saves immediately', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      state.nodes = [makeNode(1)];
      autoSave();

      // Before debounce fires, call autoSaveNow with updated state
      vi.advanceTimersByTime(200);
      state.nodes = [makeNode(1), makeNode(2)];
      autoSaveNow();

      // Should have saved immediately with 2 nodes
      const immediateCalls = spy.mock.calls.filter(([key]) => key === 'network-editor-state');
      expect(immediateCalls).toHaveLength(1);
      expect(JSON.parse(immediateCalls[0][1]).nodes).toHaveLength(2);

      // Advance past original debounce time -- no additional save
      spy.mockClear();
      vi.advanceTimersByTime(500);
      const laterCalls = spy.mock.calls.filter(([key]) => key === 'network-editor-state');
      expect(laterCalls).toHaveLength(0);

      spy.mockRestore();
    });
  });
});
