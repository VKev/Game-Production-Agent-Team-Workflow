---
name: dev-cocos-ui-layout
description: Build and debug Cocos Creator 3.8 UI — Canvas and design resolution, fitWidth/fitHeight, UITransform sizing, Widget alignment, Layout and ScrollView, safe areas and notches, label sizing, and per-screen resolution overrides. Use when adding or fixing a screen, when a layout differs between devices or between preview and build, or when UI elements overlap, stretch, or leave the visible area.
---

# Cocos UI and layout

## The scaling model

`Canvas` + `ResolutionPolicy` decide what "one unit" means on a device:

- `designResolution` is authored in project settings; `fitWidth` / `fitHeight` decide which axis is preserved.
- With `fitWidth = true, fitHeight = false`, the visible height varies by device. A visible size that differs from the design size (for example `720×1193` against a `720×1280` design) is expected, not a bug.
- A project may override `designResolution` **per screen**; never assume the project-wide value applies to the screen you are editing without checking.

Sizing lives on `UITransform`, not on the node: `node.getComponent(UITransform).setContentSize(w, h)`. Cocos 2.x `node.width/height` does not exist in 3.x.

## Alignment and layout components

| Need | Component | Trap |
|---|---|---|
| Stick to an edge, fill the parent | `Widget` | `Widget` recalculates on enable; changing `UITransform` afterwards is overwritten. Set `alignMode` deliberately. |
| Row/column/grid of children | `Layout` | Layout owns child positions; setting a child position by hand is silently reverted |
| Scrolling content | `ScrollView` + content `UITransform` | Content size must be driven by `Layout`/`ContentSizeFitter`-style logic, or scrolling stops at the wrong point |
| Text that grows | `Label` | `overflow` and `enableWrapText` change measurement; a shrink-to-fit label with a fixed `UITransform` will not shrink |
| Notch/home-indicator area | `sys.getSafeAreaRect()` / safe-area node | Mini-game hosts reserve UI space; anchoring to the screen edge puts controls under the platform's own chrome |

## Building a screen

1. Start from the project's screen structure (an existing screen prefab), so the Canvas, safe-area node, and layer conventions match.
2. Build the node tree through the editor or the Cocos MCP tools (`create_canvas`, `create_label`, `create_sprite`, `create_button`, `set_node_transform`) — never by writing scene JSON.
3. Wire buttons with `bind_button_click_event`, not by hand-editing `clickEvents`; a handler serialized under the wrong type name leaves the button lit, tappable, and inert.
4. Keep a cloning template node `active = false`, or it renders as a real item.
5. Verify visually with `capture_scene_screenshot` / `capture_preview_screenshot`, and verify the structure with `validate_scene`.

## Why it looks different in the build

- Preview renders the **open** scene; the build starts from the start scene. A screen that works in preview may never be reached in the build.
- Font fallbacks differ between the editor and mini-game hosts; a label that fits in preview can wrap on device.
- `UIOpacity` is required for fades in 3.x — a ported `node.opacity` assignment silently does nothing, so an element that should fade in stays invisible or fully opaque.
- Draw order is explicit in 3.x. A screen that relied on 2.x `zIndex` needs its ordering rebuilt, and a change there affects every screen that shares the convention.

## Boundaries

- Never fix a layout by hand-editing `.scene`/`.prefab` JSON.
- Never set a child's position when a `Layout` owns it; change the layout parameters instead.
- Never anchor interactive controls to the raw screen edge on mobile; use the safe area.
- Never treat a node's authored `width`/`height` as decoration — code frequently reads `contentSize` as data.
- Never rename a node to "clean up" a hierarchy without checking for `getChildByName` lookups and display-string reuse.
- Never claim a UI change is done from code alone; attach or describe a screenshot at the target resolution.


## Traps paid for on a real port

- **`Widget.AlignMode` is a different enum in 2.x and 3.8.**
  2.x `ONCE=0, ON_WINDOW_RESIZE=1, ALWAYS=2`; 3.8 `ONCE=0, ALWAYS=1,
  ON_WINDOW_RESIZE=2`. Copying the raw number out of a 2.x asset inverts the
  meaning. Map explicitly `{0:0, 1:2, 2:1}`.
- **3.8 does not re-align a Widget when a node is instantiated at runtime.** 2.4
  did. A prefab authored at the Canvas position and relying on its Widget to pull
  it back to the origin stays where it was — measured: local `(375,667)` became
  world `(750,1334)`, i.e. the top-right corner. For a root whose Widget stretches
  (`alignFlags = 45`, zero insets) the position that is correct *without* a
  re-align is `(0,0,0)`.
- **Safe area: check the original before calling it a port bug.** A 2.x project
  that ships a `MobileAdapter` writing `--safe-top` from `env(safe-area-inset-*)`
  usually does **nothing**: it bails out when there is no real DOM (every
  mini-game runtime), and nothing reads the CSS variables. So the notch is
  unhandled in *both* versions — that is a product decision to raise, not a
  regression to fix.
  If you do add it: put the component on the **container** and add the inset to
  `Widget.top` of the TOP-aligned children. Putting engine `cc.SafeArea` on the
  root resizes the whole container and drags the gameplay area down with it. Read
  `sys.getSafeAreaRect()` (already in design coordinates), not `screen.safeArea`
  (physical pixels), and re-apply on `window-resize` / `orientation-change` while
  remembering what you already added so it does not accumulate.

Full write-up: `dev-cocos-migrate-2x-to-3x/references/pitfalls.md` §24, §25, §37.
