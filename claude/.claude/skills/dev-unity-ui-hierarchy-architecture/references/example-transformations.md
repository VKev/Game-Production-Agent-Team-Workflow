# Example Unity uGUI Hierarchy Transformations

## Contents

1. Player status panel
2. Inventory item card
3. Top bar with responsive anchors
4. Popup and dimmer
5. Scrollable inventory
6. Static and dynamic HUD split
7. Cases where an extra batch is correct

## 1. Player status panel

### Before

```text
PlayerStatus
├── BackgroundImage
├── PlayerNameText
├── PortraitImage
├── LevelText
├── HealthBarBackground
├── HealthValueText
└── PortraitFrameImage
```

Potential state sequence:

```text
sprite -> font -> sprite -> font -> sprite -> font -> sprite
```

### After

```text
PlayerStatus
├── BackgroundImages
│   ├── BackgroundImage
│   └── HealthBarBackground
├── ContentImages
│   └── PortraitImage
├── TextContent
│   ├── PlayerNameText
│   ├── LevelText
│   └── HealthValueText
└── ForegroundDecoration
    └── PortraitFrameImage
```

### Benefit

Compatible sprite graphics are adjacent before text. Only the frame remains after text because it must cover the portrait edge. This can remove accidental sprite-font switching while preserving the visual result.

### Tradeoff

The hierarchy is organized by rendering responsibility rather than by a single functional subtree for the portrait. Use component references or a view script to preserve convenient access to related objects.

## 2. Inventory item card

### Before

```text
InventoryItem
├── CardBackground
├── ItemIcon
├── ItemName
├── RarityFrame
├── QuantityText
├── SelectedOverlay
└── LockIcon
```

### After

```text
InventoryItem
├── BackgroundImages
│   ├── CardBackground
│   └── SelectedOverlay
├── ContentImages
│   ├── ItemIcon
│   └── LockIcon
├── TextContent
│   ├── ItemName
│   └── QuantityText
└── ForegroundDecoration
    └── RarityFrame
```

### Additional decisions

- Move `SelectedOverlay` to `ForegroundDecoration` only when it must cover text.
- Bake a static rarity corner into the card art only when localization, recoloring, and reuse are unaffected.
- Keep shared item fonts and material presets across all visible cells.
- Pool visible items instead of keeping the full inventory active.

## 3. Top bar with responsive anchors

### Before

```text
TopBar
├── PlayerSection
│   ├── AvatarImage
│   └── PlayerNameText
├── CurrencySection
│   ├── CurrencyIcon
│   └── CurrencyValueText
└── MenuSection
    ├── MenuButtonImage
    └── MenuButtonText
```

This functional grouping may alternate sprite and font materials.

### After

```text
TopBar
├── BackgroundImages
│   ├── LeftAnchor
│   │   └── PlayerBackplate
│   ├── RightAnchor
│   │   └── CurrencyBackplate
│   └── FarRightAnchor
│       └── MenuButtonBackground
├── ContentImages
│   ├── LeftAnchor
│   │   └── AvatarImage
│   └── RightAnchor
│       └── CurrencyIcon
├── TextContent
│   ├── LeftAnchor
│   │   └── PlayerNameText
│   ├── RightAnchor
│   │   └── CurrencyValueText
│   └── FarRightAnchor
│       └── MenuButtonText
└── ForegroundDecoration
    └── AvatarFrame
```

### Benefit

Anchoring stays responsive, but non-rendering anchor nodes are placed inside render groups. This avoids using layout organization as the accidental draw-order organization.

## 4. Popup and dimmer

### Before

```text
MainCanvas
├── MainScreen
├── PopupDimmer
├── PopupPanel
├── PopupTitle
├── PopupDecoration
└── MainScreenElementsThatStillAnimate
```

### After

```text
UserInterfaceRoot
├── SafeAreaContent
│   └── ActiveScreen
└── Overlay
    ├── FullScreenDimmer
    └── SafeAreaOverlayContent
        └── ConfirmationPopup
            ├── BackgroundImages
            ├── ContentImages
            ├── TextContent
            └── ForegroundDecoration
```

### Benefit

The popup has a clear sorting domain. The dimmer can remain full bleed while the popup respects the Safe Area. Main-screen animation can be paused when the modal fully blocks interaction and presentation.

### Tradeoff

The overlay Canvas is a batching boundary. It is justified by independent sorting and enable-disable behavior, not by an assumption that more Canvases reduce draw calls.

## 5. Scrollable inventory

### Before

```text
InventoryScreen
└── ScrollView
    └── Content
        ├── ItemCanvas
        ├── ItemCanvas
        ├── ItemCanvas
        ├── hundreds of more ItemCanvas objects
        └── ...
```

### After

```text
InventoryScreen
└── InventoryScroll
    ├── ScrollViewport
    │   └── VisibleItemPool
    │       ├── InventoryItem
    │       ├── InventoryItem
    │       └── BufferedInventoryItem
    └── Scrollbar
```

Each `InventoryItem` uses the module render-layer pattern but does not receive a Canvas by default.

### Benefit

The number of active graphics remains bounded. Canvas and layout overhead does not grow linearly with the entire data set.

## 6. Static and dynamic HUD split

### Before

```text
HudCanvas
├── DecorativeFrame
├── PlayerPortrait
├── PlayerName
├── HealthBar
├── HealthValue
├── Timer
├── Score
└── StaticCornerDecoration
```

Every timer or health change can dirty a Canvas that also owns all static decoration.

### After

```text
SafeAreaContent
├── StaticHud
│   ├── DecorativeFrame
│   └── StaticCornerDecoration
└── DynamicHud
    ├── PlayerStatus
    │   ├── ContentImages
    │   └── TextContent
    ├── MatchTimer
    └── ScoreDisplay
```

### Benefit

Frequently changing elements can rebuild independently from stable decoration.

### Tradeoff

`StaticHud` and `DynamicHud` cannot batch with each other across the Canvas boundary. Keep the split only when CPU rebuild savings outweigh the extra boundary and complexity.

## 7. Cases where an extra batch is correct

Do not force batching when it breaks the design or creates a worse bottleneck.

Examples:

- A portrait frame must visibly cover both the portrait and part of a label.
- A grayscale disabled-state shader is required for only some icons.
- A stencil mask is required for a non-rectangular reveal.
- A live camera or character preview uses a RenderTexture.
- A popup must sort over every other screen and be independently enabled.
- A localized string needs a fallback font atlas.

In these cases, keep the required batch and optimize surrounding accidental switches instead.
