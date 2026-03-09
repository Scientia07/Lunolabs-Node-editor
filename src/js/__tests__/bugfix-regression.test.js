/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-06
 */
/**
 * Regression tests for bugs found in 2026-03-06 audit.
 * These test the logic patterns that caused the bugs,
 * not the full DOM interaction flows.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';

// ─── BUG-2: Self-loop prevention in endpoint drag ───
// The endpoint drag handler must prevent conn.from === conn.to.
// We test the guard logic extracted from interactions.js:430-444.

describe('BUG-2: endpoint drag self-loop prevention', () => {
  function applyEndpointDrag(conn, end, resultNodeId) {
    const otherId = end === 'from' ? conn.to : conn.from;
    if (resultNodeId !== otherId) {
      if (end === 'from') {
        conn.from = resultNodeId;
      } else {
        conn.to = resultNodeId;
      }
    }
  }

  it('allows reassigning FROM to a different node', () => {
    const conn = { from: 1, to: 2 };
    applyEndpointDrag(conn, 'from', 3);
    expect(conn.from).toBe(3);
    expect(conn.to).toBe(2);
  });

  it('allows reassigning TO to a different node', () => {
    const conn = { from: 1, to: 2 };
    applyEndpointDrag(conn, 'to', 3);
    expect(conn.from).toBe(1);
    expect(conn.to).toBe(3);
  });

  it('prevents self-loop when dragging FROM onto TO node', () => {
    const conn = { from: 1, to: 2 };
    applyEndpointDrag(conn, 'from', 2);
    // Should NOT change — would create self-loop
    expect(conn.from).toBe(1);
    expect(conn.to).toBe(2);
  });

  it('prevents self-loop when dragging TO onto FROM node', () => {
    const conn = { from: 1, to: 2 };
    applyEndpointDrag(conn, 'to', 1);
    // Should NOT change — would create self-loop
    expect(conn.from).toBe(1);
    expect(conn.to).toBe(2);
  });

  it('allows keeping the same endpoint (no-op drag)', () => {
    const conn = { from: 1, to: 2 };
    applyEndpointDrag(conn, 'from', 1);
    // Dragging FROM back to its own node is fine (not a self-loop)
    expect(conn.from).toBe(1);
  });
});

// ─── BUG-3: Sidebar-aware viewport centering ───
// navigateToNode must account for sidebar width when computing panX.

describe('BUG-3: sidebar-aware pan centering', () => {
  function computePan(nodeX, nodeY, nodeW, nodeH, zoom, viewportW, viewportH, sidebarW) {
    const cw = viewportW - sidebarW;
    const ch = viewportH;
    return {
      panX: sidebarW + cw / 2 - (nodeX + nodeW / 2) * zoom,
      panY: ch / 2 - (nodeY + nodeH / 2) * zoom,
    };
  }

  it('centers node in viewport without sidebar', () => {
    const { panX } = computePan(100, 100, 120, 60, 1, 1000, 800, 0);
    // Node center = 100 + 60 = 160. Viewport center = 500. panX = 500 - 160 = 340
    expect(panX).toBe(340);
  });

  it('offsets centering when sidebar is open', () => {
    const withSidebar = computePan(100, 100, 120, 60, 1, 1000, 800, 280);
    const withoutSidebar = computePan(100, 100, 120, 60, 1, 1000, 800, 0);
    // With sidebar, the visible canvas center is shifted right
    expect(withSidebar.panX).not.toBe(withoutSidebar.panX);
    // panX with sidebar: 280 + (1000-280)/2 - 160 = 280 + 360 - 160 = 480
    expect(withSidebar.panX).toBe(480);
  });

  it('accounts for zoom when centering', () => {
    const zoom2 = computePan(100, 100, 120, 60, 2, 1000, 800, 0);
    // At 2x zoom, node center in screen coords = 160 * 2 = 320. panX = 500 - 320 = 180
    expect(zoom2.panX).toBe(180);
  });

  it('centers Y axis correctly', () => {
    const { panY } = computePan(100, 200, 120, 60, 1, 1000, 800, 0);
    // Node center Y = 200 + 30 = 230. Viewport center Y = 400. panY = 400 - 230 = 170
    expect(panY).toBe(170);
  });
});

// ─── BUG-4: Stale node reference in details handlers ───
// After deletion, handlers must not crash or mutate stale objects.

describe('BUG-4: stale node reference safety', () => {
  beforeEach(() => {
    state.nodes = [
      { id: 1, x: 0, y: 0, type: 'company', label: 'Test', meta: { relevancy: 5 } },
      { id: 2, x: 100, y: 0, type: 'sector', label: 'Sector' },
    ];
    state.connections = [];
    state.nextId = 10;
    state.selectedIds = new Set();
    state.undoStack = [];
    state.redoStack = [];
    state.groups = [];
    state.hiddenSectors = new Set();
    rebuildIndex();
  });

  it('nodeIndex.get() returns undefined for deleted nodes', () => {
    expect(nodeIndex.get(1)).toBeDefined();
    // Simulate deletion
    state.nodes = state.nodes.filter(n => n.id !== 1);
    rebuildIndex();
    expect(nodeIndex.get(1)).toBeUndefined();
  });

  it('handler pattern safely skips deleted nodes', () => {
    const nodeId = 1;
    const getNode = () => nodeIndex.get(nodeId);

    // Node exists — handler works
    const n1 = getNode();
    expect(n1).toBeDefined();
    expect(n1.meta.relevancy).toBe(5);

    // Delete node
    state.nodes = state.nodes.filter(n => n.id !== 1);
    rebuildIndex();

    // Handler pattern: getNode() returns undefined, early return
    const n2 = getNode();
    expect(n2).toBeUndefined();
    // This simulates: `const n = getNode(); if (!n) return;`
    // No crash, no stale mutation
  });

  it('stale reference would mutate detached object (the old bug)', () => {
    const staleRef = nodeIndex.get(1); // capture direct reference
    expect(staleRef.meta.relevancy).toBe(5);

    // Delete and rebuild
    state.nodes = state.nodes.filter(n => n.id !== 1);
    rebuildIndex();

    // Stale ref still points to the old object — this is the bug
    staleRef.meta.relevancy = 99;
    expect(staleRef.meta.relevancy).toBe(99); // mutates detached object
    // But it's NOT in state.nodes anymore — data is silently lost
    expect(state.nodes.find(n => n.id === 1)).toBeUndefined();
  });
});
