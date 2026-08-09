# Official Sources

Confirm `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, and `Packages/packages-lock.json` before relying on version-sensitive behavior. The Unity engine links below target 2022.3, and the TextMeshPro link targets package 3.0.

## Rendering and measurement

- [Unity UI package](https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.ugui.html): uGUI package scope and version information.
- [Canvas](https://docs.unity3d.com/2022.3/Documentation/Manual/class-Canvas.html): render modes, sorting, and the root space for UI elements.
- [UI and UI Details Profiler](https://docs.unity3d.com/2022.3/Documentation/Manual/ProfilerUI.html): batches, vertices, layout/render cost, batch-breaking reasons, and overdraw previews.
- [Frame Debugger](https://docs.unity3d.com/2022.3/Documentation/Manual/FrameDebugger.html): inspect draw-event order, materials, textures, shaders, and render targets.

## Responsive hierarchy and layout

- [Canvas Scaler](https://docs.unity3d.com/2022.3/Documentation/Manual/script-CanvasScaler.html): reference resolution and screen-size scaling modes.
- [Screen.safeArea](https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Screen-safeArea.html): the visible safe rectangle for cutouts, rounded displays, and overscan.
- [Auto Layout](https://docs.unity3d.com/2022.3/Documentation/Manual/UIAutoLayout.html): layout elements, controllers, groups, and driven `RectTransform` properties.

## Atlases and text

- [Sprite Atlas](https://docs.unity3d.com/2022.3/Documentation/Manual/sprite-atlas.html): texture packing, draw-call motivation, loading, and atlas workflow.
- [TextMeshPro 3.0](https://docs.unity3d.com/Packages/com.unity.textmeshpro@3.0/manual/index.html): TMP UGUI components, font assets, materials, and package-specific behavior.

## Masks and scrolling

- [Mask](https://docs.unity3d.com/2022.3/Documentation/Manual/script-Mask.html): image-based masking behavior.
- [RectMask2D](https://docs.unity3d.com/2022.3/Documentation/Manual/script-RectMask2D.html): rectangular clipping constraints and performance characteristics.
- [Scroll Rect](https://docs.unity3d.com/2022.3/Documentation/Manual/script-ScrollRect.html): viewport, content, movement, scrollbars, and masking setup.
