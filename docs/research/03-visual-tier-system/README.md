# Research: Visual Tier System (Gradient Color Wash)

**Date**: 2026-03-05
**Researcher**: Claude Opus 4.6
**Status**: Complete

## Summary

How to visually distinguish close partners from satellite partners using gradient color washes and styling, informed by network visualization tools and the user's design intent.

## Key Findings

### User's Design Intent

The user's original concept:
- **Close partners** (`tier: "nah"`) — clean text labels near their sector, current look preserved
- **Satellite partners** (`tier: "satellit"`) — get a **gradient color wash** behind the label using their parent sector's color, faded/desaturated, to visually push them to the background
- The user must be able to **manually toggle** any company between tiers
- This is NOT auto-calculated from distance — it's a deliberate editorial choice

### Network Visualization Prior Art

**Kumu** uses element size, color saturation, and opacity to encode data values:
- High-influence stakeholders = larger circles, saturated colors
- Low-influence = smaller, desaturated
- This is driven by data fields, not position

Source: [Kumu Stakeholder Mapping](https://kumu.io/jeff/stakeholder-mapping)
Date: accessed 2026-03-05

**Gephi** uses modularity classes and community detection:
- Node color = community membership
- Node size = centrality/influence metric
- Edge thickness = relationship strength

Source: [Cascade Institute Stakeholder Mapping](https://cascadeinstitute.org/resources/map/)
Date: accessed 2026-03-05

### Visual Encoding Patterns for Tiers

Common approaches in network visualization:

| Technique | Effect | Pros | Cons |
|-----------|--------|------|------|
| **Opacity reduction** | Satellites at 40-60% opacity | Simple, effective | Can look "broken" |
| **Background wash** | Colored pill/badge behind label | Clear grouping signal | Adds visual weight |
| **Font size/weight** | Satellites smaller + lighter | Subtle, clean | Hard to read small text |
| **Ring/orbit lines** | Dashed circles around sector | Shows distance visually | Adds clutter |
| **Desaturation** | Muted sector color for satellites | Elegant | Needs careful color math |

### Recommended Approach: Gradient Wash Badge

For company nodes with `meta.tier === "satellit"`:

```
[Normal "nah" company]     →  "Schulpsych. Dienst"  (plain text, current style)

[Satellite company]        →  ░░ Schulpsych. Dienst ░░  (soft colored pill behind text)
                               ↑ parent sector color at 12-18% opacity
                               + slightly reduced text opacity (0.7)
                               + slightly smaller font (-1px)
```

**CSS implementation concept:**
```css
.node-company--satellite {
  background: linear-gradient(
    135deg,
    rgba(var(--sector-color-rgb), 0.15),
    rgba(var(--sector-color-rgb), 0.05)
  );
  border-radius: 20px;
  padding: 3px 10px;
  opacity: 0.75;
  font-size: 0.92em;
}
```

The gradient goes from ~15% opacity of the sector color to ~5%, creating a soft directional wash that clearly marks the node as secondary without being distracting.

### Color Computation

To create the wash, we need the parent sector's color in RGB components:
1. Find the company's `parentId`
2. Look up the parent sector's `color` (e.g., `#4ade80`)
3. Parse to RGB: `(74, 222, 128)`
4. Apply as `rgba(74, 222, 128, 0.15)` for the gradient wash

This is already possible with our existing `safeColor()` utility in `utils.js`.

## Conclusion

**Use a subtle gradient wash badge on satellite company nodes.** The effect is:
- Soft pill-shaped background using the parent sector's color at low opacity
- Slightly reduced text opacity and font size
- Driven by `node.meta.tier === "satellit"` — set manually via sidebar or context menu
- Default tier is `"nah"` (no visual change from current)

This approach:
- Matches the user's stated design intent (gradient color wash)
- Is consistent with Kumu/Gephi patterns of using color saturation for importance
- Requires minimal CSS changes — one new class + a few lines in renderer.js
- Works in both light and dark themes (alpha-based, adapts to any background)
