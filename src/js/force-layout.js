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

// ── Size multipliers for sector orbit radius ──
const SIZE_MULT = { lg: 1.4, md: 1.0, sm: 0.7, xs: 0.5 };

function sizeMultiplier(node) {
  return SIZE_MULT[node.size] || 1.0;
}

// ── Simulation config ──
const CONFIG = {
  repulsion: 1200,         // stronger repulsion for more spacing
  springStiffness: 0.008,
  springLength: 200,
  hierarchyPull: 0.03,     // stronger pull to keep hierarchy tight
  companyPull: 0.06,       // even stronger for text labels near parent
  sectorRadius: 280,       // base sector orbit distance (scaled by size)
  companyRadius: 70,       // text labels stay close to parent
  damping: 0.82,
  minEnergy: 0.5,
  maxTicks: 150,
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

    // 1) Repulsion: all pairs (reduced for text-style company nodes)
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        // Text-style companies (parentId) repel less — they're small labels
        const isTextA = a.type === 'company' && a.parentId != null;
        const isTextB = b.type === 'company' && b.parentId != null;
        const repMult = (isTextA && isTextB) ? 0.15 : (isTextA || isTextB) ? 0.4 : 1.0;
        const force = (CONFIG.repulsion * repMult) / (dist * dist);
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

    // 3) Hierarchy gravity (size-aware)
    const centerNode = state.nodes.find(n => n.type === 'center');
    if (centerNode) {
      for (const n of state.nodes) {
        if (n === centerNode) continue;
        let target = null;
        let idealDist = CONFIG.springLength;
        let pullStrength = CONFIG.hierarchyPull;

        if (n.type === 'sector') {
          // Sectors orbit center — distance scales with sector size
          target = centerNode;
          idealDist = CONFIG.sectorRadius * sizeMultiplier(n);
          // Check if this sector connects to another sector (not center)
          const parentConn = state.connections.find(c =>
            c.to === n.id && nodeIndex.get(c.from)?.type === 'sector'
          );
          if (parentConn) {
            // Sub-sector: orbit parent sector instead of center
            target = nodeIndex.get(parentConn.from);
            idealDist = 160 * sizeMultiplier(n);
          }
        } else if (n.type === 'company' && n.parentId != null) {
          // Text labels stay tight to their parent sector
          target = nodeIndex.get(n.parentId);
          idealDist = CONFIG.companyRadius;
          pullStrength = CONFIG.companyPull; // stronger pull for text labels
        } else if (n.type === 'company') {
          // Unparented company — find connected sector
          const conn = state.connections.find(c => c.from === n.id || c.to === n.id);
          if (conn) {
            const otherId = conn.from === n.id ? conn.to : conn.from;
            const other = nodeIndex.get(otherId);
            if (other && (other.type === 'sector' || other.type === 'center')) {
              target = other;
              idealDist = CONFIG.companyRadius;
              pullStrength = CONFIG.companyPull;
            }
          }
        }

        if (target) {
          const dx = target.x - n.x;
          const dy = target.y - n.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const pull = pullStrength * (dist - idealDist);
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
