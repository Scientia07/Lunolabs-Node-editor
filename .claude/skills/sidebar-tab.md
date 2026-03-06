---
name: sidebar-tab
description: How to add a new tab to the sidebar panel. Covers HTML structure, tab switching, content rendering, and keyboard shortcut integration.
trigger: When adding a new sidebar tab, creating a new sidebar panel, or extending the sidebar with new content
---

# Sidebar Tab Pattern — Netzwerk-Editor

## Architecture

The sidebar has 5 tabs: Verbindungen, Gruppen, Details, Suche, Einstellungen. Each tab is a `<button>` in a `<div class="sidebar-tabs">` tablist, with a matching `<div class="tab-pane">` content area.

Tab switching is handled by `sidebar.js:initSidebar()` — clicking a tab button sets `activeTab` and toggles `.active` classes on both the button and its pane.

Content rendering happens in `sidebar.js:refreshSidebar()` — a dispatcher that calls the appropriate render function based on `activeTab`.

## Adding a New Tab

### 1. HTML (`src/index.html`)

Add a tab button in the `.sidebar-tabs` tablist:

```html
<button class="sidebar-tab" data-tab="mytab" role="tab" aria-selected="false" aria-controls="tab-mytab">My Tab</button>
```

Add a tab pane in `.sidebar-content`:

```html
<div class="tab-pane" data-tab="mytab" id="tab-mytab" role="tabpanel"></div>
```

**Order matters** — tabs render left-to-right. Place your tab before "Einstellungen" (settings is always last).

### 2. Render Function

Create a render function in your module (or in sidebar.js for simple tabs):

```javascript
// In your-module.js
export function renderMyTab(contentEl) {
  const pane = contentEl.querySelector('[data-tab="mytab"]');
  if (!pane) return;

  // Only rebuild structure once (avoid destroying input state on re-render)
  if (!pane.querySelector('.my-input')) {
    pane.innerHTML = `
      <input class="my-input" id="my-input" placeholder="...">
      <div class="my-results" id="my-results"></div>`;

    // Wire event listeners ONCE during structure creation
    pane.querySelector('#my-input').addEventListener('input', handleInput);
  }

  // Update dynamic content (called on every refreshSidebar)
  updateResults(pane);
}
```

**Key pattern:** Check if the DOM structure already exists before rebuilding. This preserves input focus, scroll position, and typed text across re-renders triggered by `emit('render')`.

### 3. Wire into Sidebar Dispatcher

In `sidebar.js:refreshSidebar()`, add your tab case:

```javascript
else if (activeTab === 'mytab') renderMyTab(contentEl);
```

Import your render function at the top of sidebar.js.

### 4. Keyboard Shortcut (Optional)

To add a shortcut that switches to your tab (like Ctrl+K for search):

In `keyboard.js`, add BEFORE the input guard (so it works from any context):

```javascript
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
  e.preventDefault();
  focusMyTab();
  return;
}
```

Your `focusMyTab()` function should:
1. Open sidebar if closed: `document.body.classList.add('sidebar-open')`
2. Activate your tab: toggle `.active` on buttons and panes
3. Focus your input: `requestAnimationFrame(() => input.focus())`

### 5. CSS (`src/styles/sidebar.css`)

Add styles under a section comment:

```css
/* ── My Tab ── */
.my-input { ... }
.my-results { ... }
```

Follow the existing pattern: `var(--bg)` for input backgrounds, `var(--border)` for borders, `var(--text-dim)` for secondary text, `var(--accent-dim)` for hover/active backgrounds.

## Existing Tabs Reference

| Tab | `data-tab` | Renderer | Module |
|-----|-----------|----------|--------|
| Verbindungen | `connections` | `renderConnectionsTab()` | sidebar.js |
| Gruppen | `groups` | `renderGroupsTab()` | sidebar.js |
| Details | `details` | `renderDetailsTab()` | sidebar.js |
| Suche | `search` | `renderSearchTab()` | search.js |
| Einstellungen | `settings` | `renderSettingsTab()` | settings-panel.js |

## Important Notes

- The sidebar only renders when open (`document.body.classList.contains('sidebar-open')`)
- `refreshSidebar()` is called on every `emit('render')` via the `editor:render` DOM event
- Avoid re-creating event listeners on every render — check if structure exists first
- Tab content is lazy: only the active tab's render function runs
