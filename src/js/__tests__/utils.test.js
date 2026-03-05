import { describe, it, expect } from 'vitest';
import { esc, safeColor, validateProjectJSON, getContrastColor, getGradientCSS, serializeProject } from '../utils.js';

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
  });
});
