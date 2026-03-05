---
name: module-pattern
description: How to create new ES modules in this vanilla JS node editor. Covers the init pattern, event dispatch, circular dependency avoidance, and integration into main.js.
trigger: When creating a new JS module, adding a new feature module, or wiring a new component into the editor
---

# Module Pattern — Netzwerk-Editor

## Architecture Overview

This editor uses **vanilla ES modules** with no framework. Each module:
- Exports an `init*()` function that wires DOM references and event listeners
- Exports stateless action functions (`show*`, `hide*`, `apply*`)
- Stores module-level state in `let` variables (not exported)
- Is initialized once in `src/js/main.js` in a specific order

## File Template

```javascript
/**
 * @ai-generated true
 * @agent claude-code
 * @created YYYY-MM-DD
 */
// ─── Module Name ───
import { state, nodeIndex, saveSnapshot } from './state.js';
import { autoSave } from './persistence.js';

let moduleEl;   // DOM reference, set during init
let moduleState; // Module-local state

export function initModuleName() {
  moduleEl = document.getElementById('my-element');
  // Wire event listeners here
  moduleEl.addEventListener('click', handleClick);
}

export function showModuleName(args) {
  // Populate from state, position, add .open class
}

export function hideModuleName() {
  moduleEl.classList.remove('open');
}
```

## Integration Checklist

1. **Create the module** at `src/js/<name>.js`
2. **Add HTML** to `src/index.html` (if it has DOM elements)
3. **Add CSS** to the appropriate `src/styles/*.css` file
4. **Import in `main.js`** and call `init*()` in the init sequence:
   ```javascript
   import { initMyModule } from './my-module.js';
   // In async function init():
   initMyModule();
   ```
5. **Import action functions** where needed (interactions.js, keyboard.js, etc.)

## Init Order (in `main.js`)

The init order matters — modules that depend on DOM elements must init after those elements exist:

```
initGrid()          — canvas grid
initRenderer()      — nodes-layer, connections-layer refs
initMinimap()       — minimap canvas
initContextMenu()   — context menu DOM
initColorPopup()    — simple color picker
initGradientPopup() — gradient picker
initFontPopup()     — font picker
initNodePopup()     — node properties popup
setZoomToRef(zoomTo) — breaks circular dep
initToolbar()       — toolbar buttons
initInteractions()  — mouse events on canvas
initKeyboard()      — keyboard shortcuts
setupContextMenu()  — contextmenu event wiring (uses imports from above)
initSidebar()       — sidebar panel
```

**Rule:** If your module needs a DOM element, init it BEFORE `initInteractions`. If it needs to respond to tool changes or selections, wire it in `interactions.js` or `keyboard.js`.

## Circular Dependency Avoidance

Modules must NOT import from modules that import from them. Common solutions:

1. **Lazy reference pattern** (used for `zoomTo`):
   ```javascript
   let _ref;
   export function setRef(fn) { _ref = fn; }
   // Later, call _ref() instead of importing directly
   ```

2. **Custom event dispatch** (used by all popups):
   ```javascript
   // In your module — signal that a re-render is needed:
   document.dispatchEvent(new CustomEvent('editor:render'));

   // main.js listens and calls fullRender() + autoSave()
   ```

3. **Callback injection** (used by interactions, keyboard):
   ```javascript
   export function initModule(fullRender) {
     fullRenderFn = fullRender; // Store for later use
   }
   ```

## Re-render Signal

**Never import `fullRender` directly.** Instead:
- Dispatch `editor:render` event (preferred for popups/panels)
- Accept `fullRender` as an init parameter (for core modules like interactions, keyboard)

## Key Files Reference

| File | Role |
|------|------|
| `main.js` | Entry point, init sequence, context menu wiring, fullRender |
| `state.js` | Global state, nodeIndex Map, undo/redo snapshots (createSnapshot/applySnapshot) |
| `renderer.js` | DOM node creation, connection SVG rendering, `domCache` Map for O(1) element lookup |
| `interactions.js` | All mouse events (drag, pan, select, connect, resize) — RAF-gated mousemove |
| `keyboard.js` | Keyboard shortcuts |
| `constants.js` | PALETTE, FONTS, STICKY_COLORS, defaults |
| `utils.js` | screenToCanvas, snapToGrid, showToast, esc, safeColor, validateProjectJSON, getNodesBoundingBox |
| `persistence.js` | localStorage autoSave (debounced 500ms) / autoSaveNow (immediate) / autoLoad |
| `node-popup.js` | Node properties popup — color/gradient, form/type, font editing |
