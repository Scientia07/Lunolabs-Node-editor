/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-05
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  esc,
  safeColor,
  validateProjectJSON,
  getContrastColor,
  getGradientCSS,
  serializeProject,
  snapToGrid,
  screenToCanvas,
} from '../utils.js';
import { state } from '../state.js';

// ---------------------------------------------------------------------------
// esc() — HTML entity escaping
// ---------------------------------------------------------------------------
describe('esc()', () => {
  it('escapes < and >', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('escapes all entities in a mixed string', () => {
    expect(esc('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
    );
  });

  it('returns unchanged string when no special chars', () => {
    expect(esc('hello world 123')).toBe('hello world 123');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('coerces number to string', () => {
    expect(esc(42)).toBe('42');
  });

  it('coerces null to string', () => {
    expect(esc(null)).toBe('null');
  });

  it('coerces undefined to string', () => {
    expect(esc(undefined)).toBe('undefined');
  });

  it('coerces boolean to string', () => {
    expect(esc(true)).toBe('true');
  });

  it('coerces object to string', () => {
    expect(esc({})).toBe('[object Object]');
  });
});

// ---------------------------------------------------------------------------
// safeColor() — CSS hex color validation
// ---------------------------------------------------------------------------
describe('safeColor()', () => {
  it('accepts 3-digit hex', () => {
    expect(safeColor('#fff')).toBe('#fff');
  });

  it('accepts 6-digit hex', () => {
    expect(safeColor('#ff0000')).toBe('#ff0000');
  });

  it('accepts 8-digit hex (with alpha)', () => {
    expect(safeColor('#aabbccdd')).toBe('#aabbccdd');
  });

  it('accepts 4-digit hex (shorthand with alpha)', () => {
    expect(safeColor('#f0fa')).toBe('#f0fa');
  });

  it('accepts mixed case hex', () => {
    expect(safeColor('#AbCdEf')).toBe('#AbCdEf');
  });

  it('rejects named colors', () => {
    expect(safeColor('red')).toBe('#6c8aff');
  });

  it('rejects rgb() function', () => {
    expect(safeColor('rgb(255,0,0)')).toBe('#6c8aff');
  });

  it('rejects url() injection', () => {
    expect(safeColor('url(http://evil.com)')).toBe('#6c8aff');
  });

  it('rejects hex without hash', () => {
    expect(safeColor('ff0000')).toBe('#6c8aff');
  });

  it('rejects empty string', () => {
    expect(safeColor('')).toBe('#6c8aff');
  });

  it('returns fallback for null', () => {
    expect(safeColor(null)).toBe('#6c8aff');
  });

  it('returns fallback for undefined', () => {
    expect(safeColor(undefined)).toBe('#6c8aff');
  });

  it('returns fallback for number', () => {
    expect(safeColor(123)).toBe('#6c8aff');
  });

  it('uses custom fallback', () => {
    expect(safeColor('invalid', '#000')).toBe('#000');
  });

  it('rejects hex with invalid chars', () => {
    expect(safeColor('#gggggg')).toBe('#6c8aff');
  });

  it('rejects single hash', () => {
    expect(safeColor('#')).toBe('#6c8aff');
  });
});

// ---------------------------------------------------------------------------
// validateProjectJSON() — project structure validation
// ---------------------------------------------------------------------------
describe('validateProjectJSON()', () => {
  const validNode = { id: 1, x: 100, y: 200, type: 'rect' };
  const validConnection = { id: 1, from: 1, to: 2 };

  it('accepts a valid project with nodes and connections', () => {
    const result = validateProjectJSON({
      nodes: [validNode],
      connections: [validConnection],
      nextId: 3,
    });
    expect(result).toEqual({ valid: true });
  });

  it('accepts a project with empty nodes array', () => {
    const result = validateProjectJSON({ nodes: [] });
    expect(result.valid).toBe(true);
  });

  it('accepts a project without connections (optional)', () => {
    const result = validateProjectJSON({ nodes: [validNode] });
    expect(result.valid).toBe(true);
  });

  it('accepts a project without nextId', () => {
    const result = validateProjectJSON({ nodes: [validNode] });
    expect(result.valid).toBe(true);
  });

  it('rejects null', () => {
    const result = validateProjectJSON(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects undefined', () => {
    const result = validateProjectJSON(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects a string', () => {
    const result = validateProjectJSON('{"nodes":[]}');
    expect(result.valid).toBe(false);
  });

  it('rejects a number', () => {
    const result = validateProjectJSON(42);
    expect(result.valid).toBe(false);
  });

  it('rejects missing nodes array', () => {
    const result = validateProjectJSON({ connections: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/nodes/);
  });

  it('rejects nodes that is not an array', () => {
    const result = validateProjectJSON({ nodes: 'not-array' });
    expect(result.valid).toBe(false);
  });

  it('rejects node without id', () => {
    const result = validateProjectJSON({
      nodes: [{ x: 0, y: 0, type: 'rect' }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/id/);
  });

  it('rejects node with string id', () => {
    const result = validateProjectJSON({
      nodes: [{ id: 'abc', x: 0, y: 0, type: 'rect' }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects node without coordinates', () => {
    const result = validateProjectJSON({
      nodes: [{ id: 1, type: 'rect' }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/x\/y/);
  });

  it('rejects node without type', () => {
    const result = validateProjectJSON({
      nodes: [{ id: 1, x: 0, y: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/type/);
  });

  it('rejects node that is null', () => {
    const result = validateProjectJSON({ nodes: [null] });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/node\[0\]/);
  });

  it('rejects nextId of zero', () => {
    const result = validateProjectJSON({ nodes: [], nextId: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/nextId/);
  });

  it('rejects negative nextId', () => {
    const result = validateProjectJSON({ nodes: [], nextId: -5 });
    expect(result.valid).toBe(false);
  });

  it('rejects non-number nextId', () => {
    const result = validateProjectJSON({ nodes: [], nextId: 'abc' });
    expect(result.valid).toBe(false);
  });

  it('rejects connections that is not an array', () => {
    const result = validateProjectJSON({ nodes: [], connections: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/connections/);
  });

  it('rejects connection without id', () => {
    const result = validateProjectJSON({
      nodes: [],
      connections: [{ from: 1, to: 2 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/connection\[0\]\.id/);
  });

  it('rejects connection without from/to', () => {
    const result = validateProjectJSON({
      nodes: [],
      connections: [{ id: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/from\/to/);
  });
});

// ---------------------------------------------------------------------------
// getContrastColor() — dark/light text for background
// ---------------------------------------------------------------------------
describe('getContrastColor()', () => {
  it('returns white for dark background', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
  });

  it('returns white for deep blue', () => {
    expect(getContrastColor('#1a1a2e')).toBe('#ffffff');
  });

  it('returns dark for white background', () => {
    expect(getContrastColor('#ffffff')).toBe('#1a1a2e');
  });

  it('returns dark for light yellow', () => {
    expect(getContrastColor('#ffd166')).toBe('#1a1a2e');
  });

  it('returns white for null', () => {
    expect(getContrastColor(null)).toBe('#ffffff');
  });

  it('returns white for empty string', () => {
    expect(getContrastColor('')).toBe('#ffffff');
  });

  it('returns white for undefined', () => {
    expect(getContrastColor(undefined)).toBe('#ffffff');
  });

  it('returns white for non-hash string', () => {
    expect(getContrastColor('red')).toBe('#ffffff');
  });
});

// ---------------------------------------------------------------------------
// getGradientCSS() — solid or gradient background
// ---------------------------------------------------------------------------
describe('getGradientCSS()', () => {
  it('returns solid color when no color2', () => {
    expect(getGradientCSS({ color: '#ff0000' })).toBe('#ff0000');
  });

  it('returns solid color when color2 is undefined', () => {
    expect(getGradientCSS({ color: '#ff0000', color2: undefined })).toBe('#ff0000');
  });

  it('returns solid color when color2 equals color', () => {
    expect(getGradientCSS({ color: '#ff0000', color2: '#ff0000' })).toBe('#ff0000');
  });

  it('returns gradient when color2 differs', () => {
    const result = getGradientCSS({ color: '#ff0000', color2: '#0000ff' });
    expect(result).toBe('linear-gradient(135deg, #ff0000, #0000ff)');
  });

  it('uses custom gradient angle', () => {
    const result = getGradientCSS({ color: '#ff0000', color2: '#0000ff', gradAngle: 90 });
    expect(result).toBe('linear-gradient(90deg, #ff0000, #0000ff)');
  });

  it('uses default angle 135 when gradAngle is 0', () => {
    // 0 is falsy, so fallback to 135
    const result = getGradientCSS({ color: '#ff0000', color2: '#0000ff', gradAngle: 0 });
    expect(result).toBe('linear-gradient(135deg, #ff0000, #0000ff)');
  });

  it('returns default color when no color property', () => {
    expect(getGradientCSS({})).toBe('#6c8aff');
  });
});

// ---------------------------------------------------------------------------
// serializeProject() — project export structure
// ---------------------------------------------------------------------------
describe('serializeProject()', () => {
  it('produces correct structure with version 2', () => {
    const mockState = {
      projectTitle: 'My Project',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
      nodes: [{ id: 1, x: 0, y: 0, type: 'rect' }],
      connections: [{ id: 1, from: 1, to: 2 }],
      nextId: 3,
    };

    const result = serializeProject(mockState);
    expect(result.version).toBe(2);
    expect(result.meta).toEqual({
      title: 'My Project',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
    });
    expect(result.nodes).toBe(mockState.nodes);
    expect(result.connections).toBe(mockState.connections);
    expect(result.nextId).toBe(3);
  });

  it('uses title argument over state.projectTitle', () => {
    const mockState = {
      projectTitle: 'State Title',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
      nodes: [],
      connections: [],
      nextId: 1,
    };

    const result = serializeProject(mockState, 'Override Title');
    expect(result.meta.title).toBe('Override Title');
  });

  it('falls back to empty string when no title', () => {
    const mockState = {
      projectTitle: '',
      theme: 'dark',
      connectionStyle: 'bezier',
      gridEnabled: true,
      nodes: [],
      connections: [],
      nextId: 1,
    };

    const result = serializeProject(mockState);
    expect(result.meta.title).toBe('');
  });
});

// ---------------------------------------------------------------------------
// snapToGrid() — grid snapping
// ---------------------------------------------------------------------------
describe('snapToGrid()', () => {
  beforeEach(() => {
    state.snapEnabled = true;
    state.gridEnabled = true;
    state.gridSize = 40;
  });

  it('snaps value to nearest grid line', () => {
    expect(snapToGrid(42)).toBe(40);
  });

  it('snaps value up when closer to next grid line', () => {
    expect(snapToGrid(61)).toBe(80);
  });

  it('returns exact value when already on grid', () => {
    expect(snapToGrid(80)).toBe(80);
  });

  it('snaps midpoint value (rounds to nearest)', () => {
    expect(snapToGrid(60)).toBe(80); // 60/40=1.5, Math.round=2, 2*40=80
  });

  it('passes through when snap is disabled', () => {
    state.snapEnabled = false;
    expect(snapToGrid(42)).toBe(42);
  });

  it('passes through when grid is disabled', () => {
    state.gridEnabled = false;
    expect(snapToGrid(42)).toBe(42);
  });

  it('handles negative values', () => {
    expect(snapToGrid(-42)).toBe(-40);
  });

  it('snaps zero to zero', () => {
    expect(snapToGrid(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// screenToCanvas() — coordinate transform
// ---------------------------------------------------------------------------
describe('screenToCanvas()', () => {
  beforeEach(() => {
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
  });

  it('returns same coords at default pan/zoom', () => {
    const result = screenToCanvas(100, 200);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('accounts for pan offset', () => {
    state.panX = 50;
    state.panY = 100;
    const result = screenToCanvas(150, 300);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('accounts for zoom', () => {
    state.zoom = 2;
    const result = screenToCanvas(200, 400);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('accounts for both pan and zoom', () => {
    state.panX = 100;
    state.panY = 50;
    state.zoom = 0.5;
    const result = screenToCanvas(150, 100);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it('handles negative pan', () => {
    state.panX = -100;
    state.panY = -200;
    const result = screenToCanvas(0, 0);
    expect(result).toEqual({ x: 100, y: 200 });
  });
});
