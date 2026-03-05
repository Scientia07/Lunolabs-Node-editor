/**
 * ─── File Rating ──────────────────────────────
 * @file        constants.js
 * @description Shared constants — palette, sticky colors, fonts, defaults
 * @version     2.0
 * @date        2026-03-05
 * @rating      9/10
 * @depends-on  (none)
 * @used-by     state.js, color-popup.js, gradient-popup.js, font-popup.js, node-popup.js, interactions.js
 * @strengths   Single source of truth for all magic values, clean and minimal
 * @issues      None
 * ─────────────────────────────────────────────── */
// ─── App Info ───
export const APP_VERSION = '2.1.0';
// __BUILD_DATE__ is replaced at build time by esbuild; falls back to 'dev' in dev mode
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev';

// ─── Constants ───

export const PALETTE = [
  '#6c8aff', '#ff6b6b', '#5cdb95', '#ffd166', '#a78bfa',
  '#f472b6', '#38bdf8', '#fb923c', '#34d399', '#e879f9',
  '#818cf8', '#fbbf24',
];

export const STICKY_COLORS = ['#fef08a', '#fca5a5', '#86efac', '#93c5fd', '#c4b5fd', '#fdba74'];

export const FONTS = [
  { name: 'DM Sans', family: "'DM Sans', sans-serif" },
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Poppins', family: "'Poppins', sans-serif" },
  { name: 'Outfit', family: "'Outfit', sans-serif" },
  { name: 'Nunito', family: "'Nunito', sans-serif" },
  { name: 'Space Mono', family: "'Space Mono', monospace" },
];

export const DEFAULT_CONNECTION_COLOR = '#6c8aff';
export const DEFAULT_GRID_SIZE = 40;
export const MAX_UNDO = 80;
