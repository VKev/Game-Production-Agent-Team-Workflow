# Responsive uGUI decision guide

## CanvasScaler

With `Scale With Screen Size`, select the policy from the layout contract rather than from a single screenshot.

| Policy | Useful when | Main risk to test |
|---|---|---|
| Match Width Or Height | Visual scale should follow one axis or a controlled blend | The opposite axis may reveal less or more logical space than expected |
| Expand | The logical Canvas must never become smaller than the reference resolution | Extra logical width or height becomes visible and may expose unprepared edges |
| Shrink | The logical Canvas must never become larger than the reference resolution | Content can become small and additional pixels may need intentional composition |
| Constant Pixel Size | Pixel units must map directly to screen pixels | Physical size varies strongly with resolution and density |
| Constant Physical Size | A stable physical measurement is essential and device DPI is trustworthy | Device DPI reporting can be inaccurate; game UI art commonly needs another policy |

Keep the reference resolution aligned with the authored design coordinate system. Preserve a consistent existing policy across related screens unless the supported-device contract demonstrates a failure.

## Safe Area coordinate mapping

`Screen.safeArea` is a pixel-space rectangle whose origin is at the bottom-left. Convert it to normalized anchors:

```text
anchorMin = (safeArea.xMin / screenWidth, safeArea.yMin / screenHeight)
anchorMax = (safeArea.xMax / screenWidth, safeArea.yMax / screenHeight)
offsetMin = (0, 0)
offsetMax = (0, 0)
```

Guard zero dimensions and non-finite values. Refresh on enable, parent or screen-dimension change, runtime orientation changes, application focus return, and a changed safe rectangle. Avoid continuously assigning identical values because that can dirty the layout unnecessarily. The formula assumes a full-screen Canvas root; account for a camera viewport or another constrained root before applying it elsewhere.

Use separate X/Y conformance only when the design explicitly permits content to ignore one safe axis.

Apply the Safe Area once per screen coordinate space. A second adapter nested beneath the first normally doubles the inset.

## Hierarchy ownership

```text
CanvasRoot
├── BackgroundFill              full stretch; raycast off
├── BackgroundArt               cover or stretch; raycast off
├── SafeAreaContent             normalized safe anchors; no Graphic
│   ├── Header                  top + horizontal stretch
│   ├── Body                    full stretch with header/footer gutters
│   │   ├── PrimaryRegion       proportional or flexible width
│   │   └── SecondaryRegion     proportional or flexible width
│   └── Footer                  bottom + horizontal stretch
└── Overlay
    ├── OverlayBleed            optional full-screen visual/blocker
    └── OverlaySafeContent      actions and required text
```

A RectTransform inside `SafeAreaContent` cannot anchor to screen space outside that parent. If an element must bleed behind a notch, move it to the full-screen coordinate space rather than increasing offsets inside the Safe Area.

## Anchor semantics

| Invariant | Anchor pattern | Pivot and offsets |
|---|---|---|
| Fixed to top-left | min=max=(0,1) | pivot near (0,1); positive inward offsets |
| Fixed to bottom-right | min=max=(1,0) | pivot near (1,0); negative X and positive Y inward offsets |
| Full-width header | X 0..1, Y 1..1 | top-oriented pivot; explicit height and horizontal gutters |
| Full-width footer | X 0..1, Y 0..0 | bottom-oriented pivot; explicit height and horizontal gutters |
| Fill remaining body | min=(0,0), max=(1,1) | offsets reserve header, footer, and gutters |
| Proportional split | e.g. left X 0..0.56, right X 0.56..1 | small seam/gutter offsets only |
| Centered bounded dialog | min=max=(0.5,0.5) | centered pivot; maximum size must fit the smallest Safe Area |
| Repeated grid cell | normalized row/column min/max | zero position; deliberate spacing or inset |

Large offsets are not automatically wrong, but they require a named design invariant and verification at both aspect-ratio extremes. Do not use them to cancel an incorrect parent anchor.

## AspectRatioFitter

| Mode | Behavior | Typical use |
|---|---|---|
| `EnvelopeParent` | Covers the parent; one axis can extend beyond it | full-bleed background art when cropping is acceptable |
| `FitInParent` | Fits entirely inside the parent; unused space can remain | square game board, preview, uncropped media |
| Width/Height Controls | Calculates one axis from the other | a module whose single driving dimension is explicit |

The pivot determines which area is retained when a fitted rectangle grows beyond a boundary. Check sprite import borders and image type as well; aspect fitting cannot correct an unsuitable sliced or tightly packed source asset.

## Layout ownership

Assign a single clear driver for each axis:

- anchors plus offsets drive the region supplied by the parent;
- a Layout Group places and may size its children;
- `LayoutElement` supplies minimum, preferred, and flexible measurements;
- `ContentSizeFitter` sizes its RectTransform from calculated content requirements;
- an aspect fitter derives one dimension or fits the rectangle from an aspect rule.

Valid combinations are intentional, such as a vertical group calculating preferred height and a content fitter applying that height to scroll content. Invalid combinations create cycles or competing writes, such as a parent depending on a child size while that child stretches to the parent on the same axis.

## Common failures

| Symptom | Diagnose first | Preferred correction |
|---|---|---|
| Background stops at notch boundary | Background is under Safe Area | Move only the background to the Canvas root and stretch/cover it |
| Button enters notch or home indicator | Button or its parent is outside Safe Area | Move actionable content into the safe coordinate space |
| UI looks correct only at 16:9 | Fixed positions or untested scaler policy | Define invariants, use anchors/layout, test width and height extremes |
| Center panel clips on small Safe Area | Fixed panel larger than supported logical bounds | Add maximum sizing, flexible layout, scrolling, or a smaller breakpoint design |
| Text overlaps in another language | Fixed child widths and unbounded text | Add preferred/flexible sizing, wrapping or bounded autosizing; test longest locale |
| Full-screen image blocks controls | Decorative Graphic has raycast enabled | Disable raycast unless it deliberately consumes input |
| Square board distorts | It stretches independently on X and Y | Place it in a fitting parent with `FitInParent`, then anchor cells inside it |
| Scroll content will not resize | Multiple components drive the scroll axis | Give the viewport fixed bounds and one content sizing chain |
| Rotation fixes only after reopening | Safe Area is applied only once | Reapply when dimensions/orientation/safe rectangle changes |
| Safe inset appears doubled | Nested Safe Area adapters both modify anchors | Keep one adapter for the screen coordinate space |
| Overlay art is full screen but its actions are unsafe | Visual and actionable overlay content share one coordinate space | Split full-bleed overlay visuals from safe overlay content |
| Landscape and portrait both feel compromised | One hierarchy is being stretched beyond its design contract | Use an explicit orientation/aspect layout variant with shared data and behavior |
