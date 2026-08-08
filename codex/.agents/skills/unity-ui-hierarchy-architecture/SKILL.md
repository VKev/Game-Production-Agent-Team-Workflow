---
name: unity-ui-hierarchy-architecture
description: Design, review, and refactor responsive Unity uGUI hierarchies to reduce draw calls, batch breaks, Canvas rebuild cost, and overdraw while preserving Safe Area behavior and correct visual layering. Use for Unity UI hierarchy architecture, Sprite Atlas batching, Image/Text/Image render-order switches, Canvas or sub-Canvas organization, TextMeshPro font and material batching, masks, ScrollRect, responsive anchors, mobile Safe Area handling, UI Profiler analysis, Frame Debugger analysis, HUDs, menus, popups, inventories, and reusable UI prefabs. Produce descriptive hierarchy names without numeric IDs or coded prefixes, explain tradeoffs, and provide a measurable validation plan.
---

# Unity UI Hierarchy Architecture

## Scope

Target Unity uGUI: `Canvas`, `RectTransform`, `Image`, `RawImage`, `TextMeshProUGUI`, `Mask`, `RectMask2D`, `ScrollRect`, `LayoutGroup`, and `CanvasScaler`.

Do not silently apply uGUI rules to UI Toolkit. When the project uses UI Toolkit, state that the rendering and hierarchy model differs and adapt only the general principles.

Use descriptive object names. Never introduce coded numeric hierarchy names, sorting numbers in object names, or unexplained abbreviations.

## Core model

Treat UI optimization as four related but different problems:

- **Batching and draw calls:** compatible graphics can be submitted together only when render state and ordering permit it.
- **Canvas rebuild cost:** changing one graphic can cause geometry or batch work for the Canvas that owns it.
- **Layout rebuild cost:** nested automatic layout components can repeatedly dirty and recalculate the hierarchy.
- **Overdraw:** transparent UI layers can shade the same pixels many times even when draw-call count is low.

Never claim that Sprite Atlas usage alone guarantees batching. Always inspect material, texture or atlas, font atlas, clipping state, Canvas boundary, render order, and geometric overlap.

## Workflow

### 1. Establish the rendering context

Use the information provided. Useful inputs include:

- Unity version and target platform
- uGUI render mode and render pipeline
- Current hierarchy or prefab screenshots
- UI Profiler and Frame Debugger captures
- Sprite Atlas and TextMeshPro font/material setup
- Frequently changing elements
- Safe Area and orientation requirements
- Masks, ScrollRects, shader effects, particles, and RenderTextures

When details are missing, proceed with clearly stated assumptions rather than blocking the task. Ask at most one high-value question only when the answer would materially change the architecture.

### 2. Reconstruct draw order per Canvas

Flatten each Canvas into its effective render order. Record for every visible `Graphic`:

- Canvas and sorting context
- Texture, sprite atlas, or font atlas
- Shared material or material instance
- Shader variant
- Clipping or stencil state
- Whether its bounds overlap neighboring graphics
- Whether it changes frequently

Explain that a sequence such as `Image -> Text -> Image` can create repeated render-state switches when the middle text overlaps both image groups and prevents safe reordering.

### 3. Diagnose the dominant cost

Classify each finding as one or more of:

- Texture or atlas switch
- Different material instance
- Font atlas or TMP material switch
- Mask, stencil, or rectangular clipping boundary
- Sub-Canvas boundary
- Required visual ordering caused by overlap
- Frequent Canvas dirtiness
- Expensive layout rebuild
- Excessive transparent overdraw

Do not optimize a metric that is not the bottleneck. Distinguish CPU rebuild cost from GPU draw-call and fill-rate cost.

### 4. Partition Canvases by update domain and sorting domain

Prefer a small number of purposeful Canvases. A sensible default is:

```text
UserInterfaceRoot
├── FullBleedBackground
├── SafeAreaContent
│   ├── StaticHud
│   ├── DynamicHud
│   └── ActiveScreen
└── Overlay
```

Apply these rules:

- Keep backgrounds that may extend behind notches under `FullBleedBackground`.
- Make `SafeAreaContent` a non-rendering `RectTransform` that applies safe-area anchors.
- Put stable decoration and labels in `StaticHud`.
- Put timers, health bars, counters, cooldowns, and animated HUD content in `DynamicHud`.
- Put only the currently active menu or screen in `ActiveScreen`.
- Reserve `Overlay` for popups, blockers, tutorials, loading, toasts, and content that must sort above the main UI.
- Split a Sub-Canvas when it isolates frequently dirty content or requires an independent sorting domain.
- Do not create a Canvas for every button, card, icon, label, or list item.
- Remember that batching does not cross Canvas boundaries; every split has a tradeoff.

### 5. Organize each module by visual render layers

Use descriptive groups based on actual front-to-back requirements:

```text
PlayerStatus
├── BackgroundImages
├── ContentImages
├── TextContent
├── ForegroundDecoration
└── SpecialEffects
```

Interpret the groups as follows:

- `BackgroundImages`: panels, shadows, bar backgrounds, and decoration that can remain behind all content.
- `ContentImages`: portraits, icons, item art, bar fills, and regular atlas sprites.
- `TextContent`: TextMeshPro labels that can render together with shared font assets and shared materials.
- `ForegroundDecoration`: only frames, badges, corners, or overlays that truly must appear above text.
- `SpecialEffects`: graphics using exceptional shaders, grayscale, blur, shine, dissolve, additive effects, or UI particles.

Create only the groups the module needs. Do not preserve a foreground image pass merely because a prefab was originally authored that way. Move decoration behind text or bake static decoration when the visual result remains correct.

### 6. Keep responsive containers inside render layers

Do not let functional or anchoring groups accidentally interleave render materials.

Prefer:

```text
TopBar
├── BackgroundImages
│   ├── LeftAnchor
│   ├── CenterAnchor
│   └── RightAnchor
├── ContentImages
│   ├── LeftAnchor
│   └── RightAnchor
├── TextContent
│   ├── CenterAnchor
│   └── RightAnchor
└── ForegroundDecoration
```

Avoid:

```text
TopBar
├── LeftSection
│   ├── Image
│   └── Text
├── CenterSection
│   ├── Image
│   └── Text
└── RightSection
    ├── Image
    └── Text
```

The second structure is convenient functionally but often produces repeated `Image -> Text -> Image -> Text` ordering. Use non-rendering `RectTransform` containers inside material-oriented render groups so anchors and Safe Area behavior remain responsive without fragmenting draw order.

### 7. Standardize atlases, fonts, materials, masks, and inactive screens

Apply these defaults:

- Place sprites that commonly appear together and need to batch in the same practical atlas group.
- Avoid one enormous atlas when it harms memory residency, loading, or content ownership.
- Use shared UI materials. Do not instantiate a material per element without a measured need.
- Standardize a small set of shared TMP font assets and material presets.
- Treat fallback fonts, inline sprites, emoji, outline variants, underlay variants, and different font atlases as potential extra batches.
- Prefer `RectMask2D` for simple rectangular clipping when its behavior meets the design need.
- Keep masks local to the smallest necessary region and avoid deep nested clipping.
- Disable an inactive screen, popup root, or Canvas when it should neither render nor update; do not rely only on alpha zero.
- Use pooling and virtualization for long scrolling lists.
- Reduce unnecessary transparent padding in sprites and oversized text bounds when overlap blocks batching or increases overdraw.

### 8. Produce an actionable architecture

Use this default response structure, adapting it to the available evidence:

1. **Assumptions and bottleneck hypothesis**
2. **Current hierarchy problems**
3. **Recommended Canvas architecture**
4. **Recommended module hierarchy**
5. **Before-and-after hierarchy examples**
6. **Why each change helps**
7. **Tradeoffs and cases where the change should not be used**
8. **Implementation sequence**
9. **Profiler validation checklist**
10. **Highest-priority actions**

For each recommendation, state:

- What to change
- Why it can reduce cost
- Which cost it targets
- What visual or architectural tradeoff it introduces
- How to verify it in Unity

Do not promise a fixed draw-call reduction without profiler evidence.

### 9. Verify instead of assuming

Recommend a repeatable measurement loop:

1. Capture a baseline on the target device and representative screen.
2. Record batches, SetPass calls where relevant, `Canvas.BuildBatch`, layout rebuild markers, vertices, and GPU time.
3. Inspect the UI Profiler batch-breaking reason and Frame Debugger event sequence.
4. Refactor one module or Canvas boundary at a time.
5. Re-run the same scenario with identical content and animation state.
6. Confirm visual ordering, Safe Area behavior, touch targets, orientation changes, and memory impact.
7. Keep changes only when the measured result or maintainability benefit justifies the tradeoff.

## Non-negotiable guidance

- Do not globally group every Image in the screen under one node and every Text under another when doing so destroys prefab ownership or required z-order.
- Do not split Canvases solely by component type.
- Do not create a Sub-Canvas per item as a default optimization.
- Do not recommend reordering elements through required visual overlap.
- Do not treat fewer draw calls as automatically better when overdraw, rebuild cost, memory, or maintainability becomes worse.
- Do not use opaque naming schemes. Prefer names such as `SafeAreaContent`, `StaticHud`, `DynamicHud`, `BackgroundImages`, `TextContent`, and `Overlay`.

## Detailed references

Read these files as needed:

- [Architecture guide](references/architecture-guide.md): batching model, Canvas splitting, Safe Area, render-layer patterns, atlases, text, masks, layout, and overdraw.
- [Diagnostic checklist](references/diagnostic-checklist.md): profiler workflow, batch-break matrix, and acceptance checks.
- [Example transformations](references/example-transformations.md): before-and-after hierarchy refactors for common game UI modules.
- [Official sources](references/sources.md): version-pinned Unity documentation for uGUI rendering, profiling, responsive layout, atlases, text, masks, and scrolling.
