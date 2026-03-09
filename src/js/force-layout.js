/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 *
 * @file        force-layout.js
 * @description Force-directed layout engine using d3-style alpha cooling.
 *              Repulsion (Coulomb), link springs (Hooke), radial hierarchy gravity.
 *              Company nodes orbit their parent sector; radius scales with sibling count.
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
function sizeMultiplier(node) { return SIZE_MULT[node.size] || 1.0; }

// ── Simulation config (d3-inspired) ──
const CONFIG = {
  // Alpha cooling — forces weaken over time so the graph settles
  alphaStart: 1.0,
  alphaMin: 0.001,
  alphaDecay: 0.028,        // ~250 ticks to cool (slightly faster than d3 default)

  // Velocity decay — friction each tick (d3 default = 0.4)
  velocityDecay: 0.4,

  // Repulsion (Coulomb charge)
  repulsion: 600,            // sector/center repulsion strength
  companyRepulsion: 350,     // company-company repulsion (they need to spread!)

  // Link springs (Hooke)
  springStiffness: 0.06,
  companySpringStiffness: 0.12, // companies track parent faster
  sectorSpringLength: 300,   // sector↔center or sector↔sector
  companySpringLength: 100,  // company↔sector (short — keep them close)

  // Radial hierarchy (d3 forceRadial style)
  sectorRadialStrength: 0.12,
  companyRadialStrength: 0.6,  // strong — companies must stick to their sector
  sectorRadius: 400,           // base sector orbit from center
  companyBaseRadius: 80,       // minimum company orbit from parent sector
  companyRadiusPerSibling: 12, // extra radius per sibling (spreads crowded sectors)

  maxTicks: 400,
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
 * Pre-compute lookup tables for the simulation:
 * - parentMap: companyId → parent node (sector it belongs to)
 * - siblingCount: sectorId → number of child companies
 */
function buildHierarchy() {
  const parentMap = new Map();
  const siblingCount = new Map();

  for (const n of state.nodes) {
    if (n.type !== 'company') continue;
    // Find parent via parentId first, then fall back to connections
    let parent = n.parentId != null ? nodeIndex.get(n.parentId) : null;
    if (!parent) {
      for (const c of state.connections) {
        if (c.from !== n.id && c.to !== n.id) continue;
        const otherId = c.from === n.id ? c.to : c.from;
        const other = nodeIndex.get(otherId);
        if (other && (other.type === 'sector' || other.type === 'center')) {
          parent = other;
          break;
        }
      }
    }
    if (parent) {
      parentMap.set(n.id, parent);
      siblingCount.set(parent.id, (siblingCount.get(parent.id) || 0) + 1);
    }
  }
  return { parentMap, siblingCount };
}

/**
 * Run the force simulation from current node positions.
 *
 * @param {object} [opts]
 * @param {number} [opts.alpha=1.0] Starting alpha (use ~0.3 for warm restarts after drag)
 */
export function runForceLayout(opts = {}) {
  if (!state.physicsLayout) return;
  if (state.nodes.length < 2) return;

  const startAlpha = opts.alpha ?? CONFIG.alphaStart;
  if (startAlpha >= CONFIG.alphaStart) {
    velocities.clear();
    for (const n of state.nodes) velocities.set(n.id, { vx: 0, vy: 0 });
  } else {
    for (const n of state.nodes) {
      if (!velocities.has(n.id)) velocities.set(n.id, { vx: 0, vy: 0 });
    }
  }

  const { parentMap, siblingCount } = buildHierarchy();
  const centerNode = state.nodes.find(n => n.type === 'center');

  running = true;
  let alpha = startAlpha;
  let tick = 0;

  function step() {
    tick++;
    alpha += (0 - alpha) * CONFIG.alphaDecay;

    // ── 1) Repulsion ──
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (dx === 0 && dy === 0) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; }
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        const isCompA = a.type === 'company';
        const isCompB = b.type === 'company';

        let strength;
        if (isCompA && isCompB) {
          // Same-parent companies need decent repulsion to spread out
          const sameParent = parentMap.get(a.id) === parentMap.get(b.id);
          strength = sameParent ? CONFIG.companyRepulsion * 1.5 : CONFIG.companyRepulsion * 0.3;
        } else if (isCompA || isCompB) {
          // Company↔sector/center: moderate repulsion
          strength = CONFIG.repulsion * 0.5;
        } else {
          // Sector↔sector or sector↔center: full repulsion
          strength = CONFIG.repulsion;
        }

        const w = strength * alpha / distSq;
        const fx = (dx / dist) * w;
        const fy = (dy / dist) * w;
        const va = velocities.get(a.id);
        const vb = velocities.get(b.id);
        va.vx -= fx; va.vy -= fy;
        vb.vx += fx; vb.vy += fy;
      }
    }

    // ── 2) Link springs ──
    for (const c of state.connections) {
      const a = nodeIndex.get(c.from);
      const b = nodeIndex.get(c.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

      // Shorter spring for company↔sector links
      const isCompanyLink = a.type === 'company' || b.type === 'company';
      const idealLen = isCompanyLink ? CONFIG.companySpringLength : CONFIG.sectorSpringLength;

      const displacement = (dist - idealLen) / dist;
      const stiffness = isCompanyLink ? CONFIG.companySpringStiffness : CONFIG.springStiffness;
      const force = stiffness * displacement * alpha;
      const fx = dx * force;
      const fy = dy * force;
      const va = velocities.get(a.id);
      const vb = velocities.get(b.id);
      va.vx += fx; va.vy += fy;
      vb.vx -= fx; vb.vy -= fy;
    }

    // ── 3) Radial hierarchy ──
    if (centerNode) {
      for (const n of state.nodes) {
        if (n === centerNode) continue;
        let target = null;
        let idealDist = 200;
        let strength = CONFIG.sectorRadialStrength;

        if (n.type === 'sector') {
          target = centerNode;
          idealDist = CONFIG.sectorRadius * sizeMultiplier(n);
          // Sub-sector: orbit parent sector instead
          const parentConn = state.connections.find(c =>
            c.to === n.id && nodeIndex.get(c.from)?.type === 'sector'
          );
          if (parentConn) {
            target = nodeIndex.get(parentConn.from);
            idealDist = 200 * sizeMultiplier(n);
          }
        } else if (n.type === 'company') {
          // Company → orbit its parent sector/center
          const parent = parentMap.get(n.id);
          if (parent) {
            target = parent;
            // Scale orbit radius by sibling count so crowded sectors spread more
            const siblings = siblingCount.get(parent.id) || 1;
            idealDist = CONFIG.companyBaseRadius + siblings * CONFIG.companyRadiusPerSibling;
            strength = CONFIG.companyRadialStrength;
          }
        }

        if (target) {
          const dx = target.x - n.x;
          const dy = target.y - n.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          // d3 forceRadial: push toward idealDist from target
          const k = (idealDist - dist) * strength * alpha / dist;
          const v = velocities.get(n.id);
          v.vx -= dx * k;
          v.vy -= dy * k;
        }
      }
    }

    // ── Apply velocity decay + update positions ──
    const decay = 1 - CONFIG.velocityDecay;
    for (const n of state.nodes) {
      if (pinnedNodes.has(n.id) || n.type === 'center') continue;
      const v = velocities.get(n.id);
      v.vx *= decay;
      v.vy *= decay;
      n.x += v.vx;
      n.y += v.vy;
    }

    // ── Render (skip full rebuild if a label is being edited) ──
    const editing = document.querySelector('[contenteditable="true"]');
    if (!editing) {
      renderNodes();
    }
    renderConnections();

    // ── Check convergence ──
    if (alpha < CONFIG.alphaMin || tick >= CONFIG.maxTicks) {
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
