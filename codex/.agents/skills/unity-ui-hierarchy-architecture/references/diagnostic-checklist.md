# Unity uGUI Diagnostic and Validation Checklist

## Contents

1. Information to collect
2. Hierarchy audit
3. Batch-break matrix
4. Canvas audit
5. Safe Area and responsive audit
6. Text and atlas audit
7. Mask and scrolling audit
8. Layout audit
9. Overdraw audit
10. Measurement loop
11. Acceptance criteria

## 1. Information to collect

Record:

- Unity version
- Target devices and operating systems
- Screen orientation support
- Render pipeline
- Canvas render mode
- CanvasScaler mode and reference resolution
- Number of root and nested Canvases
- Sprite Atlas configuration
- TMP font assets and material presets
- Masks, RectMask2D components, ScrollRects, particles, and RenderTextures
- Which values change every frame, every second, on events, or only when opening the screen
- Baseline CPU and GPU measurements on a target device

## 2. Hierarchy audit

For every Canvas:

- Flatten visible `Graphic` components into render order.
- Mark each element as sprite, TMP text, RawImage, mask, effect, particle, or other.
- Record texture, atlas, font atlas, material, shader, and clipping state.
- Mark overlapping bounds.
- Mark frequently changing elements.
- Mark inactive or zero-alpha elements that remain enabled.
- Identify repeated material sequences such as sprite, text, sprite, text.
- Identify foreground graphics that could safely move behind text.
- Identify static decoration that could be baked without harming reuse or localization.

## 3. Batch-break matrix

| Symptom | Likely cause | Recommended check | Typical response |
|---|---|---|---|
| Same-looking Images do not batch | Different source texture, atlas page, material, clipping, or Canvas | Inspect Frame Debugger and material references | Align atlas/material or accept required boundary |
| `Image -> Text -> Image` creates extra events | Font material is between overlapping sprite groups | Inspect bounds and sibling order | Group back sprites, text, then required front sprites |
| Different Material Instance | Runtime material cloning or unique preset | Compare asset instance IDs and code paths | Reuse a shared material or preset |
| Extra TMP batches | Different font atlas, fallback font, inline sprite, or material effect | Inspect TMP assets and localized text | Standardize shared fonts/materials where possible |
| Masked region creates extra events | Stencil or clipping state changes | Inspect Mask and RectMask2D hierarchy | Localize clipping and reduce nesting |
| Many events after adding Sub-Canvas | Batching cannot cross Canvas boundary | Compare before and after | Keep split only when rebuild or sorting benefit wins |
| Canvas.BuildBatch is high | Large Canvas is dirtied frequently | Find changing graphics and animations | Isolate meaningful dynamic regions |
| Layout markers are high | Nested or repeatedly dirtied layout components | Inspect parent layout chain | Simplify, cache, or rebuild only on change |
| Draw calls are low but GPU is slow | Fill-rate or overdraw | Use GPU and overdraw tools on device | Reduce full-screen and transparent overlap |
| Hidden screen still consumes work | Alpha zero but object remains active | Inspect rendering, layout, raycasts, animations | Disable the appropriate root or Canvas |

## 4. Canvas audit

For every Canvas or Sub-Canvas, answer:

- What independent update domain does it isolate?
- What independent sorting domain does it require?
- Which elements become unable to batch across this boundary?
- Does it carry an unnecessary `GraphicRaycaster`?
- Does it update frequently because of one child?
- Is it disabled when its screen is inactive?
- Is its sorting configuration understandable without encoded numeric names?

Keep a Sub-Canvas only when its measured or architectural benefit is clear.

## 5. Safe Area and responsive audit

Verify:

- Full-bleed backgrounds are outside the safe-area-constrained root when appropriate.
- Readable and interactive elements remain inside the safe area.
- The Safe Area controller updates only on actual screen, orientation, or safe-area changes.
- Anchor containers have no unnecessary `Graphic` components.
- Responsive containers live inside render-layer groups rather than alternating sprite and text groups.
- Portrait and landscape layouts preserve visual order.
- Localized text does not unexpectedly overlap foreground art.
- Touch targets remain accessible near screen cutouts and rounded corners.

## 6. Text and atlas audit

### Sprite Atlas

- Confirm sprites are actually packed into the intended atlas in a build.
- Check whether co-visible sprites use the same atlas page.
- Check memory and loading impact before merging atlases.
- Remove excessive transparent borders when safe.

### TextMeshPro

- Count font assets used on the screen.
- Count material presets used on the screen.
- Identify per-object material instances.
- Test fallback fonts with all supported languages.
- Test outline, underlay, glow, and inline sprite variants.
- Update labels only when their values change.
- Keep bounds no larger than the design requires.

## 7. Mask and scrolling audit

- Prefer rectangular clipping for rectangular viewports.
- Keep the clip region local to the viewport.
- Avoid nested masks when one viewport is sufficient.
- Pool and recycle cells.
- Keep only visible and buffered cells active.
- Avoid a Canvas per cell unless a profile proves it beneficial.
- Check whether item layout recalculates continuously during scrolling.
- Check whether hidden items still receive raycasts or animation updates.

## 8. Layout audit

Search for:

- Nested layout groups
- ContentSizeFitter under layout-controlled parents
- Frequent preferred-size changes
- Text updates propagating through many ancestors
- Repeated calls to force layout rebuilds
- Layout components left enabled after a stable one-time calculation

Test alternatives:

- Anchors and explicit sizes for stable HUDs
- Event-driven layout updates
- Cached sizes
- One-time layout followed by disabling the controller
- A shallower hierarchy

## 9. Overdraw audit

Inspect:

- Full-screen background stacks
- Full-screen dimmers
- Large transparent effects
- Shadows and glows
- Transparent sprite padding
- Screens hidden only with alpha
- UI particles over broad regions
- Covered content that remains enabled behind a modal

Do not judge overdraw from hierarchy alone. Validate on the target GPU.

## 10. Measurement loop

Use a controlled before-and-after test:

1. Choose one representative screen and deterministic state.
2. Capture baseline screenshots, hierarchy, and profiler data.
3. Record batches, draw events, CPU UI markers, vertices, GPU time, and memory where relevant.
4. Change one architecture variable.
5. Repeat the identical test.
6. Verify visual appearance and input.
7. Keep or revert based on evidence.

Suggested change order:

1. Remove accidental material instances.
2. Correct obvious atlas or font inconsistencies.
3. Reorder module render layers where visual overlap permits it.
4. Isolate clearly dynamic regions from large static regions.
5. Simplify masks and layout chains.
6. Reduce overdraw and inactive content.
7. Consider baking only after the simpler changes.

## 11. Acceptance criteria

A refactor is successful when:

- Required visual ordering is unchanged.
- Safe Area and responsive behavior work in all supported orientations.
- Draw-call or rebuild improvements are measured in the target scenario.
- GPU time does not regress because of extra overdraw.
- Texture memory and loading behavior remain acceptable.
- Inactive screens do not render or update unnecessarily.
- Prefabs remain understandable and reusable.
- Hierarchy names describe purpose without numeric IDs or coded prefixes.
- The team can explain why every Sub-Canvas and special material exists.
