// ─── Gradient Popup ───
import { state, nodeIndex, saveSnapshot } from './state.js';
import { PALETTE } from './constants.js';

let gradPopup, gradTarget;
let _overrideHandler = null;

export function initGradientPopup() {
  gradPopup = document.getElementById('gradient-popup');

  document.getElementById('grad-color1').addEventListener('input', (e) => {
    document.getElementById('grad-hex1').textContent = e.target.value;
    updateGradientPreview();
  });
  document.getElementById('grad-color2').addEventListener('input', (e) => {
    document.getElementById('grad-hex2').textContent = e.target.value;
    updateGradientPreview();
  });
  document.getElementById('grad-angle').addEventListener('input', (e) => {
    document.getElementById('grad-angle-val').textContent = e.target.value;
    updateGradientPreview();
  });

  document.getElementById('grad-apply').addEventListener('click', () => {
    // If an override handler is set (e.g. new sector creation), use that instead
    if (_overrideHandler) {
      _overrideHandler();
      gradPopup.classList.remove('open');
      _overrideHandler = null;
      return;
    }
    if (!gradTarget) return;
    saveSnapshot();
    const c1 = document.getElementById('grad-color1').value;
    const c2 = document.getElementById('grad-color2').value;
    const angle = parseInt(document.getElementById('grad-angle').value, 10);
    gradTarget.forEach(id => {
      const n = nodeIndex.get(id);
      if (n) { n.color = c1; n.color2 = c2; n.gradAngle = angle; }
    });
    gradPopup.classList.remove('open');
    // Caller should fullRender after — dispatched via custom event
    document.dispatchEvent(new CustomEvent('editor:render'));
  });
}

export function showGradientPopup(x, y, nodeIds) {
  gradTarget = nodeIds;
  const first = nodeIndex.get(nodeIds[0]);
  document.getElementById('grad-color1').value = first?.color || '#6c8aff';
  document.getElementById('grad-color2').value = first?.color2 || first?.color || '#6c8aff';
  document.getElementById('grad-angle').value = first?.gradAngle || 135;
  document.getElementById('grad-hex1').textContent = first?.color || '#6c8aff';
  document.getElementById('grad-hex2').textContent = first?.color2 || first?.color || '#6c8aff';
  document.getElementById('grad-angle-val').textContent = first?.gradAngle || 135;
  updateGradientPreview();

  const sw = document.getElementById('grad-swatches');
  sw.innerHTML = '';
  PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch';
    s.style.background = c;
    s.addEventListener('click', () => {
      document.getElementById('grad-color1').value = c;
      document.getElementById('grad-hex1').textContent = c;
      updateGradientPreview();
    });
    sw.appendChild(s);
  });

  gradPopup.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  gradPopup.style.top = Math.min(y, window.innerHeight - 380) + 'px';
  gradPopup.classList.add('open');
}

function updateGradientPreview() {
  const c1 = document.getElementById('grad-color1').value;
  const c2 = document.getElementById('grad-color2').value;
  const angle = document.getElementById('grad-angle').value;
  document.getElementById('gradient-preview').style.background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}

// Allow overriding the apply handler (e.g. for new sector creation)
export function overrideGradApply(handler) {
  _overrideHandler = handler;
}
