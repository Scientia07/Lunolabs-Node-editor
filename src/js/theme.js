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
