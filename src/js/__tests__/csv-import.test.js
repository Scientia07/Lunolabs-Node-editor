/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05T16:35:00+01:00
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, nodeIndex, rebuildIndex } from '../state.js';
import { parseCSV, analyzeImport, applyImport } from '../csv-import.js';

function resetState() {
  state.nodes = [];
  state.connections = [];
  state.nextId = 1;
  state.projectTitle = '';
  state.undoStack = [];
  state.redoStack = [];
  state.groups = [];
  state.hiddenSectors = new Set();
  state.selectedIds = new Set();
  nodeIndex.clear();
}

function addNode(overrides) {
  const n = { id: state.nextId++, x: 100, y: 200, type: 'company', label: 'Test', ...overrides };
  state.nodes.push(n);
  nodeIndex.set(n.id, n);
  return n;
}

describe('csv-import', () => {
  beforeEach(resetState);

  describe('parseCSV', () => {
    it('parses semicolon-delimited CSV', () => {
      const csv = 'Label;Typ;Sektor\nFoo;company;Bar';
      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(['Label', 'Typ', 'Sektor']);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Foo', 'company', 'Bar']);
    });

    it('parses comma-delimited CSV', () => {
      const csv = 'Label,Typ,Sektor\nFoo,company,Bar';
      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(['Label', 'Typ', 'Sektor']);
      expect(rows[0]).toEqual(['Foo', 'company', 'Bar']);
    });

    it('strips BOM', () => {
      const csv = '\uFEFFLabel;Typ\nFoo;company';
      const { headers } = parseCSV(csv);
      expect(headers[0]).toBe('Label');
    });

    it('handles quoted fields with semicolons', () => {
      const csv = 'Label;Tags\n"A;B";"C;D"';
      const { rows } = parseCSV(csv);
      expect(rows[0][0]).toBe('A;B');
      expect(rows[0][1]).toBe('C;D');
    });

    it('handles escaped double quotes', () => {
      const csv = 'Label\n"Say ""hi"""';
      const { rows } = parseCSV(csv);
      expect(rows[0][0]).toBe('Say "hi"');
    });

    it('skips empty lines', () => {
      const csv = 'Label;Typ\nFoo;company\n\nBar;sector\n';
      const { rows } = parseCSV(csv);
      expect(rows).toHaveLength(2);
    });

    it('auto-maps known headers', () => {
      const csv = 'Label;Typ;Sektor;Relevanz;Kontaktperson;E-Mail\nA;company;B;8;Max;m@x.ch';
      const { mappings } = parseCSV(csv);
      expect(mappings[0]).toBe('label');
      expect(mappings[1]).toBe('type');
      expect(mappings[2]).toBe('sector');
      expect(mappings[3]).toBe('meta.relevancy');
      expect(mappings[4]).toBe('meta.contact');
      expect(mappings[5]).toBe('meta.email');
    });

    it('maps fuzzy aliases (Name → label)', () => {
      const csv = 'Name;Art\nFoo;company';
      const { mappings } = parseCSV(csv);
      expect(mappings[0]).toBe('label');
      expect(mappings[1]).toBe('type');
    });

    it('maps unknown columns to custom meta', () => {
      const csv = 'Label;MyCustom\nFoo;bar';
      const { mappings } = parseCSV(csv);
      expect(mappings[1]).toBe('meta.MyCustom');
    });
  });

  describe('analyzeImport', () => {
    it('counts new nodes', () => {
      const { rows, mappings } = parseCSV('Label;Typ\nFoo;company\nBar;company');
      const result = analyzeImport(rows, mappings);
      expect(result.newCount).toBe(2);
      expect(result.updateCount).toBe(0);
    });

    it('counts updates for existing labels', () => {
      addNode({ label: 'Foo' });
      const { rows, mappings } = parseCSV('Label;Typ\nFoo;company\nBar;company');
      const result = analyzeImport(rows, mappings);
      expect(result.newCount).toBe(1);
      expect(result.updateCount).toBe(1);
    });

    it('matches labels case-insensitively', () => {
      addNode({ label: 'FOO' });
      const { rows, mappings } = parseCSV('Label\nfoo');
      const result = analyzeImport(rows, mappings);
      expect(result.updateCount).toBe(1);
    });
  });

  describe('applyImport', () => {
    it('creates new nodes', () => {
      const { rows, mappings } = parseCSV('Label;Typ;X;Y\nNewNode;company;300;400');
      const count = applyImport(rows, mappings);
      expect(count).toBe(1);
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].label).toBe('NewNode');
      expect(state.nodes[0].x).toBe(300);
      expect(state.nodes[0].y).toBe(400);
    });

    it('updates existing node metadata', () => {
      addNode({ label: 'Existing', meta: {} });
      const { rows, mappings } = parseCSV('Label;Kontaktperson;E-Mail\nExisting;Max;m@x.ch');
      applyImport(rows, mappings);
      expect(state.nodes).toHaveLength(1); // no new node created
      expect(state.nodes[0].meta.contact).toBe('Max');
      expect(state.nodes[0].meta.email).toBe('m@x.ch');
    });

    it('does not change type of existing nodes', () => {
      addNode({ label: 'MySector', type: 'sector' });
      const { rows, mappings } = parseCSV('Label;Typ\nMySector;company');
      applyImport(rows, mappings);
      expect(state.nodes[0].type).toBe('sector'); // unchanged
    });

    it('assigns parentId when sector matches', () => {
      addNode({ label: 'Beratung', type: 'sector', color: '#ff0000' });
      const { rows, mappings } = parseCSV('Label;Sektor\nNewNode;Beratung');
      applyImport(rows, mappings);
      const newNode = state.nodes.find(n => n.label === 'NewNode');
      expect(newNode.parentId).toBe(1);
      expect(newNode.color).toBe('#ff0000');
    });

    it('parses relevancy as number', () => {
      const { rows, mappings } = parseCSV('Label;Relevanz\nFoo;7');
      applyImport(rows, mappings);
      expect(state.nodes[0].meta.relevancy).toBe(7);
    });

    it('creates undo snapshot before import', () => {
      const { rows, mappings } = parseCSV('Label\nFoo');
      applyImport(rows, mappings);
      expect(state.undoStack.length).toBe(1);
    });

    it('skips rows without labels', () => {
      const { rows, mappings } = parseCSV('Label;Typ\n;company\nFoo;company');
      const count = applyImport(rows, mappings);
      expect(count).toBe(1);
      expect(state.nodes).toHaveLength(1);
    });

    it('handles custom meta fields', () => {
      const { rows, mappings } = parseCSV('Label;Spezialfeld\nFoo;bar');
      applyImport(rows, mappings);
      expect(state.nodes[0].meta.Spezialfeld).toBe('bar');
    });
  });
});
