# Responsive UI verification matrix

## Screen matrix

Replace unsupported rows with the actual product bounds; do not silently omit an extreme.

| Case | Examples | Required observations |
|---|---|---|
| Reference | authored resolution, such as 1920x1080 | no regression in composition, spacing, text, and interaction |
| Narrow landscape | 4:3 or the narrowest supported window | no horizontal clipping; center content remains usable |
| Wide landscape | 20:9, 21:9, or widest supported window | background covers; new side space is intentional; controls do not drift |
| Tablet | common 4:3 or device-specific ratio | bounded panels and split regions remain balanced |
| Portrait | narrow, tall, and supported phone/tablet portrait ratios | layout uses the approved portrait composition rather than accidental squeezing |
| Cutout | left, right, top, and asymmetric simulated cutouts | required text and controls remain inside `Screen.safeArea` |
| No cutout | rectangular display | Safe Area collapses cleanly to the full screen with no artificial margin |
| Runtime resize/rotate | change dimensions while the screen is visible | Safe Area and layout refresh without reopening the view |

## Content matrix

Test each representative screen with:

- empty, minimum, typical, and maximum list/grid/data counts;
- shortest and longest supported localized strings;
- multiline labels, large numbers, and missing/fallback glyphs;
- hidden, disabled, selected, pressed, loading, error, and confirmation states;
- open keyboard or platform overlays when the product supports text input;
- popup above the most complex underlying screen.

## Acceptance checks

### Geometry

- Full-bleed layers cover the screen without unintended bars.
- Cropping is intentional and preserves important art regions.
- Safe content remains within the current safe rectangle.
- No required content clips, overlaps, leaves the viewport, or becomes too small.
- Stretch regions use meaningful offsets; proportional splits preserve their intended gutters.
- Aspect-constrained modules remain undistorted.
- Scroll content exposes every required item and does not resize the viewport unexpectedly.

### Text and input

- Long translations wrap, resize, or scroll according to an explicit rule.
- Minimum readable text size is respected.
- Touch targets retain the product's minimum size and do not overlap unsafe regions.
- Decorative graphics do not intercept pointer/touch input.
- Navigation order and focus remain usable after layout changes.

### Runtime behavior

- Safe Area updates after rotation, resolution change, and focus return.
- Layout does not visibly oscillate or rebuild in a feedback loop.
- Dynamic additions and removals settle to the correct layout.
- Console remains free of new errors and relevant warnings.

## Evidence levels

Report each independently:

| Evidence | What it proves | What it does not prove |
|---|---|---|
| Serialized prefab/scene inspection | authored scaler, anchors, components, and flags | runtime appearance or device-specific system behavior |
| Compilation | scripts and assemblies compile | visual composition, input correctness, or Safe Area behavior |
| EditMode/PlayMode tests | covered programmed invariants | unasserted visual quality and human usability |
| Game view / Device Simulator screenshots | observed composition for named configurations | every real device or interaction path |
| Physical-device run | actual platform/system-bar behavior for that device | all devices and all content states |
| Human visual/playtest review | readability and usability in reviewed scenarios | untested screens, devices, and states |

Store before/after screenshots with the device, resolution, orientation, Safe Area, locale, and content state named. A generic “looks responsive” statement is not verification.
