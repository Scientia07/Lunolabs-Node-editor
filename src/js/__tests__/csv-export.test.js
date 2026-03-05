/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05T16:28:20+01:00
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex } from '../state.js';
import { buildCSV } from '../csv-export.js';

function resetState() {
  state.nodes = [];
  state.connections = [];
  state.nextId = 1;
  state.projectTitle = '';
  nodeIndex.clear();
}

function addNode(overrides) {
  const n = { id: state.nextId++, x: 100, y: 200, type: 'company', label: 'Test', ...overrides };
  state.nodes.push(n);
  nodeIndex.set(n.id, n);
  return n;
}

describe('csv-export', () => {
  beforeEach(resetState);

  it('starts with UTF-8 BOM', () => {
    addNode({});
    const csv = buildCSV();
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('uses semicolon as delimiter', () => {
    addNode({ label: 'Foo' });
    const csv = buildCSV();
    const headerLine = csv.split('\r\n')[0].replace('\uFEFF', '');
    expect(headerLine).toContain(';');
    expect(headerLine.split(';')[0]).toBe('Label');
  });

  it('ends lines with CRLF', () => {
    addNode({});
    const csv = buildCSV();
    expect(csv).toContain('\r\n');
  });

  it('includes all suggested meta field labels in header', () => {
    addNode({});
    const csv = buildCSV();
    const header = csv.split('\r\n')[0];
    expect(header).toContain('Relevanz');
    expect(header).toContain('Kontaktperson');
    expect(header).toContain('E-Mail');
    expect(header).toContain('Telefon');
    expect(header).toContain('Tags');
    expect(header).toContain('Notizen');
    expect(header).toContain('Website');
    expect(header).toContain('Seit');
  });

  it('includes X and Y as last columns', () => {
    addNode({});
    const csv = buildCSV();
    const header = csv.split('\r\n')[0].replace('\uFEFF', '');
    const cols = header.split(';');
    expect(cols[cols.length - 2]).toBe('X');
    expect(cols[cols.length - 1]).toBe('Y');
  });

  it('exports node data correctly', () => {
    addNode({ label: 'Schulpsych. Dienst', type: 'company', x: 640, y: 552 });
    const csv = buildCSV();
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('Schulpsych. Dienst');
    expect(dataLine).toContain('company');
    expect(dataLine).toContain('640');
    expect(dataLine).toContain('552');
  });

  it('resolves sector label from parentId', () => {
    const sector = addNode({ label: 'Beratung', type: 'sector', x: 0, y: 0 });
    addNode({ label: 'Dienst', type: 'company', parentId: sector.id, x: 100, y: 200 });
    const csv = buildCSV();
    const lines = csv.split('\r\n');
    // Line 2 is the company node (line 1 is the sector)
    const companyLine = lines.find(l => l.includes('Dienst') && !l.includes('Label'));
    expect(companyLine).toContain('Beratung');
  });

  it('exports metadata fields', () => {
    addNode({
      label: 'Test Corp',
      type: 'company',
      meta: { contact: 'Max Muster', email: 'max@example.ch', relevancy: 8 },
    });
    const csv = buildCSV();
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('Max Muster');
    expect(dataLine).toContain('max@example.ch');
    expect(dataLine).toContain('8');
  });

  it('includes custom meta keys as dynamic columns', () => {
    addNode({
      label: 'Custom Node',
      type: 'company',
      meta: { myCustomField: 'hello' },
    });
    const csv = buildCSV();
    const header = csv.split('\r\n')[0];
    expect(header).toContain('myCustomField');
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('hello');
  });

  it('quotes values containing semicolons', () => {
    addNode({ label: 'A;B', type: 'company' });
    const csv = buildCSV();
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('"A;B"');
  });

  it('escapes double quotes in values', () => {
    addNode({ label: 'Say "hi"', type: 'company' });
    const csv = buildCSV();
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('"Say ""hi"""');
  });

  it('handles empty state (no nodes)', () => {
    const csv = buildCSV();
    const lines = csv.split('\r\n').filter(l => l.length > 0);
    // Only header, no data rows
    expect(lines.length).toBe(1);
  });

  it('handles nodes without meta gracefully', () => {
    addNode({ label: 'No Meta', type: 'company' });
    const csv = buildCSV();
    // Should not throw
    expect(csv).toContain('No Meta');
  });
});
