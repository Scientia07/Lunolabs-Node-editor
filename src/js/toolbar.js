/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Toolbar Wiring ───
import { state, undo, redo, emit } from './state.js';
import { drawGrid } from './grid.js';
import { zoomTo, zoomFit } from './transform.js';
import { autoSave } from './persistence.js';
import { showToast } from './utils.js';
import { exportJSON, importJSON } from './export-json.js';
import { exportPNG } from './export-png.js';
import { toggleTheme } from './theme.js';
import { hideNodePopup } from './node-popup.js';

/** Safe getElementById + addEventListener — skips if element missing */
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
  else console.warn(`Toolbar: #${id} not found`);
}

export function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  document.getElementById('canvas-container').className = tool === 'connect' ? 'connecting' : '';
}

export function initToolbar() {

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
  on('grid-toggle', 'click', () => {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-toggle')?.classList.toggle('active', state.gridEnabled);
    drawGrid();
    autoSave();
  });

  // Theme toggle
  on('theme-toggle', 'click', () => { toggleTheme(); drawGrid(); });

  // Undo / Redo
  on('undo-btn', 'click', () => { hideNodePopup(); undo(); });
  on('redo-btn', 'click', () => { hideNodePopup(); redo(); });

  // Export dropdown
  on('export-wrap-btn', 'click', (e) => {
    document.getElementById('export-dropdown')?.classList.toggle('open');
    e.stopPropagation();
  });
  on('export-json-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    exportJSON();
  });
  on('export-png-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    exportPNG();
  });

  // Import
  on('import-btn', 'click', () => document.getElementById('file-input')?.click());
  on('file-input', 'change', (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0], () => emit('render'));
    e.target.value = '';
  });

  // Zoom
  on('zoom-in', 'click', () => zoomTo(state.zoom * 1.2));
  on('zoom-out', 'click', () => zoomTo(state.zoom / 1.2));
  on('zoom-fit', 'click', zoomFit);

  // Resize
  window.addEventListener('resize', () => { drawGrid(); });
}
