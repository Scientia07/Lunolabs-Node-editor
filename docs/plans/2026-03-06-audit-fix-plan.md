# Audit Fix Plan — Netzwerk-Editor

**Date**: 2026-03-06
**Source**: Full codebase audit (code quality, UX, features)

---

## Wave 1 — P0 Bug Fixes

- [x] **BUG-1**: ~~XSS in search.js~~ — FALSE POSITIVE: `highlightLabel()` already escapes via `esc()`
- [x] **BUG-2**: Self-loop in endpoint drag — FIXED: unified guard checks `otherId` before reassigning
- [x] **BUG-3**: Hardcoded sidebar width in search.js — FIXED: reads `--sidebar-w` CSS var now
- [x] **BUG-4**: Stale node reference in Details tab — FIXED: captures `nodeId`, re-fetches via `nodeIndex.get()`
- [x] **BUG-5**: ~~Listener accumulation~~ — LOW RISK: innerHTML replacement removes old DOM nodes, GC handles

## Wave 2 — Trim the Fat

- [x] **TRIM-1**: Drop 4 unused Google Fonts (Inter, Poppins, Outfit, Nunito) — keep DM Sans + Space Mono
- [x] **TRIM-2**: Remove font popup (`font-popup.js` deleted, HTML removed, context menu cleaned) — node-popup font tab kept
- [~] **TRIM-3**: ~~Simplify gradient popup~~ — DEFERRED: angle slider is ~15 lines, low value
- [~] **TRIM-4**: ~~Remove connection outline controls~~ — DEFERRED: ~20 lines, low value
- [x] **TRIM-5**: Remove file header rating blocks from 24 JS files (~300 lines of comments)
- [~] **TRIM-6**: ~~Remove shapes dropdown~~ — DEFERRED: existing nodes may use rect/circle types, needs data migration

## Wave 3 — Add What Matters

- [x] **ADD-1**: Auto-fit viewport on project load — DONE: `zoomFit()` called after `applyProject` in project-manager.js
- [x] **ADD-2**: Keyboard shortcut help overlay — DONE: `?` button in toolbar + modal with 3-column layout + `?` key binding
- [x] **ADD-3**: Onboarding empty state — DONE: centered welcome message with icon, instructions, and kbd hint when no nodes exist

## Future (separate sessions)

- Connection labels (P1 — 4-6 hrs)
- Mobile/tablet responsive layout (P2 — 8+ hrs)
- Print/PDF stylesheet (P2 — 2 hrs)
- Incremental DOM rendering in renderer.js (P3 — 6-8 hrs)
- Split sidebar.js + interactions.js (P3 — 3-4 hrs)

---

## Verification

After each wave:
1. `npx vitest run` — all 119 tests pass
2. `node build.js` — build succeeds
3. Visual check in browser via Playwright
