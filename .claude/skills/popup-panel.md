---
name: popup-panel
description: How to create floating popup panels (color pickers, property editors, context menus) in this editor. Covers positioning, show/hide lifecycle, outside-click dismissal, and live preview patterns.
trigger: When creating a new popup, modal, floating panel, picker, or properties editor
---

# Popup & Panel Pattern — Netzwerk-Editor

## Popup Types in This Editor

| Type | Class | z-index | Example |
|------|-------|---------|---------|
| Context menu | `#context-menu` | 3000 | Right-click menu |
| Quick-add | `.quick-add-popup` | 3000 | Drag-to-create (Sektor/Eintrag) |
| Color picker | `.color-popup` | 2500 | Simple swatch picker |
| Popup panel | `.popup-panel` | 2500 | Gradient popup, font popup |
| Node popup | `.node-popup` | 2500 | Tabbed node properties popup |
| Conn popup | `.node-popup` (`#conn-popup`) | 2500 | Tabbed connection properties popup |
| Modal overlay | `.modal-overlay` | 5000 | Visibility export confirm, CSV import |

## Show/Hide Lifecycle

All popups use the same pattern:

```css
.my-popup { display: none; position: fixed; z-index: 2500; }
.my-popup.open { display: block; }
```

```javascript
function show(x, y) {
  // 1. Populate fields from current data
  // 2. Position near cursor/node, clamped to viewport
  popup.style.left = Math.min(x, window.innerWidth - POPUP_WIDTH) + 'px';
  popup.style.top = Math.min(y, window.innerHeight - POPUP_HEIGHT) + 'px';
  // 3. Show
  popup.classList.add('open');
}

function hide() {
  popup.classList.remove('open');
}
```

## Outside-Click Dismissal

Handled globally in `interactions.js:initInteractions()`:

```javascript
document.addEventListener('click', (e) => {
  if (!e.target.closest('.color-popup')
      && !e.target.closest('.popup-panel')
      && !e.target.closest('.node-popup')
      && !e.target.closest('.ctx-item')) {
    if (!popupJustOpened) {
      // Close all popups
    }
  }
});
```

**When adding a new popup class**, you MUST add it to this whitelist, otherwise clicks inside your popup will close it.

### The `popupJustOpened` Guard

If your popup opens on `mousedown`, the subsequent `click` event on the same press will trigger the outside-click handler. Set the guard:

```javascript
// In the mousedown handler that opens the popup:
popupJustOpened = true;
showMyPopup(e.clientX, e.clientY);
// The click handler checks and resets popupJustOpened
```

## Popup That Follows Selection (Node Popup Pattern)

For popups tied to node selection:

```javascript
export function showNodePopup(nodeId) {
  // Position relative to the node's DOM element (use domCache for O(1) lookup)
  const el = domCache.get(nodeId);
  const rect = el.getBoundingClientRect();
  let left = rect.right + 12;   // 12px gap to the right
  let top = rect.top;

  // Flip to left side if off-screen
  if (left + 270 > window.innerWidth) left = rect.left - 272;

  // Clamp to viewport
  if (left < 8) left = 8;
  if (top + 400 > window.innerHeight) top = window.innerHeight - 400;
  if (top < 8) top = 8;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('open');
}
```

**Reposition during drag:**
```javascript
export function repositionPopup() {
  if (!popup.classList.contains('open') || currentNodeId == null) return;
  // Same positioning logic as show()
}
// Called from interactions.js onMouseMove isDragging block
```

## Where to Call `hidePopup()`

Any code path that invalidates the popup's context must close it:

| Code Path | File | Why |
|-----------|------|-----|
| Click empty canvas | `interactions.js` | Deselects node |
| Select multiple nodes | `interactions.js` | Popup is single-node only |
| Click a connection | `interactions.js` | Selection shifts |
| Press Escape | `keyboard.js` | Clears selection |
| Press Delete | `keyboard.js` | Node may be deleted |
| Ctrl+Z / Ctrl+Y | `keyboard.js` | State reverted |
| Toolbar Undo/Redo | `toolbar.js` | State reverted |
| Rubber-band select 0 or 2+ | `interactions.js` | Multi-select |

## Live Preview Pattern (No Apply Button)

For immediate feedback popups:

```javascript
let _snapshotTaken = false;

function ensureSnapshot() {
  if (!_snapshotTaken) { saveSnapshot(); _snapshotTaken = true; }
}

inputEl.addEventListener('input', () => {
  ensureSnapshot();                    // One snapshot per popup session
  node.property = inputEl.value;       // Mutate directly
  document.dispatchEvent(new CustomEvent('editor:render')); // Re-render
});
```

## Apply Button Pattern (Existing Popups)

For popups with an explicit "Anwenden" button:

```javascript
applyBtn.addEventListener('click', () => {
  saveSnapshot();
  // Apply changes to target nodes
  gradTarget.forEach(id => {
    const n = nodeIndex.get(id);
    if (n) { n.color = ...; }
  });
  popup.classList.remove('open');
  document.dispatchEvent(new CustomEvent('editor:render'));
});
```

## Tab Switching (Node Popup)

```html
<div class="np-tabs">
  <button class="np-tab active" data-np-tab="color">Farbe</button>
  <button class="np-tab" data-np-tab="form">Form</button>
</div>
<div class="np-pane active" data-np-pane="color">...</div>
<div class="np-pane" data-np-pane="form">...</div>
```

```javascript
popup.querySelectorAll('.np-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    popup.querySelectorAll('.np-tab').forEach(t => t.classList.remove('active'));
    popup.querySelectorAll('.np-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    popup.querySelector(`[data-np-pane="${tab.dataset.npTab}"]`).classList.add('active');
  });
});
```

## CSS Conventions

Use existing CSS variables from `tokens.css`:
- `var(--bg-surface)` — popup background
- `var(--border)` — border color
- `var(--radius-lg)` — border radius
- `var(--shadow-lg)` — drop shadow
- `var(--accent)` — active/selected highlight
- `var(--text-dim)`, `var(--text-muted)` — label colors
- `var(--bg-elevated)` — hover/input backgrounds
- `var(--font-body)` — body font
- `var(--font-mono)` — monospace (hex values, numbers)

Reuse existing component classes:
- `.color-swatches` + `.color-swatch` — swatch grid
- `.color-row` — inline color picker + label
- `.gradient-preview` — gradient preview bar
- `.font-list` + `.font-option` — scrollable font list
- `.popup-btn` — full-width action button
- `.cp-toggle-row` — checkbox toggle with label (used in conn popup)

## Connection Popup Pattern (`conn-popup.js`)

The connection popup follows the same node-popup pattern but positions near the connection midpoint:

```javascript
export function showConnPopup(connId) {
  const conn = state.connections.find(c => c.id === connId);
  // Populate fields from conn properties (color, style, dash, width, outline, hidden)
  // Position near midpoint:
  const pts = getConnectionEndpoints(conn);
  const midScreenX = ((pts.fc.x + pts.tc.x) / 2) * state.zoom + state.panX;
  const midScreenY = ((pts.fc.y + pts.tc.y) / 2) * state.zoom + state.panY;
  // Clamp to viewport, show popup
}
```

**Show/hide triggers** (in `interactions.js`):
- Show: when `state.selectedConnId` is set (connection clicked)
- Hide: when connection deselected, node selected, or empty canvas clicked

The conn popup reuses the `.node-popup` CSS class for tab/pane styling — it's mutually exclusive with the node popup.

## Quick-Add Popup Pattern (`quick-add.js`)

A lightweight popup that uses closure-based cleanup instead of module-level state:

```javascript
export function showQuickAdd(screenX, screenY, canvasPos, fromId, fromAnchor) {
  // Position at cursor, show popup
  // Register click/mousedown/keydown listeners
  // On button click: create node + connection, hide popup
  // cleanup() removes all listeners on hide
}
```

**Key difference from other popups:** Quick-add uses `document.addEventListener('mousedown', onOutside, true)` (capture phase) for outside-click dismissal instead of the global click handler in `initInteractions()`. This is because the popup is ephemeral and self-cleaning — no need to add it to the global whitelist.

## Modal Overlay Pattern (Visibility Export, CSV Import)

For centered modal dialogs with backdrop:

```html
<div id="my-modal" class="modal-overlay" style="display:none" role="dialog" aria-label="..." aria-modal="true">
  <div class="modal-box" style="max-width:360px">
    <h3>Title</h3>
    <p>Message</p>
    <div class="modal-actions">
      <button class="modal-btn primary">OK</button>
      <button class="modal-btn cancel">Abbrechen</button>
    </div>
  </div>
</div>
```

Show/hide via `style.display`:
```javascript
modal.style.display = '';      // show (CSS handles flex centering)
modal.style.display = 'none';  // hide
```

**Standard features:**
- Escape key closes: `document.addEventListener('keydown', onKey)` — remove on cleanup
- Backdrop click closes: `modal.onclick = (e) => { if (e.target === modal) cleanup(); }`
- z-index 5000 (above all popups)
- Reusable CSS classes: `.modal-overlay`, `.modal-box`, `.modal-btn`, `.modal-btn.primary`, `.modal-btn.cancel`
