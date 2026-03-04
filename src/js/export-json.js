/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── JSON Export/Import ───
import { state, saveSnapshot, rebuildIndex } from './state.js';
import { showToast } from './utils.js';
import { autoSave } from './persistence.js';

export function exportJSON() {
  const data = JSON.stringify({
    nodes: state.nodes,
    connections: state.connections,
    nextId: state.nextId,
    exportedAt: new Date().toISOString(),
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'netzwerk-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON exportiert!');
}

export function importJSON(file, fullRender) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      saveSnapshot();
      state.nodes = d.nodes || [];
      state.connections = d.connections || [];
      state.nextId = d.nextId || 1;
      state.selectedIds.clear();
      rebuildIndex();
      fullRender();
      autoSave();
      showToast('Importiert!');
    } catch (_e) {
      showToast('Fehler beim Import');
    }
  };
  reader.readAsText(file);
}
