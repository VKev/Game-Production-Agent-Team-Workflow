---
name: dev-unity-responsive-ui
description: Design, audit, implement, and verify responsive Unity uGUI screens across resolutions, aspect ratios, orientations, display cutouts, safe areas, localization, and dynamic content. Use for CanvasScaler, RectTransform anchors, pivots and offsets, Screen.safeArea containers, full-bleed backgrounds, AspectRatioFitter, LayoutGroup, ContentSizeFitter, ScrollRect, adaptive text, touch targets, runtime grids, Device Simulator, or UI that clips, stretches, shifts, overlaps, or leaves controls in unsafe screen regions.
---

# Unity Responsive UI

## Scope

Build portable layout correctness for screen-space Unity uGUI. Treat responsiveness as three cooperating layers:

1. `CanvasScaler` defines the screen-to-reference coordinate policy.
2. the full-screen and Safe Area containers define valid coordinate spaces.
3. anchors, pivots, layout components, and content rules define each element inside its parent.

Do not apply these rules unchanged to UI Toolkit or World Space Canvas UI. Load `dev-unity-ui-hierarchy-architecture` as well only when the task also involves Canvas partitioning, draw order, batching, rebuild cost, masks, or overdraw.

## Workflow

### 1. Establish constraints before editing

Inspect the actual Unity and uGUI versions, Canvas render mode and viewport, target platforms, supported orientations, minimum and maximum aspect ratios, reference artboard, Safe Area policy, localization set, dynamic-data extremes, and current screen hierarchy.

Record separately:

- elements allowed to draw behind cutouts or system bars;
- controls and readable content that must remain inside the Safe Area;
- regions that must preserve aspect ratio;
- fixed, flexible, and scrollable content;
- the reference-resolution appearance that must not regress.

If the task is only a review, diagnose and report without editing. If Inspector configuration is sufficient, do not add a script merely to encode the same static layout.

### 2. Choose one explicit scaling policy

Inspect the current `CanvasScaler` before changing child RectTransforms. Preserve a sound project-wide policy rather than mixing unrelated reference resolutions across screens.

Treat the reference resolution as the UI's authored coordinate system, not a required device resolution. Choose `Match Width Or Height`, `Expand`, or `Shrink` from the supported-screen contract, then validate both aspect-ratio extremes. Preserve a sound existing project-wide policy unless evidence requires a migration.

Read [decision guide](references/decision-guide.md) before changing a scaler mode or reference resolution.

### 3. Separate full-bleed visuals from safe content

Prefer this coordinate-space structure:

```text
ScreenRoot (Canvas + CanvasScaler)
├── FullBleedBackground
├── SafeAreaContent (non-rendering RectTransform + Safe Area adapter)
│   ├── Header
│   ├── Body
│   └── Footer
└── Overlay
```

Apply these rules:

- Stretch full-bleed visuals to `ScreenRoot`, outside `SafeAreaContent`.
- Put interactive controls and required readable content inside `SafeAreaContent`.
- Make decorative full-screen `Graphic` components non-raycastable unless they intentionally block input.
- Decide overlay behavior per layer: its visuals may bleed, but its actionable content usually remains safe.
- Never try to make a child escape the coordinate space of its Safe Area parent.

A Safe Area adapter should normalize `Screen.safeArea` pixel coordinates by the current full-screen dimensions, assign the resulting `anchorMin` and `anchorMax`, keep offsets zero, guard invalid dimensions, and refresh when dimensions, orientation, focus, or the reported safe rectangle changes. This direct mapping assumes the Canvas root covers the whole screen; convert through the actual camera viewport or root rectangle when it does not. Allow X and Y conformance to be selected independently when the product requires it, and avoid applying the same inset twice through nested Safe Area containers.

### 4. Anchor by semantic invariant

For every element, state what must remain invariant before choosing anchors:

- edge or corner controls: anchor to that Safe Area edge or corner;
- headers, footers, and bands: stretch on the flexible axis and pin on the fixed axis;
- side-by-side regions: use proportional anchor ranges, then apply intentional gutters;
- centered dialogs: center-anchor a bounded panel, but prove the maximum panel and content fit every supported Safe Area;
- full-region content: stretch with intentional offsets, normally zero at the owning boundary.

Anchors are relative to the immediate parent, not the physical screen. Use the pivot to control the direction of growth. Avoid per-device `anchoredPosition` fixes, unexplained large offsets, nonuniform scale, and duplicated layout responsibilities.

When one composition cannot satisfy both supported orientations or extreme aspect classes, use an explicit layout variant driven by a small number of product-defined breakpoints. Do not build a table of individual device exceptions.

### 5. Preserve media and module shapes intentionally

- Use a plain stretched `Image` or `RawImage` for a solid or freely stretchable fill.
- Use `AspectRatioFitter.EnvelopeParent` for cover behavior when cropping is acceptable and full bleed is required.
- Use `AspectRatioFitter.FitInParent` for boards, previews, or media that must remain fully visible; accept the remaining space deliberately.
- Set the pivot to control where cover-mode cropping occurs.
- Do not add an aspect fitter to every image. Use it only where shape preservation is an actual requirement.

### 6. Assign one layout owner per axis

Use `HorizontalLayoutGroup`, `VerticalLayoutGroup`, `GridLayoutGroup`, `LayoutElement`, and `ContentSizeFitter` for content-driven modules, not as patches for incorrect anchors.

- Define which parent or component owns width and height on each axis.
- Avoid feedback loops between parent sizing and child sizing.
- For a `ScrollRect`, keep the viewport bounded and let content grow only on the intended scroll axis.
- Use normalized anchors for runtime grids when cells must divide an arbitrary rectangle; use `GridLayoutGroup` when its cell and constraint model matches the design.
- Preserve a square grid in a fitting parent before placing its normalized cells.
- Test empty, minimum, typical, and maximum content.

### 7. Treat text and interaction as responsive content

Test the longest supported translations, multiline wrapping, text expansion, font fallback, minimum readable font size, and dynamic values. Prefer flexible containers, layout elements, wrapping, and bounded autosizing over nonuniform scale or language-specific coordinates.

Keep controls inside the Safe Area, preserve the product's minimum touch-target size, and check that decorative graphics do not intercept clicks. Verify keyboard, navigation, pointer, and touch interaction when the target platform uses them.

### 8. Verify in the Editor and on representative devices

Use Unity MCP when available for hierarchy, Inspector, Game view, Device Simulator, runtime rotation, console, and screenshot evidence. File inspection can establish serialized configuration but cannot prove visual correctness.

Read [verification matrix](references/verification-matrix.md) and test at least:

- the reference resolution;
- the narrowest and widest supported aspect ratios;
- tablet or desktop-resizable bounds when supported;
- cutout and no-cutout devices;
- every supported orientation;
- longest localization and maximum dynamic content.

Report compilation, automated checks, Inspector review, visual screenshots, device simulation, and human playtest as separate evidence. Never claim responsiveness from compilation alone.

## Output contract

For a responsive UI task, report:

1. target-screen assumptions and constraints;
2. current scaler, Safe Area, anchor, layout, and input findings;
3. the selected hierarchy and scaling policy;
4. concrete changes with the invariant each change preserves;
5. rejected alternatives and material layout risks;
6. the executed test matrix, evidence, and remaining visual QA.

## Hard boundaries

- Do not hard-code device model or resolution exceptions unless the product explicitly requires a documented exception.
- Do not move full-bleed backgrounds under a Safe Area and compensate with oversize offsets.
- Do not put all screen content outside the Safe Area merely to make the background fill.
- Do not copy fixed offsets from another screen without proving the same parent coordinate space and constraint.
- Do not mix `CanvasScaler` policies casually between screens managed by the same UI system.
- Do not assume a centered fixed-size panel is safe; prove its maximum bounds or provide flexible sizing, scrolling, or an explicit layout variant.

## References

- [Decision guide](references/decision-guide.md): scaler, Safe Area, anchors, aspect fitting, layout ownership, and failure corrections.
- [Patterns and anti-patterns](references/patterns-and-antipatterns.md): reusable hierarchy patterns and common responsive failures.
- [Verification matrix](references/verification-matrix.md): screen, content, interaction, and evidence checks.
- [Sources](references/sources.md): official Unity documentation; use the version matching the target project.
