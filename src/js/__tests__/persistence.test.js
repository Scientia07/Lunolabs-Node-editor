import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { autoSave, autoSaveNow, autoLoad } from '../persistence.js';

describe('persistence.js', () => {
  beforeEach(() => {
    state.nodes = [];
    state.connections = [];
    state.nextId = 1;
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.gridEnabled = true;
    state.groups = [];
    state.hiddenSectors = new Set();
    state.hiddenNodes = new Set();
    state.isDirty = false;
    state.projectTitle = '';
    state.projectKey = null;
    nodeIndex.clear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('autoSaveNow', () => {
    it('saves state to localStorage', () => {
      state.nodes = [{ id: 1, x: 10, y: 20, type: 'rect' }];
      state.nextId = 2;
      autoSaveNow();
      const saved = JSON.parse(localStorage.getItem('network-editor-state'));
      expect(saved.nodes.length).toBe(1);
      expect(saved.nodes[0].x).toBe(10);
      expect(saved.nextId).toBe(2);
    });

    it('uses project-specific key when projectKey set', () => {
      state.projectKey = 'my-project';
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      autoSaveNow();
      expect(localStorage.getItem('network-editor-my-project')).not.toBeNull();
      expect(localStorage.getItem('network-editor-state')).toBeNull();
    });
  });

  describe('autoLoad', () => {
    it('loads saved state from localStorage', () => {
      localStorage.setItem('network-editor-state', JSON.stringify({
        nodes: [{ id: 1, x: 50, y: 60, type: 'sector' }],
        connections: [],
        nextId: 5,
        zoom: 1.5,
        panX: 100,
        panY: 200,
        gridEnabled: false,
        groups: [],
        hiddenSectors: [],
        projectTitle: 'Test',
      }));
      const result = autoLoad();
      expect(result).toBe(true);
      expect(state.nodes.length).toBe(1);
      expect(state.nodes[0].x).toBe(50);
      expect(state.nextId).toBe(5);
      expect(state.zoom).toBe(1.5);
      expect(state.gridEnabled).toBe(false);
      expect(state.projectTitle).toBe('Test');
    });

    it('returns false when no saved data', () => {
      expect(autoLoad()).toBe(false);
    });

    it('returns false for corrupt data', () => {
      localStorage.setItem('network-editor-state', '{"nodes": "not-an-array"}');
      expect(autoLoad()).toBe(false);
    });

    it('rebuilds node index after load', () => {
      localStorage.setItem('network-editor-state', JSON.stringify({
        nodes: [{ id: 7, x: 0, y: 0, type: 'rect' }],
        connections: [],
        nextId: 8,
      }));
      autoLoad();
      expect(state.nodes.length).toBe(1);
      expect(nodeIndex.get(7)).toBeDefined();
    });
  });

  describe('meta backward compatibility', () => {
    it('loads nodes with meta from localStorage', () => {
      const data = {
        nodes: [{ id: 1, x: 0, y: 0, type: 'company', meta: { relevancy: 8, contact: 'Test' } }],
        connections: [],
        nextId: 2,
      };
      localStorage.setItem('network-editor-state', JSON.stringify(data));
      const result = autoLoad();
      expect(result).toBe(true);
      expect(state.nodes[0].meta).toEqual({ relevancy: 8, contact: 'Test' });
    });

    it('loads old projects without meta gracefully', () => {
      const data = {
        nodes: [{ id: 1, x: 0, y: 0, type: 'company' }],
        connections: [],
        nextId: 2,
      };
      localStorage.setItem('network-editor-state', JSON.stringify(data));
      const result = autoLoad();
      expect(result).toBe(true);
      expect(state.nodes[0].meta).toBeUndefined();
    });
  });

  describe('isDirty', () => {
    it('autoSaveNow clears isDirty', () => {
      state.isDirty = true;
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      autoSaveNow();
      expect(state.isDirty).toBe(false);
    });

    it('hiddenNodes is persisted and restored', () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'company' }];
      state.hiddenNodes = new Set([1]);
      autoSaveNow();
      state.hiddenNodes = new Set();
      autoLoad();
      expect(state.hiddenNodes.has(1)).toBe(true);
    });
  });

  describe('autoSave debounce', () => {
    it('autoSave debounces — multiple calls result in one save', async () => {
      state.nodes = [{ id: 1, x: 0, y: 0, type: 'rect' }];
      autoSave();
      autoSave();
      autoSave();
      // Not saved yet (debounced)
      expect(localStorage.getItem('network-editor-state')).toBeNull();
      // Wait for debounce
      await new Promise(r => setTimeout(r, 600));
      expect(localStorage.getItem('network-editor-state')).not.toBeNull();
    });
  });
});
