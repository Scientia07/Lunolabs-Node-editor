/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-06
 * @file        search.js
 * @description Search & filter — fuzzy matching, results rendering, sidebar tab
 * @version     1.0
 * @date        2026-03-06
 * @depends-on  state.js, renderer.js, utils.js
 * @used-by     main.js, keyboard.js, sidebar.js
 */

/**
 * Lightweight fuzzy match — characters matched in order.
 * Returns { score, indices } or null if no match.
 */
export function fuzzyMatch(query, text) {
  if (!query || !text) return null;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices = [];
  let qi = 0;
  let score = 0;
  let lastIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      score += (lastIdx === ti - 1) ? 2 : 1;
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 1;
      lastIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
  return { score, indices };
}

/**
 * Search nodes by label + all meta fields.
 * Returns [{ node, score, field, indices }] sorted by score desc.
 */
export function searchNodes(query, nodes) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const results = [];

  for (const node of nodes) {
    let bestMatch = null;

    const labelMatch = fuzzyMatch(q, node.label || '');
    if (labelMatch) {
      bestMatch = { node, score: labelMatch.score + 5, field: 'label', indices: labelMatch.indices };
    }

    if (node.meta) {
      for (const [key, val] of Object.entries(node.meta)) {
        if (typeof val !== 'string') continue;
        const m = fuzzyMatch(q, val);
        if (m) {
          const candidate = { node, score: m.score, field: key, indices: m.indices };
          if (!bestMatch || candidate.score > bestMatch.score) {
            bestMatch = candidate;
          }
        }
      }
    }

    if (bestMatch) results.push(bestMatch);
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
