/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Toolbar Wiring ───
import { state, undo, redo } from './state.js';
import { drawGrid } from './grid.js';
import { zoomTo, zoomFit } from './transform.js';
import { autoSave } from './persistence.js';
import { showToast } from './utils.js';
import { exportJSON, importJSON } from './export-json.js';
import { exportPNG } from './export-png.js';
import { toggleTheme } from './theme.js';

let fullRenderFn;

export function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  document.getElementById('canvas-container').className = tool === 'connect' ? 'connecting' : '';
}

export function initToolbar(fullRender) {
  fullRenderFn = fullRender;

  // Tool buttons
  document.querySelectorAll('.tb-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'shapes') {
        document.getElementById('shapes-dropdown').classList.toggle('open');
        return;
      }
      setTool(tool);
    });
  });

  // Shape dropdown
  document.querySelectorAll('.dropdown-item[data-shape]').forEach(item => {
    item.addEventListener('click', () => {
      state.shapeType = item.dataset.shape;
      setTool('shape');
      document.getElementById('shapes-dropdown').classList.remove('open');
      document.getElementById('shapes-btn').classList.add('active');
    });
  });

  // Grid toggle
  document.getElementById('grid-toggle').addEventListener('click', () => {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-toggle').classList.toggle('active', state.gridEnabled);
    drawGrid();
    autoSave();
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    toggleTheme();
    drawGrid();
  });

  // Undo / Redo
  document.getElementById('undo-btn').addEventListener('click', () => undo(fullRenderFn, autoSave));
  document.getElementById('redo-btn').addEventListener('click', () => redo(fullRenderFn, autoSave));

  // Export dropdown
  document.getElementById('export-wrap-btn').addEventListener('click', (e) => {
    document.getElementById('export-dropdown').classList.toggle('open');
    e.stopPropagation();
  });
  document.getElementById('export-json-btn').addEventListener('click', () => {
    document.getElementById('export-dropdown').classList.remove('open');
    exportJSON();
  });
  document.getElementById('export-png-btn').addEventListener('click', () => {
    document.getElementById('export-dropdown').classList.remove('open');
    exportPNG();
  });

  // Import
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0], fullRenderFn);
    e.target.value = '';
  });

  // Zoom
  document.getElementById('zoom-in').addEventListener('click', () => zoomTo(state.zoom * 1.2));
  document.getElementById('zoom-out').addEventListener('click', () => zoomTo(state.zoom / 1.2));
  document.getElementById('zoom-fit').addEventListener('click', zoomFit);

  // Resize
  window.addEventListener('resize', () => { drawGrid(); });
}
