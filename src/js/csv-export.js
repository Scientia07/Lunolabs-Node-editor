/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05T16:28:20+01:00
 */
// ─── CSV Export ───
import { state, nodeIndex } from './state.js';
import { SUGGESTED_META_FIELDS } from './constants.js';

/** Quote a CSV cell value per RFC 4180 (semicolon-delimited variant) */
function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Resolve parentId → parent node label (sector name) */
function getSectorLabel(node) {
  if (!node.parentId) return '';
  const parent = nodeIndex.get(node.parentId);
  return parent?.label || '';
}

/** Collect the union of all custom meta keys (beyond the suggested fields) */
function getCustomMetaKeys(nodes) {
  const suggested = new Set(SUGGESTED_META_FIELDS.map(f => f.key));
  const custom = new Set();
  for (const n of nodes) {
    if (!n.meta) continue;
    for (const key of Object.keys(n.meta)) {
      if (!suggested.has(key)) custom.add(key);
    }
  }
  return [...custom].sort();
}

/** Build CSV string from current state */
export function buildCSV(excludeNodeIds) {
  const nodes = excludeNodeIds ? state.nodes.filter(n => !excludeNodeIds.has(n.id)) : state.nodes;

  // Fixed columns: suggested meta fields in defined order
  const suggestedKeys = SUGGESTED_META_FIELDS.map(f => f.key);
  const suggestedLabels = SUGGESTED_META_FIELDS.map(f => f.label);
  const customKeys = getCustomMetaKeys(nodes);

  // Header row
  const headers = [
    'Label', 'Typ', 'Sektor',
    ...suggestedLabels,
    ...customKeys,
    'X', 'Y',
  ];

  const rows = [headers.map(csvCell).join(';')];

  for (const n of nodes) {
    const meta = n.meta || {};
    const row = [
      csvCell(n.label || ''),
      csvCell(n.type || ''),
      csvCell(getSectorLabel(n)),
      ...suggestedKeys.map(k => csvCell(meta[k] ?? '')),
      ...customKeys.map(k => csvCell(meta[k] ?? '')),
      csvCell(Math.round(n.x)),
      csvCell(Math.round(n.y)),
    ];
    rows.push(row.join(';'));
  }

  // UTF-8 BOM + rows
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

/** Trigger CSV file download */
export function exportCSV(excludeNodeIds) {
  const csv = buildCSV(excludeNodeIds);
  const date = new Date().toISOString().slice(0, 10);
  const name = state.projectTitle || 'netzwerk';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const filename = `${slug}-export-${date}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
