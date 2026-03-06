---
name: html-quality
description: >-
  Enforces HTML quality standards when writing or editing HTML files.
  Use WHEN creating new HTML elements, editing index.html, adding UI components,
  or generating markup in JS (innerHTML, template literals). Covers accessibility,
  semantics, and style hygiene. NOT for CSS-only or JS-only changes.
user-invocable: false
---

## HTML Quality Rules for This Project

When writing or modifying HTML (in `.html` files or JS-generated markup), apply ALL of the following rules.

### 1. Accessibility (A11y)

- **Decorative SVGs**: Add `aria-hidden="true"` to every inline `<svg>` that is purely visual
- **Icon-only buttons**: MUST have `aria-label="Beschreibung"` (German) — `title` alone is insufficient
- **Interactive elements**: Use `<button>` not `<div>` for clickable items. If a `<div>` has a click handler, it needs `role="button"` and `tabindex="0"` at minimum — but prefer real `<button>`
- **Labels**: Every `<input>`, `<select>`, `<textarea>` needs an associated `<label for="id">` or `aria-label`
- **Hidden inputs**: Use `hidden` attribute (not `style="display:none"`) plus `aria-hidden="true"`
- **Live regions**: Toast/notification containers need `role="status"` and `aria-live="polite"`
- **Dialogs/popups**: Add `role="dialog"` and `aria-label` to popup containers
- **Tabs**: Use `role="tablist"` on container, `role="tab"` + `aria-selected` on tab buttons, `role="tabpanel"` on panes

### 2. Semantic HTML

- **Toolbar**: `role="toolbar"` + `aria-label` on toolbar containers
- **Sidebar**: Use `<aside>` instead of `<div>` for sidebars
- **Separators**: Add `role="separator"` to visual dividers
- **Headings**: Do NOT use `<h1>`-`<h6>` for popup/panel titles — use `<strong class="popup-heading">` (no heading hierarchy needed in floating UI)
- **Dropdowns**: `role="menu"` on container, `role="menuitem"` on items, `aria-expanded` + `aria-controls` on trigger button
- **Groups**: Use `role="group"` + `aria-label` for related control sets (e.g., zoom controls)

### 3. No Inline Styles

- **NEVER** add `style="..."` attributes in HTML
- Use existing CSS utility classes instead:
  - `.dropdown-icon` — 16x16 SVG icon in dropdown items
  - `.chevron-icon` — 12x12 dropdown arrow
  - `.zoom-icon` — 14x14 zoom button icon
  - `.zoom-fit-label` — mono font label for FIT button
  - `.popup-select` — styled select in popup panels
  - `.popup-hex-label` — hex color display text
  - `.sr-only` — visually hidden but screen-reader accessible
  - `.modal-overlay` — fixed fullscreen backdrop (z-index 5000)
  - `.modal-box` — centered modal content container
  - `.modal-btn` / `.modal-btn.primary` / `.modal-btn.cancel` — modal action buttons
  - `.modal-actions` — flex row for modal buttons
- If no utility class exists, **create one in the appropriate CSS file** before using it
- Range inputs (`<input type="range">`) are auto-sized via `.popup-panel input[type="range"]` and `.np-pane input[type="range"]` — no inline `width:100%` needed

### 4. German Text

- **Use proper UTF-8 umlauts** in visible text: ä, ö, ü, Ä, Ö, Ü, ß
- Correct: `Farbe wählen`, `Grösse`, `Stärke`, `Höhe`, `hinzufügen`
- Wrong: `Farbe waehlen`, `Groesse`, `Staerke`, `Hoehe`, `hinzufuegen`
- Swiss German convention: use `ss` instead of `ß` (e.g., `Grösse` not `Größe`)

### 5. JS-Generated Markup

When building HTML in JavaScript (`innerHTML`, template literals, `createElement`):
- Apply the same rules above
- SVGs in JS: always include `aria-hidden="true"`
- Buttons in JS: always include `type="button"` to prevent accidental form submission
- Prefer `document.createElement` + setting properties over innerHTML for security (no XSS risk)

### Quick Checklist

Before committing HTML changes:
- [ ] Every `<svg>` has `aria-hidden="true"`
- [ ] Every icon-only `<button>` has `aria-label`
- [ ] No `<div>` used as a button
- [ ] No inline `style` attributes
- [ ] German text uses proper umlauts (Swiss `ss` convention)
- [ ] Labels associated with form controls
- [ ] Popups have `role="dialog"` + `aria-label`
- [ ] Tab patterns have proper ARIA roles
