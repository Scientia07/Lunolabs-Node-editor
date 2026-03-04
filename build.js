/**
 * @ai-generated true
 * @agent claude-code
 * @created 2026-03-04
 */
import { buildSync } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

// 1. Bundle JS
const jsResult = buildSync({
  entryPoints: ['src/js/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
});
const bundledJS = new TextDecoder().decode(jsResult.outputFiles[0].contents);

// 2. Concatenate CSS
const cssDir = 'src/styles';
const cssOrder = [
  'tokens.css', 'base.css', 'toolbar.css', 'canvas.css',
  'nodes.css', 'popups.css', 'panels.css', 'toast.css',
];
let bundledCSS = '';
for (const file of cssOrder) {
  const path = join(cssDir, file);
  try {
    bundledCSS += readFileSync(path, 'utf8') + '\n';
  } catch {
    console.warn(`Warning: ${path} not found, skipping`);
  }
}

// 3. Read shell HTML and inline everything
const shell = readFileSync('src/index.html', 'utf8');

// Replace CSS links with inlined style block
const cssLinkPattern = /\s*<link\s+rel="stylesheet"\s+href="styles\/[^"]*"\s*\/?>\s*/g;
let output = shell.replace(cssLinkPattern, '\n');
// Insert inlined CSS before </head>
output = output.replace('</head>', `<style>\n${bundledCSS}</style>\n</head>`);

// Replace module script with inlined bundle
output = output.replace(
  /<script type="module" src="js\/main\.js"><\/script>/,
  `<script>\n${bundledJS}\n</script>`
);

// Remove any remaining local stylesheet references
output = output.replace(/\s*<link[^>]*href="styles\/[^"]*"[^>]*>/g, '');

// Clean up extra blank lines
output = output.replace(/\n{3,}/g, '\n\n');

writeFileSync('dist/index.html', output, 'utf8');

// Copy data files for project loading
try {
  mkdirSync('dist/data', { recursive: true });
  const dataFiles = readdirSync('src/data');
  for (const f of dataFiles) {
    copyFileSync(join('src/data', f), join('dist/data', f));
  }
  console.log(`  Data: ${dataFiles.length} file(s) copied`);
} catch { /* no data files */ }

console.log('Built dist/index.html successfully');
console.log(`  CSS: ${(bundledCSS.length / 1024).toFixed(1)}KB`);
console.log(`  JS:  ${(bundledJS.length / 1024).toFixed(1)}KB`);
