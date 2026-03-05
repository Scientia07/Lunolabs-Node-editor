# Force-Directed Layout Engine — Design

**Date:** 2026-03-05
**Status:** Approved

## Summary

A lightweight force simulation that automatically arranges nodes into an organic, hierarchical layout. Runs on-demand (load, add/delete, re-layout button) and settles into place. Dragged nodes get pinned. Can be toggled off in settings.

## Forces

1. **Repulsion** — all node pairs push apart (k / distance^2), prevents overlap
2. **Spring attraction** — connected nodes pull toward each other
3. **Hierarchy gravity** — sectors pulled toward center; companies pulled toward parent sector

## Simulation Behavior

- Runs in requestAnimationFrame loop
- Updates node.x / node.y each tick, then re-renders
- Stops when total kinetic energy drops below threshold (~50-80 ticks)
- Triggers: project load, node add/delete, explicit "Re-layout" button

## Node Pinning

- Dragged node gets `pinned = true` (runtime only, not persisted)
- Pinned nodes stay fixed; neighbors readjust around them
- "Re-layout" clears all pins and re-runs simulation

## Hierarchy Rules

| Node type                | Attracted to         | Ideal distance |
|--------------------------|----------------------|----------------|
| sector                   | center node          | ~200-300px     |
| company (with parentId)  | parent sector        | ~80-150px      |
| company (no parent)      | center node          | ~350px         |
| other types              | nearest connected    | rest length    |

## Settings Toggle

- `state.settings.physicsLayout` — checkbox in settings panel
- Default ON for netzwerk projects, OFF otherwise
- When OFF: current manual placement, no forces
- Persisted per project

## Toolbar

- "Re-layout" button/icon that clears pins and re-runs simulation

## New Module

`src/js/force-layout.js` (~150-200 lines)

Exports:
- `initForceLayout()` — wire up event listeners
- `runForceLayout()` — start simulation from current positions
- `stopForceLayout()` — halt simulation
- `pinNode(id)` / `unpinNode(id)` — manual pin control

## Unchanged

- Save format (x, y saved after settle)
- Manual drag works (pins the node)
- All node types, styles, connections untouched
- Non-netzwerk projects get flat layout (no hierarchy forces)

## Performance

- 130 nodes x 22 connections = trivial (~1ms/tick)
- RAF-gated, stops after settling — zero ongoing CPU
- nodeIndex Map for O(1) lookups
