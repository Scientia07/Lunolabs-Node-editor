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
  { name: 'Space Mono', family: "'Space Mono', monospace" },
];

export const DEFAULT_CONNECTION_COLOR = '#6c8aff';
export const DEFAULT_GRID_SIZE = 40;
export const MAX_UNDO = 80;

export const SUGGESTED_META_FIELDS = [
  { key: 'relevancy', label: 'Relevanz',        type: 'range',  min: 1, max: 10, default: 10 },
  { key: 'contact',   label: 'Kontaktperson',   type: 'text',   placeholder: 'Name' },
  { key: 'email',     label: 'E-Mail',          type: 'email',  placeholder: 'name@example.ch' },
  { key: 'phone',     label: 'Telefon',         type: 'tel',    placeholder: '+41 79 ...' },
  { key: 'tags',      label: 'Tags',            type: 'text',   placeholder: 'Praevention, Beratung' },
  { key: 'notes',     label: 'Notizen',         type: 'textarea', placeholder: 'Freitext...' },
  { key: 'website',   label: 'Website',         type: 'url',    placeholder: 'https://...' },
  { key: 'since',     label: 'Seit',            type: 'date',   placeholder: 'YYYY-MM-DD' },
];
