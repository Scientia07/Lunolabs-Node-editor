# Network Map Editor — Design

## Purpose
Interactive whiteboard-style network map for Jugendburo to visualize partner companies organized by sector.

## Node Types
1. **Sector nodes** — Large colored circles/rects. User picks color. Editable label.
2. **Company nodes** — Smaller text nodes. Created as children of a sector (auto-connected). Editable inline.

## Whiteboard Features
- **Infinite canvas** — pan (Space+drag / middle-click), zoom (scroll wheel), mini-map
- **Sticky notes** — colored, editable, resizable
- **Shapes** — rectangle, circle, text box. Configurable fill/border/color
- **Undo/Redo** — full action history (Ctrl+Z / Ctrl+Y)
- **Grid & Snap** — toggle-able grid, snap-to-grid, Alt to disable temporarily
- **Multi-select** — drag selection rectangle, Shift+click, bulk move/delete

## Connections
- SVG bezier curves between nodes
- Auto-created when company added near a sector (within 600px)
- Manual connections between any two nodes (via anchor points or Connect tool)
- Custom color per connection (right-click -> Farbe aendern)

## Interactions
- **Add sector**: Toolbar Sektor -> click canvas -> color picker -> name -> placed
- **Add company**: Toolbar Firma -> click canvas -> auto-connects to nearest sector
- **Drag & drop**: All elements freely draggable, connections follow
- **Edit text**: Double-click any node for inline editing
- **Delete**: Right-click context menu or Delete key
- **Duplicate**: Ctrl+D or context menu

## Persistence
- Auto-save to localStorage on every change
- Export JSON (for backup/sharing)
- Export PNG with white background (for presentations/documents)
- Import JSON to restore state

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| V | Select tool |
| C | Connect tool |
| G | Toggle grid |
| Space+drag | Pan canvas |
| Alt+drag | Disable snap while dragging |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+D | Duplicate selected |
| Ctrl+A | Select all |
| Delete | Delete selected |
| Escape | Deselect / cancel |

## Toolbar Layout
[Auswahl] [Sektor] [Firma] | [Sticky] [Formen v] [Verbinden] | [Grid] | [Undo] [Redo] | [Export v] [Import]

## Tech Stack
- Single `index.html` file (~700 lines)
- Vanilla JS, zero dependencies
- SVG layer for connections, HTML divs for nodes
- Canvas API for grid, minimap, and PNG export
- Native color input for custom colors
- DM Sans + Space Mono fonts (Google Fonts)
- Dark blueprint aesthetic with blue accent (#6c8aff)
