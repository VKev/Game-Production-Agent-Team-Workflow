# Unity uGUI Hierarchy Architecture Guide

## Contents

1. Mental model
2. What can batch
3. Why hierarchy order matters
4. Recommended root architecture
5. Canvas splitting decisions
6. Recommended module architecture
7. Responsive layout and Safe Area
8. Sprite Atlas strategy
9. TextMeshPro strategy
10. Masks and scrolling
11. Layout rebuild control
12. Overdraw control
13. Naming conventions
14. Anti-patterns
15. Decision summary

## 1. Mental model

A well-optimized uGUI hierarchy must satisfy several constraints at the same time:

- Preserve the required front-to-back visual order.
- Keep compatible render states adjacent when overlap prevents reordering.
- Isolate frequently changing content from large stable Canvases.
- Keep responsive anchors and Safe Area behavior independent from rendering groups.
- Avoid excessive transparent layers and layout recalculation.
- Remain understandable and reusable as prefabs.

The hierarchy is therefore not only an organizational tree. Within a Canvas, it also contributes to draw order, batching opportunities, rebuild scope, masking state, raycast traversal, and maintainability.

## 2. What can batch

Graphics are most likely to batch when they share compatible state, including:

- The same Canvas and sorting context
- The same texture or atlas page
- The same shared material and shader variant
- The same clipping and stencil state
- Compatible transform geometry
- A render order that allows the graphics to remain adjacent

Common reasons for separate batches include:

- Sprite texture or atlas page changes
- Text font atlas changes
- Material instances instead of a shared material
- Different TMP material presets
- Mask or stencil changes
- Different rectangular clipping regions
- Sub-Canvas boundaries
- Special shaders and UI effects
- Inline TMP sprites or fallback font atlases
- Required overlap that prevents safe reordering

Sprite Atlas solves only the texture-switch part of the problem. It does not remove material, font, clipping, Canvas, or ordering constraints.

## 3. Why hierarchy order matters

Consider this visible order:

```text
PanelBackground      uses UI sprite atlas
PlayerName           uses TMP font atlas
Portrait             uses UI sprite atlas
LevelLabel           uses TMP font atlas
PortraitFrame        uses UI sprite atlas
```

When the elements overlap in a way that fixes their visual order, Unity may have to process a repeated state sequence:

```text
Sprite atlas -> font atlas -> sprite atlas -> font atlas -> sprite atlas
```

A better hierarchy can often reduce the sequence to:

```text
Background and content sprites -> text -> required foreground sprites
```

This does not mean every UI should have exactly two or three batches. The correct number depends on required layers, masks, materials, font atlases, effects, and Canvas boundaries. The goal is to remove accidental switches, not required ones.

Transparent bounds matter. A sprite or text quad can geometrically overlap another element even when the overlapping pixels appear transparent. Oversized `RectTransform` bounds, large TMP margins, outline padding, and transparent sprite padding can therefore restrict reordering.

## 4. Recommended root architecture

Use descriptive groups:

```text
UserInterfaceRoot
├── FullBleedBackground
│   ├── ScreenBackground
│   └── EdgeDecoration
├── SafeAreaContent
│   ├── StaticHud
│   ├── DynamicHud
│   └── ActiveScreen
└── Overlay
    ├── ScreenDimmer
    └── SafeAreaOverlayContent
        ├── Popups
        ├── Toasts
        └── Tutorials
```

### FullBleedBackground

Use for content allowed to extend behind a notch, camera cutout, or rounded screen corner. It normally contains non-interactive and relatively static visuals.

### SafeAreaContent

Use a non-rendering `RectTransform` controlled by a Safe Area component. Do not attach an `Image`, `Mask`, or other `Graphic` merely to create the container. Update its anchors only when the safe area, resolution, or orientation changes.

### StaticHud

Use for stable frames, decorative panels, fixed labels, and elements that rarely change. This can be a Sub-Canvas when separating it meaningfully reduces rebuild work.

### DynamicHud

Use for health, energy, progress, currency, scores, timers, cooldowns, notifications, and animated status content. Group elements that change at similar frequency.

### ActiveScreen

Keep the current menu, shop, inventory, event, settings, or other screen here. Disable or unload inactive screens rather than keeping every screen active with zero alpha.

### Overlay

Use for elements that require a dedicated top-level sorting domain: popups, full-screen blockers, loading, tutorials, drag visuals, and toasts. Separate full-bleed dimmers from safe-area-constrained popup content when necessary.

## 5. Canvas splitting decisions

A Sub-Canvas can isolate rebuild work, but it also creates a batching boundary and additional renderer state. Split only when the boundary has a clear purpose.

### Good reasons to split

- A small region changes every frame while a large surrounding region is static.
- A popup or drag layer needs independent sorting.
- A world-space UI element needs a separate Canvas mode.
- A scroll region has heavy independent geometry and measured rebuild cost.
- A module can be enabled or disabled as an independent rendering unit.

### Weak reasons to split

- The element is a button.
- The element has text.
- The object is a reusable prefab.
- A developer hopes that more Canvases automatically mean fewer draw calls.
- Every list item is given its own Canvas without profiling evidence.

### Split by update and sorting domains, not component type

Avoid this architecture:

```text
ImagesCanvas
TextsCanvas
ButtonsCanvas
IconsCanvas
```

It makes local z-order difficult, prevents batching across Canvas boundaries, and damages module ownership. Prefer a few screen-level or region-level Canvases with locally optimized module hierarchies.

## 6. Recommended module architecture

Use a descriptive render-layer pattern:

```text
ModuleName
├── BackgroundImages
├── ContentImages
├── TextContent
├── ForegroundDecoration
└── SpecialEffects
```

Only add groups that contain real objects.

### BackgroundImages

Examples:

- Panel backgrounds
- Static shadows
- Bar tracks
- Backplates
- Decorations that can stay behind all text

### ContentImages

Examples:

- Portraits
- Item icons
- Currency icons
- Progress fills
- Status icons
- Regular atlas sprites

### TextContent

Examples:

- Names
- Values
- Labels
- Timers
- Descriptions

Use shared TMP font assets and shared material presets whenever visual requirements permit.

### ForegroundDecoration

Examples:

- Portrait frames that cover the portrait edge
- Badges that must cover text or icons
- Corner overlays
- Foreground bar frames

This layer often requires a return from font rendering to sprite rendering. Keep only elements that truly require that order. Move or bake the rest.

### SpecialEffects

Examples:

- Additive shine
- Grayscale or dissolve
- Blur or distortion
- UI particles
- RenderTexture content
- Custom shader animation

Treat these as expected separate passes and keep them contiguous when possible.

## 7. Responsive layout and Safe Area

Responsive structure and render-order structure can coexist.

### Preferred pattern

Place anchor containers inside render layers:

```text
PlayerHeader
├── BackgroundImages
│   ├── LeftAnchor
│   ├── StretchingCenter
│   └── RightAnchor
├── ContentImages
│   ├── LeftAnchor
│   └── RightAnchor
├── TextContent
│   ├── CenterAnchor
│   └── RightAnchor
└── ForegroundDecoration
```

The anchor nodes are ordinary `RectTransform` containers with no `Graphic` component. They control position and scaling but do not introduce a new material sequence.

### Risky functional pattern

```text
PlayerHeader
├── PlayerSection
│   ├── PortraitImage
│   └── PlayerNameText
├── CurrencySection
│   ├── CurrencyImage
│   └── CurrencyText
└── SettingsSection
    ├── ButtonImage
    └── ButtonText
```

This can produce alternating sprite and font materials. It may still be correct when sections do not overlap or Unity can reorder them, but it should be verified rather than assumed.

### Safe Area behavior

- Let full-screen backgrounds remain outside `SafeAreaContent` when visually appropriate.
- Put readable and interactive content inside `SafeAreaContent`.
- Apply safe-area anchors only when values change, not every frame.
- Test portrait, landscape, cutouts, rounded corners, and navigation bars.
- Keep touch targets large enough after safe-area compression.

### CanvasScaler

Choose a reference resolution and width-height match policy based on the design. Use anchors for relative placement and avoid solving every resolution with per-device coordinates.

## 8. Sprite Atlas strategy

Group sprites by practical co-visibility and loading behavior.

Possible atlas groups:

```text
CommonInterfaceAtlas
HudAtlas
InventoryAtlas
ShopAtlas
LiveEventAtlas
```

Guidelines:

- Keep sprites that frequently render together in a compatible atlas when practical.
- Consider atlas page size and platform texture limits.
- Avoid combining unrelated screens into one permanently resident texture solely to chase a batch.
- Watch for variants, packing tags, runtime loading, and duplicated source textures.
- Trim transparent sprite padding when it increases overlap or overdraw.
- Verify actual atlas usage in a build, not only in the Editor.

## 9. TextMeshPro strategy

Text frequently introduces a different texture and material from UI sprites. Manage it deliberately.

Guidelines:

- Reuse shared TMP font assets.
- Reuse shared material presets instead of creating per-label instances.
- Standardize outline, underlay, glow, and face settings.
- Be aware that fallback font assets can introduce additional atlas textures.
- Be aware that inline sprites and emoji can add material or texture passes.
- Avoid frequent text changes when a less expensive visual representation is possible.
- Update text only when the displayed value changes.
- Constrain text bounds to the actual design region where possible.
- Test localization, because longer strings can change overlap, layout, atlas use, and rebuild frequency.

## 10. Masks and scrolling

### Rectangular clipping

Use `RectMask2D` for rectangular clipping when it meets the visual requirement. It generally avoids stencil-based masking, but clipping regions can still affect batching and must be profiled.

### Stencil masks

Use `Mask` when the shape requires an image-based stencil. Expect additional material or stencil state and keep the masked region small.

### ScrollRect

- Pool and recycle visible cells.
- Avoid keeping thousands of active item graphics.
- Keep clipping local to the viewport.
- Avoid nested scroll views and nested masks unless required.
- Minimize expensive layout recalculation while scrolling.
- Do not assign a Sub-Canvas to every cell by default.

## 11. Layout rebuild control

Automatic layout improves authoring but can become expensive when deeply nested or frequently dirtied.

Watch for combinations such as:

- Nested `HorizontalLayoutGroup` and `VerticalLayoutGroup`
- `ContentSizeFitter` under another fitting or layout component
- Frequently changing preferred sizes
- Text changes that propagate through many parent layout groups
- Enabling and disabling many layout children every frame

Recommendations:

- Use anchors and explicit `RectTransform` values for stable HUD layouts.
- Use automatic layout where content truly requires it.
- Rebuild only when data or dimensions change.
- Cache component references and avoid repeated hierarchy searches.
- Consider calculating a stable layout once, then disabling the layout controller when appropriate.
- Profile layout markers separately from Canvas batching markers.

## 12. Overdraw control

A low draw-call count does not guarantee a fast UI. Transparent graphics can repeatedly shade the same pixels.

Common overdraw sources:

- Full-screen backgrounds layered under full-screen gradients and dimmers
- Large transparent sprites with small visible regions
- Multiple shadows and glows
- Popup dimmers that remain active behind other full-screen effects
- Hidden screens left active with alpha zero
- Particles and additive effects covering large regions

Recommendations:

- Remove invisible or fully covered graphics.
- Bake stable decoration when memory and reuse tradeoffs are acceptable.
- Reduce transparent padding.
- Disable obscured full-screen screens when a modal completely covers them and the design permits it.
- Use platform GPU profiling or overdraw visualization on representative devices.

## 13. Naming conventions

Use names that communicate purpose immediately:

- `UserInterfaceRoot`
- `FullBleedBackground`
- `SafeAreaContent`
- `StaticHud`
- `DynamicHud`
- `ActiveScreen`
- `Overlay`
- `BackgroundImages`
- `ContentImages`
- `TextContent`
- `ForegroundDecoration`
- `SpecialEffects`
- `LeftAnchor`, `CenterAnchor`, `RightAnchor`
- `ScrollViewport`, `VisibleItemPool`

Avoid:

- Numeric layer IDs
- Sorting-order numbers embedded in names
- Single-letter prefixes
- Generic names such as `Group`, `Container2`, or `New Game Object`
- Names that describe only the component type when the role is more useful

## 14. Anti-patterns

### Alternating materials by functional section

```text
SectionA: Image, Text
SectionB: Image, Text
SectionC: Image, Text
```

Refactor material-oriented render layers inside the module when overlap and profiling show repeated switches.

### Canvas per element

This increases Canvas boundaries, components, sorting complexity, and management overhead. Use only for a measured independent-update or sorting need.

### Global Image and Text buckets

A screen-wide `AllImages` and `AllText` architecture can break prefab encapsulation and required local z-order. Optimize within meaningful modules and Canvas regions.

### Alpha-zero hiding

A zero-alpha group can remain active in layout, raycasting, animation, and rebuild systems. Disable the appropriate root, Canvas, or systems when the screen is inactive.

### Blind baking

Baking many elements into huge textures can reduce flexibility, localization support, memory efficiency, and reuse. Bake only stable decoration after measuring.

### Draw-call tunnel vision

Do not accept more overdraw, memory usage, rebuild work, or unreadable hierarchy merely to remove one batch.

## 15. Decision summary

Use this order of decisions:

1. Preserve required visual order and interaction.
2. Separate stable and frequently dirty regions when profiling supports it.
3. Keep compatible render states contiguous inside each region.
4. Put responsive non-rendering containers inside render layers.
5. Share atlases, fonts, and materials intentionally.
6. Localize masks and special effects.
7. Reduce layout rebuilds and overdraw.
8. Measure the target device before and after every meaningful change.
