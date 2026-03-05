/**
 * ─── File Rating ──────────────────────────────
 * @file        main.js
 * @description App entry point — init sequence, event bus wiring, context menu setup
 * @version     2.0
 * @date        2026-03-05
 * @rating      8/10
 * @depends-on  state.js, grid.js, renderer.js, minimap.js, transform.js, context-menu.js,
 *              color-popup.js, gradient-popup.js, font-popup.js, toolbar.js, interactions.js,
 *              keyboard.js, persistence.js, actions.js, theme.js, project.js, sidebar.js, node-popup.js
 * @used-by     index.html (entry point)
 * @strengths   Clear init sequence, deferred non-critical UI via requestAnimationFrame
 * @issues      Context menu wiring is inline — could be extracted to own module
 * ─────────────────────────────────────────────── */
// ─── Main Entry Point ───
import { state, rebuildIndex, on, emit } from './state.js';
import { initGrid, drawGrid } from './grid.js';
import { initRenderer, renderNodes, renderConnections, renderSelectionState } from './renderer.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { updateTransform, zoomTo, zoomFit } from './transform.js';
import { initContextMenu, clearContextMenu, addCtxItem, addCtxSep, showContextMenuAt, closeMenus } from './context-menu.js';
import { initColorPopup, showColorPopup } from './color-popup.js';
import { initGradientPopup, showGradientPopup } from './gradient-popup.js';
import { initFontPopup, showFontPopup } from './font-popup.js';
import { initToolbar, setTool } from './toolbar.js';
import { initInteractions, setZoomToRef, editNodeLabel } from './interactions.js';
import { initQuickAdd } from './quick-add.js';
import { initConnPopup } from './conn-popup.js';
import { initKeyboard } from './keyboard.js';
import { autoSave, autoSaveNow, autoLoad } from './persistence.js';
import { deleteSelected, duplicateSelected } from './actions.js';
import { applyTheme } from './theme.js';
import { loadFromURL } from './project.js';
import { nodeIndex, saveSnapshot } from './state.js'; // re-import ok (same module)
import { initSidebar, refreshSidebar, applyVisibility } from './sidebar.js';
import { initNodePopup } from './node-popup.js';
import { runForceLayout } from './force-layout.js';

// ─── Full Render ───
function fullRender() {
  renderNodes();
  renderConnections();
  applyVisibility();
  updateTransform();
  // Non-critical UI updates deferred to next frame
  requestAnimationFrame(() => {
    updateMinimap();
    refreshSidebar();
  });
}

// ─── Register event bus listeners ───
on('render', fullRender);
on('save', autoSave);

// ─── Context Menu Wiring ───
function setupContextMenu() {
  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = e.target.closest('.node');
    const connEl = e.target.closest('path[data-id]') || e.target.closest('line[data-id]');

    if (target) {
      const nid = parseInt(target.dataset.id, 10);
      if (!state.selectedIds.has(nid)) {
        state.selectedIds.clear();
        state.selectedIds.add(nid);
        renderSelectionState();
      }
      clearContextMenu();
      addCtxItem('Bearbeiten', 'Dbl-Click', () => state.selectedIds.forEach(id => editNodeLabel(id)));
      addCtxItem('Farbe / Verlauf', '', () => showGradientPopup(e.clientX, e.clientY, [...state.selectedIds]));
      addCtxItem('Schriftart', '', () => showFontPopup(e.clientX, e.clientY, [...state.selectedIds]));
      addCtxItem('Duplizieren', 'Ctrl+D', () => duplicateSelected(fullRender));
      addCtxSep();
      addCtxItem('Loeschen', 'Del', () => deleteSelected(fullRender), true);
      showContextMenuAt(e.clientX, e.clientY);
    } else if (connEl) {
      const connId = parseInt(connEl.dataset.id, 10);
      clearContextMenu();
      addCtxItem('Farbe aendern', '', () => {
        const conn = state.connections.find(c => c.id === connId);
        showColorPopup(e.clientX, e.clientY, conn?.color || '#6c8aff', (color) => {
          saveSnapshot();
          if (conn) conn.color = color;
          renderConnections();
          autoSave();
        });
      });
      addCtxSep();
      addCtxItem('Verbindung loeschen', 'Del', () => {
        saveSnapshot();
        state.connections = state.connections.filter(c => c.id !== connId);
        renderConnections();
        autoSave();
      }, true);
      showContextMenuAt(e.clientX, e.clientY);
    }
  });
}

// ─── Render event (dispatched by popups) ───
document.addEventListener('editor:render', () => { fullRender(); autoSave(); });

// ─── Init Sequence ───
async function init() {
  // Init DOM-dependent modules
  initGrid();
  initRenderer();
  initMinimap();
  initContextMenu();
  initColorPopup();
  initGradientPopup();
  initFontPopup();
  initNodePopup();

  // Wire zoom reference for interactions (breaks circular dep)
  setZoomToRef(zoomTo);

  // Wire toolbar
  initToolbar();
  initInteractions();
  initQuickAdd();
  initConnPopup();
  initKeyboard(setTool);

  // Setup context menu
  setupContextMenu();

  // Init sidebar panel
  initSidebar();

  // Apply default theme
  applyTheme(state.theme);

  // Try loading project from URL
  const projectLoaded = await loadFromURL();

  if (!projectLoaded) {
    // Try localStorage
    const localLoaded = autoLoad();
    if (!localLoaded) {
      // Empty editor — center the canvas
      state.panX = window.innerWidth / 2 - 200;
      state.panY = window.innerHeight / 2 - 100;
    }
  }

  // Grid toggle visual state
  document.getElementById('grid-toggle')?.classList.toggle('active', state.gridEnabled);

  // Render everything
  fullRender();

  // Run force layout if enabled
  if (state.physicsLayout) {
    setTimeout(() => runForceLayout(), 300);
  }

  // Fit to content if project was loaded
  if (projectLoaded && state.nodes.length) {
    setTimeout(() => zoomFit(), 200);
  }
}

// Flush debounced save before page unload to prevent data loss
window.addEventListener('beforeunload', () => autoSaveNow());

init();
