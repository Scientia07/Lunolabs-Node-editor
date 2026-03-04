/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Keyboard Shortcuts ───
import { state, undo, redo } from './state.js';
import { renderSelectionState } from './renderer.js';
import { closeMenus } from './context-menu.js';
import { deleteSelected, duplicateSelected } from './actions.js';
import { drawGrid } from './grid.js';
import { autoSave } from './persistence.js';
import { setSpaceHeld } from './interactions.js';

let setToolFn, fullRenderFn;

export function initKeyboard(setTool, fullRender) {
  setToolFn = setTool;
  fullRenderFn = fullRender;

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', (e) => { if (e.key === ' ') setSpaceHeld(false); });
}

function onKeyDown(e) {
  if (e.target.isContentEditable) return;

  if (e.key === ' ') { setSpaceHeld(true); e.preventDefault(); }
  if (e.key === 'v' || e.key === 'V') setToolFn('select');
  if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) setToolFn('connect');
  if (e.key === 'g' || e.key === 'G') {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-toggle').classList.toggle('active', state.gridEnabled);
    drawGrid();
    autoSave();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(fullRenderFn); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(fullRenderFn, autoSave); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { redo(fullRenderFn, autoSave); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') { duplicateSelected(fullRenderFn); e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    state.nodes.forEach(n => state.selectedIds.add(n.id));
    renderSelectionState();
    e.preventDefault();
  }
  if (e.key === 'Escape') {
    state.selectedIds.clear();
    renderSelectionState();
    closeMenus();
    setToolFn('select');
  }
}
