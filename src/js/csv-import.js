/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05T16:35:00+01:00
 */
// ─── CSV Import ───
import { state, genId, rebuildIndex, saveSnapshot, emit } from './state.js';
import { SUGGESTED_META_FIELDS } from './constants.js';
import { showToast, esc, safeMetaKey } from './utils.js';
import { autoSave } from './persistence.js';

// ─── Header Aliases (fuzzy matching) ───
const HEADER_MAP = {
  // Label
  'label': 'label', 'name': 'label', 'bezeichnung': 'label', 'titel': 'label',
  // Type
  'typ': 'type', 'type': 'type', 'art': 'type',
  // Sector
  'sektor': 'sector', 'sector': 'sector', 'bereich': 'sector',
  // Position
  'x': 'x', 'y': 'y',
};

// Map suggested meta field labels (German) to their keys
for (const f of SUGGESTED_META_FIELDS) {
  HEADER_MAP[f.label.toLowerCase()] = `meta.${f.key}`;
  HEADER_MAP[f.key.toLowerCase()] = `meta.${f.key}`;
}

/** Detect delimiter by counting ; vs , in the first line */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0];
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semis >= commas ? ';' : ',';
}

/** Parse a CSV line respecting quoted fields */
function parseLine(line, delim) {
  const cells = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === delim) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/** Parse full CSV text into { headers, rows } */
export function parseCSV(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) return { headers: [], rows: [], mappings: {} };

  const headers = parseLine(lines[0], delim);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim);
    if (cells.length === 1 && !cells[0].trim()) continue; // skip empty rows
    rows.push(cells);
  }

  // Auto-map headers
  const mappings = {};
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].trim().toLowerCase();
    if (HEADER_MAP[normalized]) {
      mappings[i] = HEADER_MAP[normalized];
    } else {
      // Unknown column → custom meta field (guarded against prototype pollution)
      const safeKey = safeMetaKey(headers[i]);
      if (safeKey) mappings[i] = `meta.${safeKey}`;
    }
  }

  return { headers, rows, mappings };
}

/** Analyze import: count new vs updated nodes */
export function analyzeImport(rows, mappings) {
  const labelCol = Object.entries(mappings).find(([, v]) => v === 'label');
  if (!labelCol) return { newCount: rows.length, updateCount: 0, errors: ['Keine Label-Spalte gefunden'] };

  const labelIdx = parseInt(labelCol[0], 10);
  const existingLabels = new Map();
  for (const n of state.nodes) {
    if (n.label) existingLabels.set(n.label.toLowerCase().trim(), n);
  }

  let newCount = 0, updateCount = 0;
  for (const row of rows) {
    const label = (row[labelIdx] || '').trim();
    if (!label) continue;
    if (existingLabels.has(label.toLowerCase())) {
      updateCount++;
    } else {
      newCount++;
    }
  }

  return { newCount, updateCount, errors: [] };
}

/** Apply CSV import to state */
export function applyImport(rows, mappings) {
  const labelIdx = parseInt(Object.entries(mappings).find(([, v]) => v === 'label')?.[0] ?? '-1', 10);
  if (labelIdx < 0) { showToast('Import fehlgeschlagen: keine Label-Spalte'); return 0; }

  // Build lookup for existing nodes by label
  const existingByLabel = new Map();
  for (const n of state.nodes) {
    if (n.label) existingByLabel.set(n.label.toLowerCase().trim(), n);
  }

  // Build sector lookup by label
  const sectorsByLabel = new Map();
  for (const n of state.nodes) {
    if (n.type === 'sector' || n.type === 'center') {
      sectorsByLabel.set(n.label.toLowerCase().trim(), n);
    }
  }

  saveSnapshot();

  let count = 0;
  for (const row of rows) {
    const label = (row[labelIdx] || '').trim();
    if (!label) continue;

    const existing = existingByLabel.get(label.toLowerCase());
    const node = existing || {
      id: genId(),
      type: 'company',
      x: 200 + Math.random() * 400,
      y: 200 + Math.random() * 400,
      label,
      color: '#6c8aff',
    };

    if (!existing) {
      if (!node.meta) node.meta = {};
    } else {
      if (!node.meta) node.meta = {};
    }

    // Apply mapped columns
    for (const [colStr, field] of Object.entries(mappings)) {
      const col = parseInt(colStr, 10);
      const value = (row[col] || '').trim();
      if (!value) continue;

      if (field === 'label') {
        node.label = value;
      } else if (field === 'type') {
        // Don't change type of existing nodes
        if (!existing) node.type = value;
      } else if (field === 'sector') {
        // Match sector by label, assign parentId + color
        const sector = sectorsByLabel.get(value.toLowerCase());
        if (sector) {
          node.parentId = sector.id;
          if (!existing) node.color = sector.color || '#6c8aff';
        }
      } else if (field === 'x') {
        const num = parseFloat(value);
        if (!isNaN(num)) node.x = num;
      } else if (field === 'y') {
        const num = parseFloat(value);
        if (!isNaN(num)) node.y = num;
      } else if (field.startsWith('meta.')) {
        const key = safeMetaKey(field.slice(5));
        if (!key) continue;
        // Parse numeric for relevancy
        if (key === 'relevancy') {
          const num = parseInt(value, 10);
          if (!isNaN(num)) node.meta[key] = num;
        } else {
          node.meta[key] = value;
        }
      }
    }

    if (!existing) {
      state.nodes.push(node);
    }
    count++;
  }

  rebuildIndex();
  emit('render');
  autoSave();
  return count;
}

// ─── Modal UI ───

let currentParsed = null;

export function openCSVImport() {
  const input = document.getElementById('csv-file-input');
  const handler = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentParsed = parseCSV(reader.result);
      if (currentParsed.rows.length === 0) {
        showToast('CSV-Datei ist leer oder ungueltig');
        return;
      }
      showPreviewModal(currentParsed);
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
    input.removeEventListener('change', handler);
  };
  input.addEventListener('change', handler);
  input.click();
}

function showPreviewModal(parsed) {
  const modal = document.getElementById('csv-import-modal');
  const { headers, rows, mappings } = parsed;
  const { newCount, updateCount } = analyzeImport(rows, mappings);

  const previewRows = rows.slice(0, 5);

  // Build preview table
  let tableHtml = '<table class="csv-preview-table"><thead><tr>';
  for (let i = 0; i < headers.length; i++) {
    const mapped = mappings[i] || '—';
    const mappedLabel = mapped.startsWith('meta.') ? mapped.slice(5) : mapped;
    tableHtml += `<th>${esc(headers[i])}<span class="csv-mapped-to">${esc(mappedLabel)}</span></th>`;
  }
  tableHtml += '</tr></thead><tbody>';
  for (const row of previewRows) {
    tableHtml += '<tr>';
    for (let i = 0; i < headers.length; i++) {
      tableHtml += `<td>${esc(row[i] || '')}</td>`;
    }
    tableHtml += '</tr>';
  }
  if (rows.length > 5) {
    tableHtml += `<tr><td colspan="${headers.length}" class="csv-more-rows">... und ${rows.length - 5} weitere Zeilen</td></tr>`;
  }
  tableHtml += '</tbody></table>';

  const content = modal.querySelector('.csv-modal-content');
  content.innerHTML = `
    <h3>CSV Import — Vorschau</h3>
    <div class="csv-summary">
      <span class="csv-badge csv-badge-new">${newCount} neu</span>
      <span class="csv-badge csv-badge-update">${updateCount} aktualisiert</span>
      <span class="csv-badge">${rows.length} Zeilen total</span>
    </div>
    <div class="csv-table-wrap">${tableHtml}</div>
    <div class="csv-modal-actions">
      <button class="popup-btn" id="csv-import-cancel">Abbrechen</button>
      <button class="popup-btn csv-btn-primary" id="csv-import-confirm">Importieren</button>
    </div>
  `;

  modal.classList.add('open');

  content.querySelector('#csv-import-cancel').addEventListener('click', () => {
    modal.classList.remove('open');
    currentParsed = null;
  });

  content.querySelector('#csv-import-confirm').addEventListener('click', () => {
    modal.classList.remove('open');
    const count = applyImport(parsed.rows, parsed.mappings);
    showToast(`${count} Eintraege importiert`);
    currentParsed = null;
  });
}
