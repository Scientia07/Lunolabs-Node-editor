/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Main Entry Point ───
import { state, rebuildIndex } from './state.js';
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
import { initKeyboard } from './keyboard.js';
import { autoSave, autoLoad } from './persistence.js';
import { deleteSelected, duplicateSelected } from './actions.js';
import { applyTheme } from './theme.js';
import { loadFromURL } from './project.js';
import { nodeIndex, saveSnapshot } from './state.js';

// ─── Full Render ───
function fullRender() {
  renderNodes();
  requestAnimationFrame(() => { renderConnections(); updateMinimap(); });
  updateTransform();
}

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

  // Wire zoom reference for interactions (breaks circular dep)
  setZoomToRef(zoomTo);

  // Wire toolbar
  initToolbar(fullRender);
  initInteractions(fullRender);
  initKeyboard(setTool, fullRender);

  // Setup context menu
  setupContextMenu();

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
  document.getElementById('grid-toggle').classList.toggle('active', state.gridEnabled);

  // Render everything
  fullRender();

  // Fit to content if project was loaded
  if (projectLoaded && state.nodes.length) {
    setTimeout(() => zoomFit(), 200);
  }
}

init();
