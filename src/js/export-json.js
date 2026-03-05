/**
 * ─── File Rating ──────────────────────────────
 * @file        export-json.js
 * @description JSON export/import with validation and toast feedback
 * @version     2.0
 * @date        2026-03-05
 * @rating      8/10
 * @depends-on  state.js, utils.js, persistence.js
 * @used-by     toolbar.js
 * @strengths   JSON validation on import, URL.revokeObjectURL cleanup, date-stamped filenames
 * @issues      None
 * ─────────────────────────────────────────────── */
// ─── JSON Export/Import ───
import { state, saveSnapshot, rebuildIndex } from './state.js';
import { showToast, validateProjectJSON, serializeProject } from './utils.js';
import { autoSave } from './persistence.js';

export function exportJSON() {
  const data = JSON.stringify(serializeProject(state, state.projectTitle), null, 2);
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
      const check = validateProjectJSON(d);
      if (!check.valid) {
        showToast('Ungueltige Datei: ' + check.error);
        return;
      }
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
