# Responsive uGUI patterns and anti-patterns

Use these patterns as portable starting points. Adapt names, proportions, and component choices to the target project's UI architecture.

## Full bleed plus Safe Area

```text
ScreenRoot
├── BackgroundFill
├── BackgroundArt
├── SafeAreaContent
│   ├── Header
│   ├── Body
│   └── Footer
└── Overlay
```

- Stretch full-bleed art under `ScreenRoot` and disable raycast on decorative Graphics.
- Apply Safe Area anchors to a non-rendering `SafeAreaContent` RectTransform.
- Keep required text, controls, and touch targets inside `SafeAreaContent`.
- Split overlay visuals from overlay actions when only the visuals may extend into unsafe regions.

## Flexible body regions

Pin headers and footers to their Safe Area edges, then stretch the body between them. Divide the body with proportional anchors or Layout Groups when regions must share changing width or height. Keep gutters explicit and small enough to remain meaningful at both extremes.

## Aspect-constrained module

Place a square board, preview, or media region in a flexible parent and use `FitInParent` to preserve its shape. Anchor runtime cells or markers inside the fitted rectangle, not inside the unconstrained screen region.

Use `EnvelopeParent` only for cover behavior where cropping is acceptable, normally full-bleed background art. Choose the pivot from the important area of the artwork.

## Dynamic and localized content

- Give each axis one clear layout owner.
- Use Layout Groups and `LayoutElement` measurements for rows, columns, and flexible modules.
- Let scroll content grow on the scroll axis while the viewport remains bounded.
- Test zero, typical, and maximum data counts.
- Test longest translations, multiline wrapping, fallback glyphs, and the minimum acceptable font size.
- Prefer wrapping, flexible size, bounded autosizing, or scrolling over nonuniform scale.

## Explicit layout variants

Use one anchor/layout composition when it satisfies the complete supported range. If portrait, landscape, or an extreme aspect class requires a genuinely different composition, switch between a small number of product-defined layout variants while sharing presentation data and behavior.

Do not create per-device variants or scatter resolution checks across individual views.

## Anti-patterns

Avoid:

- putting a full-bleed background under the Safe Area and compensating with oversized offsets;
- putting actionable content directly under the full-screen root without an explicit safety reason;
- applying Safe Area adapters at multiple nested levels;
- assuming a centered fixed-size dialog is safe without testing its maximum content bounds;
- anchoring every element to the center and correcting each resolution with positions;
- using large offsets to cancel incorrect parent anchors;
- stretching aspect-sensitive artwork independently on X and Y;
- adding `AspectRatioFitter` to images that do not require preserved shape;
- letting a Layout Group, Content Size Fitter, aspect fitter, and stretch anchors compete on the same axis;
- leaving decorative full-screen Graphics raycastable;
- treating successful compilation or a single reference-resolution screenshot as responsive verification.
