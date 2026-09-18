---
name: dev-cocos-performance
description: Diagnose and fix Cocos Creator 3.8 runtime performance and memory problems with evidence — draw calls and batching, node and component cost, object pooling, tween and update discipline, texture and atlas memory, asset release, and mini-game package and memory ceilings. Use when frame rate drops, memory grows, a mini-game crashes on low-end devices, or before claiming an optimization worked.
---

# Cocos performance and memory

## Measure first

Never optimize from intuition. In order:

1. Reproduce on the **build**, on a target device or the platform simulator — editor preview has different costs.
2. Read the stats overlay (draw calls, frame time) and `get_performance_snapshot` from the Cocos MCP.
3. Form one hypothesis, change one thing, measure the same way again.
4. Record the before/after numbers together with the command that produced them. A number without its method is not evidence.

## The usual causes, in the order they usually bite

| Symptom | Likely cause | Fix |
|---|---|---|
| High draw calls in UI | batching broken by interleaved textures, different materials, or a node between batched siblings | group by atlas, keep the same material, avoid mixing `Label` and `Sprite` layers unnecessarily |
| Frame spikes when spawning | `instantiate` per shot/enemy/effect | pool nodes and reuse; reset state on take, not on release-and-hope |
| Steady frame drop over a session | listeners or tweens never removed | `off` in `onDisable`/`onDestroy`; `Tween.stopAllByTarget(node)` before reusing a pooled node |
| `update` cost scaling with entity count | per-entity `update` methods | one system iterating an array beats N component updates |
| Memory climbs between screens | loaded assets never released, or a pool holding destroyed nodes | release bundles/assets on screen close; clear pools with the screen |
| Crash on low-end mini-game device | texture memory, not code | shrink atlases, lower texture compression targets, move rarely used assets into a subpackage |

## Pooling

- Pool what is created repeatedly at runtime: bullets, enemies, damage numbers, effects, list items.
- A pooled node must be reset deterministically on acquisition: position, scale, opacity (`UIOpacity`), active state, running tweens, and any component state. "It was clean when released" is how a stale value survives.
- Do not pool what is created a handful of times; a pool has its own cost and its own bugs.

## Tweens, timers, and updates

- `tween()` targets survive the node they animate if never stopped; stop by target when a node is released or destroyed.
- Prefer `scheduleOnce`/`schedule` with explicit cancellation over ad-hoc `update` counters.
- Use `deltaTime`, never a frame count, for anything the player perceives as speed.

## Mini-game budgets

- Main package ≤ 4 MB (Douyin/WeChat), subpackages up to 20 MB — these are hard platform ceilings, not guidelines.
- Measure package size with actual file sizes, not `du -sh`: 4 KB block rounding inflates the number against a hard limit.
- Texture memory, not script size, is the usual ceiling on device.
- The Douyin main package is slightly heavier than the WeChat one for the same project because of the platform adapter; budget for the target you actually ship.

## Boundaries

- Never present an optimization as verified without before/after numbers from the same method on the build.
- Never trade correctness for frame rate silently; if a fix changes behavior, say so and get a decision.
- Never introduce a pool, a cache, or a custom scheduler without a measurement showing the cost it removes.
- Never micro-optimize TypeScript that runs a handful of times per frame; look at draw calls, allocation, and asset memory first.
- Never measure in the editor and report it as device performance.
