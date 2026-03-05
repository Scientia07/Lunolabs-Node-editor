---
name: build-system
description: How the build system works — esbuild bundling, CSS concatenation, data embedding, and single-file HTML output. Follow this when modifying the build, adding new CSS/JS files, or embedding project data.
trigger: When modifying the build process, adding new source files, embedding data, or troubleshooting build issues
---

# Build System — Netzwerk-Editor

## Overview

The build produces a **single self-contained `dist/index.html`** that works offline and from `file://`. No server needed.

```
src/                    → node build.js →    dist/index.html
  index.html                                  (all CSS inlined)
  styles/*.css                                (all JS bundled)
  js/*.js                                     (project data embedded)
  data/*.json
```

## Running the Build

```bash
node build.js
```

Output:
```
Embedded: 1 project(s) (netzwerk-jb-march)
Data: 1 file(s) copied
Built dist/index.html successfully
  CSS: 23.1KB
  JS:  69.7KB
```

## Build Steps

### 1. Bundle JS with esbuild

```javascript
const result = buildSync({
  entryPoints: ['src/js/main.js'],
  bundle: true,
  format: 'esm',      // ES modules → single bundle
  minify: true,
  write: false,        // Return as string
});
```

- Entry point: `src/js/main.js`
- All ES module imports are resolved and bundled
- Tree-shaking removes unused exports

### 2. Concatenate & Minify CSS

CSS files are concatenated in the order they appear as `<link>` tags in `index.html`:

```
tokens.css → base.css → toolbar.css → canvas.css → nodes.css → popups.css → panels.css → sidebar.css → toast.css
```

**Order matters** because later files can override earlier ones (CSS cascade).

After concatenation, CSS is minified via esbuild `transformSync({loader:'css', minify:true})` — ~22% savings with zero extra deps.

### 3. Embed Project Data

JSON files in `src/data/` are embedded as a global:

```html
<script>window.__EMBEDDED_PROJECTS__ = { "netzwerk-jb-march": { nodes: [...], connections: [...] } };</script>
```

This is loaded by `project.js:loadFromURL()` when the URL contains `?project=netzwerk-jb-march`.

### 4. Inline into HTML

The build replaces:
- `<link rel="stylesheet" ...>` tags → `<style>` block with concatenated CSS
- `<script type="module" src="js/main.js">` → `<script>` block with bundled JS
- Adds embedded data script before the main script

## Adding New Files

### New JS Module

1. Create `src/js/my-module.js`
2. Import it from an existing module (transitively reachable from `main.js`)
3. Build — esbuild automatically includes it

**No build config changes needed.** esbuild follows the import graph.

### New CSS File

1. Create `src/styles/my-styles.css`
2. Add `<link rel="stylesheet" href="styles/my-styles.css">` to `src/index.html`
3. Build — the build script reads link tags and concatenates in order

### New Data File

1. Place `my-project.json` in `src/data/`
2. Build — automatically embedded
3. Access via `?project=my-project` URL parameter

## Development vs Production

| Mode | How to Run | Features |
|------|-----------|----------|
| **Dev** | Open `src/index.html` in browser | ES modules loaded individually, no bundling |
| **Prod** | `node build.js` then open `dist/index.html` | Single file, minified, embedded data |

In dev mode, the browser loads ES modules natively. No dev server needed — just open the file. The `src/data/` files are loaded via fetch in dev mode and via `window.__EMBEDDED_PROJECTS__` in prod.

## Troubleshooting

### Build fails with import error
- Check that all imports use `.js` extensions: `import { x } from './module.js'`
- esbuild requires explicit extensions for ES modules

### CSS not applied in build
- Verify the `<link>` tag exists in `src/index.html`
- Check CSS file order — later files override earlier ones

### New module not included
- Ensure it's imported (directly or transitively) from `main.js`
- Orphan modules not reachable from the entry point are excluded

### Data file not embedded
- Place it in `src/data/` (not a subdirectory)
- Must be valid JSON (`.json` extension)

## Output Size Guidelines

Current sizes (minified):
- CSS: ~28KB (minified via esbuild transformSync)
- JS: ~85KB
- Total HTML: ~130KB (with embedded project data)

The single-file output is designed to be shareable via email, USB, or any file transfer. Keep it under 500KB for practical use.
