/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 *
 * @file        force-layout.js
 * @description Force-directed layout engine — repulsion, springs, hierarchy gravity
 * @depends-on  state.js, renderer.js, minimap.js
 * @used-by     main.js, interactions.js, toolbar.js, settings-panel.js, actions.js
 */
import { state, nodeIndex } from './state.js';
import { renderNodes, renderConnections } from './renderer.js';
import { updateMinimap } from './minimap.js';

// ── Runtime pin state (not persisted) ──
const pinnedNodes = new Set();

// ── Simulation config ──
const CONFIG = {
  repulsion: 800,
  springStiffness: 0.005,
  springLength: 180,
  hierarchyPull: 0.02,
  sectorRadius: 250,
  companyRadius: 120,
  damping: 0.85,
  minEnergy: 0.5,
  maxTicks: 120,
};

// ── Velocity storage ──
const velocities = new Map();

let animFrameId = null;
let running = false;

export function isLayoutRunning() { return running; }
export function isPinned(id) { return pinnedNodes.has(id); }
export function pinNode(id) { pinnedNodes.add(id); }
export function unpinNode(id) { pinnedNodes.delete(id); }
export function clearPins() { pinnedNodes.clear(); }

/**
 * Run the force simulation from current node positions.
 */
export function runForceLayout() {
  if (!state.physicsLayout) return;
  if (state.nodes.length < 2) return;

  velocities.clear();
  for (const n of state.nodes) {
    velocities.set(n.id, { vx: 0, vy: 0 });
  }

  running = true;
  let tick = 0;

  function step() {
    tick++;
    let totalEnergy = 0;

    const forces = new Map();
    for (const n of state.nodes) {
      forces.set(n.id, { fx: 0, fy: 0 });
    }

    // 1) Repulsion: all pairs
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = CONFIG.repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(a.id).fx -= fx;
        forces.get(a.id).fy -= fy;
        forces.get(b.id).fx += fx;
        forces.get(b.id).fy += fy;
      }
    }

    // 2) Spring attraction: connections
    for (const c of state.connections) {
      const a = nodeIndex.get(c.from);
      const b = nodeIndex.get(c.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const displacement = dist - CONFIG.springLength;
      const force = CONFIG.springStiffness * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces.get(a.id).fx += fx;
      forces.get(a.id).fy += fy;
      forces.get(b.id).fx -= fx;
      forces.get(b.id).fy -= fy;
    }

    // 3) Hierarchy gravity
    const centerNode = state.nodes.find(n => n.type === 'center');
    if (centerNode) {
      for (const n of state.nodes) {
        if (n === centerNode) continue;
        let target = null;
        let idealDist = CONFIG.springLength;

        if (n.type === 'sector') {
          target = centerNode;
          idealDist = CONFIG.sectorRadius;
        } else if (n.type === 'company' && n.parentId != null) {
          target = nodeIndex.get(n.parentId);
          idealDist = CONFIG.companyRadius;
        } else if (n.type === 'company') {
          const conn = state.connections.find(c => c.from === n.id || c.to === n.id);
          if (conn) {
            const otherId = conn.from === n.id ? conn.to : conn.from;
            const other = nodeIndex.get(otherId);
            if (other && (other.type === 'sector' || other.type === 'center')) {
              target = other;
              idealDist = CONFIG.companyRadius;
            }
          }
        }

        if (target) {
          const dx = target.x - n.x;
          const dy = target.y - n.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const pull = CONFIG.hierarchyPull * (dist - idealDist);
          forces.get(n.id).fx += (dx / dist) * pull;
          forces.get(n.id).fy += (dy / dist) * pull;
        }
      }
    }

    // ── Apply forces ──
    for (const n of state.nodes) {
      if (pinnedNodes.has(n.id)) continue;
      if (n.type === 'center') continue;

      const f = forces.get(n.id);
      const v = velocities.get(n.id);
      v.vx = (v.vx + f.fx) * CONFIG.damping;
      v.vy = (v.vy + f.fy) * CONFIG.damping;
      n.x += v.vx;
      n.y += v.vy;
      totalEnergy += v.vx * v.vx + v.vy * v.vy;
    }

    // ── Render ──
    renderNodes();
    renderConnections();

    // ── Check convergence ──
    if (totalEnergy < CONFIG.minEnergy || tick >= CONFIG.maxTicks) {
      running = false;
      animFrameId = null;
      updateMinimap();
      return;
    }

    animFrameId = requestAnimationFrame(step);
  }

  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(step);
}

export function stopForceLayout() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  running = false;
}

export function relayout() {
  clearPins();
  runForceLayout();
}
