/**
 * ─── File Rating ──────────────────────────────
 * @file        color-popup.js
 * @description Simple swatch color picker popup with custom color input
 * @version     2.0
 * @date        2026-03-05
 * @rating      7.5/10
 * @depends-on  constants.js
 * @used-by     main.js, interactions.js
 * @strengths   Clean callback pattern, viewport clamping for positioning
 * @issues      Rebuilds swatch DOM on every show; onchange assignment overwrites previous handler
 * ─────────────────────────────────────────────── */
// ─── Color Popup (simple swatch picker) ───
import { PALETTE } from './constants.js';

let colorPopup;

export function initColorPopup() {
  colorPopup = document.getElementById('color-popup');
}

export function showColorPopup(x, y, currentColor, cb) {
  const swatches = document.getElementById('color-swatches');
  swatches.innerHTML = '';
  PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch' + (c === currentColor ? ' active' : '');
    s.style.background = c;
    s.addEventListener('click', () => { cb(c); colorPopup.classList.remove('open'); });
    swatches.appendChild(s);
  });
  document.getElementById('custom-color').value = currentColor || '#6c8aff';
  document.getElementById('custom-color').onchange = (e) => { cb(e.target.value); colorPopup.classList.remove('open'); };
  colorPopup.style.left = Math.min(x, window.innerWidth - 220) + 'px';
  colorPopup.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  colorPopup.classList.add('open');
}
