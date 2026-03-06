/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-06
 */
import { describe, it, expect } from 'vitest';
import { fuzzyMatch, searchNodes } from '../search.js';

describe('fuzzyMatch', () => {
  it('matches exact substring', () => {
    const r = fuzzyMatch('Jugend', 'Jugendarbeit');
    expect(r).not.toBeNull();
    expect(r.score).toBeGreaterThan(0);
  });

  it('matches characters in order (fuzzy)', () => {
    const r = fuzzyMatch('jgb', 'Jugendbuero');
    expect(r).not.toBeNull();
  });

  it('is case-insensitive', () => {
    const r = fuzzyMatch('JUGEND', 'jugendarbeit');
    expect(r).not.toBeNull();
  });

  it('returns null on no match', () => {
    expect(fuzzyMatch('xyz', 'Jugendarbeit')).toBeNull();
  });

  it('returns matched indices', () => {
    const r = fuzzyMatch('jb', 'Jugendbuero');
    expect(r.indices).toContain(0);
    expect(r.indices.length).toBe(2);
  });

  it('scores consecutive matches higher', () => {
    const consecutive = fuzzyMatch('Jug', 'Jugendarbeit');
    const scattered = fuzzyMatch('Jbt', 'Jugendarbeit');
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });
});

describe('searchNodes', () => {
  const nodes = [
    { id: 1, label: 'Jugendarbeit', type: 'sector', meta: {} },
    { id: 2, label: 'Pro Juventute', type: 'company', meta: { contact: 'Maria Mueller', tags: 'Prevention' } },
    { id: 3, label: 'Sportverein', type: 'company', meta: { notes: 'Jugendgruppe vorhanden' } },
    { id: 4, label: 'Gemeinde', type: 'sector', meta: {} },
  ];

  it('matches on label', () => {
    const results = searchNodes('jugend', nodes);
    expect(results.map(r => r.node.id)).toContain(1);
  });

  it('matches on meta.contact', () => {
    const results = searchNodes('maria', nodes);
    expect(results.map(r => r.node.id)).toContain(2);
  });

  it('matches on meta.tags', () => {
    const results = searchNodes('prevention', nodes);
    expect(results.map(r => r.node.id)).toContain(2);
  });

  it('matches on meta.notes', () => {
    const results = searchNodes('jugendgruppe', nodes);
    expect(results.map(r => r.node.id)).toContain(3);
  });

  it('returns results sorted by score descending', () => {
    const results = searchNodes('jugend', nodes);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty array for empty query', () => {
    expect(searchNodes('', nodes)).toEqual([]);
  });

  it('searches custom meta fields', () => {
    const nodesWithCustom = [
      { id: 5, label: 'Test', type: 'company', meta: { customField: 'UniqueValue123' } },
    ];
    const results = searchNodes('unique', nodesWithCustom);
    expect(results.map(r => r.node.id)).toContain(5);
  });
});
