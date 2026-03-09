import { describe, it, expect, vi, beforeEach } from 'vitest';
import { esc, safeColor, safeMetaKey, validateProjectJSON, getContrastColor, getGradientCSS, serializeProject, getTier, hexToRgb, confirmIfDirty } from '../utils.js';
import { state } from '../state.js';

describe('utils.js', () => {
  describe('esc', () => {
    it('escapes HTML entities', () => {
      expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
      expect(esc('a & b')).toBe('a &amp; b');
    });

    it('escapes single quotes', () => {
      expect(esc("it's")).toBe("it&#39;s");
    });

    it('handles non-string input', () => {
      expect(esc(42)).toBe('42');
    });
  });

  describe('safeColor', () => {
    it('accepts valid hex colors', () => {
      expect(safeColor('#ff0000')).toBe('#ff0000');
      expect(safeColor('#abc')).toBe('#abc');
      expect(safeColor('#aabbccdd')).toBe('#aabbccdd');
    });

    it('rejects invalid colors', () => {
      expect(safeColor('red')).toBe('#6c8aff');
      expect(safeColor('url(javascript:alert(1))')).toBe('#6c8aff');
      expect(safeColor('')).toBe('#6c8aff');
      expect(safeColor(null)).toBe('#6c8aff');
    });

    it('uses custom fallback', () => {
      expect(safeColor('invalid', '#000')).toBe('#000');
    });
  });

  describe('validateProjectJSON', () => {
    it('accepts valid project', () => {
      const result = validateProjectJSON({
        nodes: [{ id: 1, x: 0, y: 0, type: 'rect' }],
        connections: [{ id: 2, from: 1, to: 1 }],
        nextId: 3,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-object', () => {
      expect(validateProjectJSON(null).valid).toBe(false);
      expect(validateProjectJSON('string').valid).toBe(false);
    });

    it('rejects missing nodes array', () => {
      expect(validateProjectJSON({ connections: [] }).valid).toBe(false);
    });

    it('rejects node without id', () => {
      const result = validateProjectJSON({ nodes: [{ x: 0, y: 0, type: 'rect' }] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('rejects node without coordinates', () => {
      const result = validateProjectJSON({ nodes: [{ id: 1, type: 'rect' }] });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid nextId', () => {
      const result = validateProjectJSON({ nodes: [], nextId: -1 });
      expect(result.valid).toBe(false);
    });

    it('allows missing connections', () => {
      const result = validateProjectJSON({ nodes: [] });
      expect(result.valid).toBe(true);
    });
  });

  describe('getContrastColor', () => {
    it('returns white for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1a1a2e')).toBe('#ffffff');
    });

    it('returns dark for light backgrounds', () => {
      expect(getContrastColor('#ffffff')).toBe('#1a1a2e');
      expect(getContrastColor('#fef08a')).toBe('#1a1a2e');
    });

    it('handles invalid input', () => {
      expect(getContrastColor(null)).toBe('#ffffff');
      expect(getContrastColor('')).toBe('#ffffff');
    });
  });

  describe('getGradientCSS', () => {
    it('returns solid color when no gradient', () => {
      expect(getGradientCSS({ color: '#ff0000' })).toBe('#ff0000');
    });

    it('returns gradient when color2 differs', () => {
      const result = getGradientCSS({ color: '#ff0000', color2: '#0000ff', gradAngle: 90 });
      expect(result).toContain('linear-gradient');
      expect(result).toContain('90deg');
    });

    it('returns solid when color2 equals color', () => {
      expect(getGradientCSS({ color: '#ff0000', color2: '#ff0000' })).toBe('#ff0000');
    });
  });

  describe('serializeProject', () => {
    it('produces correct structure', () => {
      const mockState = {
        nodes: [{ id: 1 }],
        connections: [],
        nextId: 2,
        projectTitle: 'Test',
        theme: 'dark',
        connectionStyle: 'bezier',
        gridEnabled: true,
      };
      const result = serializeProject(mockState, 'My Project');
      expect(result.version).toBe(2);
      expect(result.meta.title).toBe('My Project');
      expect(result.meta.theme).toBe('dark');
      expect(result.nodes).toEqual([{ id: 1 }]);
      expect(result.nextId).toBe(2);
    });

    it('preserves node.meta in serialized output', () => {
      const mockState = {
        nodes: [{ id: 1, x: 0, y: 0, type: 'company', label: 'Test', meta: { relevancy: 7, contact: 'Max' } }],
        connections: [],
        nextId: 2,
        projectTitle: 'Test',
        theme: 'dark',
        connectionStyle: 'bezier',
        gridEnabled: true,
      };
      const result = serializeProject(mockState, 'Test');
      expect(result.nodes[0].meta).toEqual({ relevancy: 7, contact: 'Max' });
    });

    it('handles nodes without meta', () => {
      const mockState = {
        nodes: [{ id: 1, x: 0, y: 0, type: 'rect' }],
        connections: [],
        nextId: 2,
        projectTitle: '',
        theme: 'dark',
        connectionStyle: 'bezier',
        gridEnabled: true,
      };
      const result = serializeProject(mockState, '');
      expect(result.nodes[0].meta).toBeUndefined();
    });
  });

  describe('getTier', () => {
    it('returns "nah" for relevancy > 5', () => {
      expect(getTier({ meta: { relevancy: 8 } })).toBe('nah');
      expect(getTier({ meta: { relevancy: 6 } })).toBe('nah');
    });

    it('returns "satellit" for relevancy <= 5', () => {
      expect(getTier({ meta: { relevancy: 5 } })).toBe('satellit');
      expect(getTier({ meta: { relevancy: 1 } })).toBe('satellit');
    });

    it('returns "nah" for missing meta or relevancy', () => {
      expect(getTier({})).toBe('nah');
      expect(getTier({ meta: {} })).toBe('nah');
      expect(getTier({ meta: { relevancy: undefined } })).toBe('nah');
    });
  });

  describe('confirmIfDirty', () => {
    beforeEach(() => {
      state.isDirty = false;
    });

    it('calls callback immediately when not dirty', () => {
      const fn = vi.fn();
      confirmIfDirty(fn);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('calls callback when dirty and user confirms', () => {
      state.isDirty = true;
      globalThis.confirm = vi.fn(() => true);
      const fn = vi.fn();
      confirmIfDirty(fn);
      expect(globalThis.confirm).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('does NOT call callback when dirty and user cancels', () => {
      state.isDirty = true;
      globalThis.confirm = vi.fn(() => false);
      const fn = vi.fn();
      confirmIfDirty(fn);
      expect(globalThis.confirm).toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('hexToRgb', () => {
    it('parses 6-digit hex', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#6c8aff')).toEqual({ r: 108, g: 138, b: 255 });
    });

    it('parses 3-digit hex', () => {
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('returns null for invalid input', () => {
      expect(hexToRgb('red')).toBeNull();
      expect(hexToRgb('')).toBeNull();
      expect(hexToRgb(null)).toBeNull();
    });
  });

  describe('safeMetaKey', () => {
    it('returns trimmed key for valid strings', () => {
      expect(safeMetaKey('email')).toBe('email');
      expect(safeMetaKey('  phone  ')).toBe('phone');
    });

    it('rejects __proto__', () => {
      expect(safeMetaKey('__proto__')).toBeNull();
    });

    it('rejects constructor', () => {
      expect(safeMetaKey('constructor')).toBeNull();
    });

    it('rejects prototype', () => {
      expect(safeMetaKey('prototype')).toBeNull();
    });

    it('rejects empty strings', () => {
      expect(safeMetaKey('')).toBeNull();
      expect(safeMetaKey('   ')).toBeNull();
    });

    it('rejects non-strings', () => {
      expect(safeMetaKey(null)).toBeNull();
      expect(safeMetaKey(42)).toBeNull();
      expect(safeMetaKey(undefined)).toBeNull();
    });

    it('rejects keys longer than 200 chars', () => {
      expect(safeMetaKey('a'.repeat(201))).toBeNull();
      expect(safeMetaKey('a'.repeat(200))).toBe('a'.repeat(200));
    });
  });
});
