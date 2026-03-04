/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Font Popup ───
import { state, nodeIndex, saveSnapshot } from './state.js';
import { FONTS } from './constants.js';

let fontPopup, fontTarget;

export function initFontPopup() {
  fontPopup = document.getElementById('font-popup');

  document.getElementById('font-size').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
  });

  document.getElementById('font-apply').addEventListener('click', () => {
    if (!fontTarget) return;
    saveSnapshot();
    const activeFont = document.querySelector('#font-list .font-option.active');
    const fontFamily = activeFont ? FONTS.find(f => f.name === activeFont.textContent)?.family : null;
    const fontSize = parseInt(document.getElementById('font-size').value, 10);
    const fontWeight = document.getElementById('font-weight').value;
    fontTarget.forEach(id => {
      const n = nodeIndex.get(id);
      if (n) { n.font = fontFamily; n.fontSize = fontSize; n.fontWeight = fontWeight; }
    });
    fontPopup.classList.remove('open');
    document.dispatchEvent(new CustomEvent('editor:render'));
  });
}

export function showFontPopup(x, y, nodeIds) {
  fontTarget = nodeIds;
  const first = nodeIndex.get(nodeIds[0]);

  const list = document.getElementById('font-list');
  list.innerHTML = '';
  FONTS.forEach(f => {
    const el = document.createElement('div');
    el.className = 'font-option' + ((first?.font || "'DM Sans', sans-serif") === f.family ? ' active' : '');
    el.style.fontFamily = f.family;
    el.textContent = f.name;
    el.addEventListener('click', () => {
      list.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
    });
    list.appendChild(el);
  });

  document.getElementById('font-size').value = first?.fontSize || 13;
  document.getElementById('font-size-val').textContent = first?.fontSize || 13;
  document.getElementById('font-weight').value = first?.fontWeight || '400';

  fontPopup.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  fontPopup.style.top = Math.min(y, window.innerHeight - 350) + 'px';
  fontPopup.classList.add('open');
}
