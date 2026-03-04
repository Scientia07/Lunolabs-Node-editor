/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
// ─── Context Menu ───

let contextMenu;

export function initContextMenu() {
  contextMenu = document.getElementById('context-menu');
}

export function showContextMenuAt(x, y) {
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('open');
}

export function clearContextMenu() {
  contextMenu.innerHTML = '';
}

export function addCtxItem(label, shortcut, cb, danger) {
  const el = document.createElement('div');
  el.className = 'ctx-item' + (danger ? ' danger' : '');
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  el.appendChild(labelSpan);
  if (shortcut) {
    const sc = document.createElement('span');
    sc.className = 'shortcut';
    sc.textContent = shortcut;
    el.appendChild(sc);
  }
  el.addEventListener('click', () => { closeMenus(); cb(); });
  contextMenu.appendChild(el);
}

export function addCtxSep() {
  const el = document.createElement('div');
  el.className = 'ctx-sep';
  contextMenu.appendChild(el);
}

export function closeMenus() {
  contextMenu.classList.remove('open');
  const colorPopup = document.getElementById('color-popup');
  const gradPopup = document.getElementById('gradient-popup');
  const fontPopup = document.getElementById('font-popup');
  if (colorPopup) colorPopup.classList.remove('open');
  if (gradPopup) gradPopup.classList.remove('open');
  if (fontPopup) fontPopup.classList.remove('open');
  document.getElementById('shapes-dropdown').classList.remove('open');
  document.getElementById('export-dropdown').classList.remove('open');
}
