/**
 * ─── File Rating ──────────────────────────────
 * @file        theme.js
 * @description Theme system — apply/toggle dark/light via data-theme attribute
 * @version     2.0
 * @date        2026-03-05
 * @rating      8/10
 * @depends-on  state.js
 * @used-by     main.js, toolbar.js, project.js, settings-panel.js
 * @strengths   Minimal and effective — CSS custom properties do the heavy lifting
 * @issues      Theme not persisted independently (relies on autoSave via caller)
 * ─────────────────────────────────────────────── */
// ─── Theme System ───
import { state } from './state.js';

export function applyTheme(theme) {
  state.theme = theme || 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
}

export function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}
