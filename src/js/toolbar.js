// ─── Toolbar Wiring ───
import { state, undo, redo, emit } from './state.js';
import { drawGrid } from './grid.js';
import { zoomTo, zoomFit } from './transform.js';
import { autoSave } from './persistence.js';
import { showToast } from './utils.js';
import { exportJSON, importJSON } from './export-json.js';
import { exportPNG } from './export-png.js';
import { exportSVG } from './export-svg.js';
import { exportCSV } from './csv-export.js';
import { openCSVImport } from './csv-import.js';
import { toggleTheme } from './theme.js';
import { hideNodePopup } from './node-popup.js';
import { relayout } from './force-layout.js';
import { getHiddenNodeIds } from './sidebar.js';

/** Safe getElementById + addEventListener — skips if element missing */
function bindButton(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
  else console.warn(`Toolbar: #${id} not found`);
}

function confirmVisibilityExport(exportAll, exportFiltered) {
  const hidden = getHiddenNodeIds();
  if (hidden.size === 0) { exportAll(); return; }

  const modal = document.getElementById('visibility-modal');
  modal.style.display = '';

  const cleanup = () => {
    modal.style.display = 'none';
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => { if (e.key === 'Escape') cleanup(); };
  document.addEventListener('keydown', onKey);
  modal.onclick = (e) => { if (e.target === modal) cleanup(); };

  document.getElementById('vis-export-all').onclick = () => { cleanup(); exportAll(); };
  document.getElementById('vis-export-visible').onclick = () => { cleanup(); exportFiltered(hidden); };
  document.getElementById('vis-export-cancel').onclick = cleanup;
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
  bindButton('grid-toggle', 'click', () => {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-toggle')?.classList.toggle('active', state.gridEnabled);
    drawGrid();
    autoSave();
  });

  // Theme toggle
  bindButton('theme-toggle', 'click', () => { toggleTheme(); drawGrid(); });

  // Undo / Redo
  bindButton('undo-btn', 'click', () => { hideNodePopup(); undo(); });
  bindButton('redo-btn', 'click', () => { hideNodePopup(); redo(); });
  bindButton('relayout-btn', 'click', () => {
    if (state.physicsLayout) relayout();
  });

  // Export dropdown
  bindButton('export-wrap-btn', 'click', (e) => {
    document.getElementById('export-dropdown')?.classList.toggle('open');
    e.stopPropagation();
  });
  bindButton('export-json-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    confirmVisibilityExport(() => exportJSON(), (hidden) => exportJSON(hidden));
  });
  bindButton('export-png-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    confirmVisibilityExport(() => exportPNG(), (hidden) => exportPNG(hidden));
  });
  bindButton('export-svg-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    confirmVisibilityExport(() => exportSVG(), (hidden) => exportSVG(hidden));
  });
  bindButton('export-csv-btn', 'click', () => {
    document.getElementById('export-dropdown')?.classList.remove('open');
    confirmVisibilityExport(() => exportCSV(), (hidden) => exportCSV(hidden));
  });

  // Import dropdown
  bindButton('import-wrap-btn', 'click', (e) => {
    document.getElementById('import-dropdown')?.classList.toggle('open');
    e.stopPropagation();
  });
  bindButton('import-json-btn', 'click', () => {
    document.getElementById('import-dropdown')?.classList.remove('open');
    document.getElementById('file-input')?.click();
  });
  bindButton('import-csv-btn', 'click', () => {
    document.getElementById('import-dropdown')?.classList.remove('open');
    openCSVImport();
  });
  bindButton('file-input', 'change', (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0], () => emit('render'));
    e.target.value = '';
  });

  // Zoom
  bindButton('zoom-in', 'click', () => zoomTo(state.zoom * 1.2));
  bindButton('zoom-out', 'click', () => zoomTo(state.zoom / 1.2));
  bindButton('zoom-fit', 'click', zoomFit);

  // Shortcuts help
  bindButton('shortcuts-btn', 'click', toggleShortcutsHelp);
  bindButton('shortcuts-close', 'click', toggleShortcutsHelp);
  document.getElementById('shortcuts-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'shortcuts-modal') toggleShortcutsHelp();
  });

  // Resize
  window.addEventListener('resize', () => { drawGrid(); });
}

export function toggleShortcutsHelp() {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  const visible = modal.style.display !== 'none';
  modal.style.display = visible ? 'none' : '';
}
