// ─── Keyboard Shortcuts ───
import { state, undo, redo, emit } from './state.js';
import { renderSelectionState } from './renderer.js';
import { closeMenus } from './context-menu.js';
import { deleteSelected, duplicateSelected } from './actions.js';
import { drawGrid } from './grid.js';
import { autoSave } from './persistence.js';
import { setSpaceHeld } from './interactions.js';
import { toggleSidebar } from './sidebar.js';
import { hideNodePopup } from './node-popup.js';
import { focusSearch, clearSearch } from './search.js';
import { toggleShortcutsHelp } from './toolbar.js';

let setToolFn;

export function initKeyboard(setTool) {
  setToolFn = setTool;

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', (e) => { if (e.key === ' ') setSpaceHeld(false); });
}

function onKeyDown(e) {
  // Ctrl+K: focus search (works even when in input)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    focusSearch();
    return;
  }

  if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === ' ') { setSpaceHeld(true); e.preventDefault(); }
  if (e.key === 'v' || e.key === 'V') setToolFn('select');
  if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) setToolFn('connect');
  if (e.key === 'g' || e.key === 'G') {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-toggle').classList.toggle('active', state.gridEnabled);
    drawGrid();
    autoSave();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { hideNodePopup(); deleteSelected(() => emit('render')); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { hideNodePopup(); undo(); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { hideNodePopup(); redo(); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') { duplicateSelected(() => emit('render')); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    state.nodes.forEach(n => state.selectedIds.add(n.id));
    renderSelectionState();
    e.preventDefault();
  }
  if (e.key === 'p' || e.key === 'P') { toggleSidebar(); }
  if (e.key === '?') { toggleShortcutsHelp(); }
  if (e.key === 'Escape') {
    clearSearch();
    state.selectedIds.clear();
    renderSelectionState();
    closeMenus();
    hideNodePopup();
    setToolFn('select');
    const scModal = document.getElementById('shortcuts-modal');
    if (scModal && scModal.style.display !== 'none') scModal.style.display = 'none';
  }
}
