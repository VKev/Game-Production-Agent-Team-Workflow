---
name: dev-unity-stats-modifiers
description: Design, implement, review, debug, and test Unity stat and modifier systems. Use for base, current, and derived stats; buffs, debuffs, equipment, pickups, auras, and status effects; additive, percentage, multiplicative, override, min/max, and clamp ordering; stacking and refresh policies; priorities and deterministic evaluation; timed expiry and removal handles; broker-chain, mediator, multicast-event, direct-list, or cached computation models; ScriptableObject base data; change notifications; persistence; and decisions involving Strategy, State, events, PlayerLoop ticking, collections, pooling, VContainer, or profiling. Compare all materially relevant skills and models by benefit, drawback, prerequisites, overlap, and rejection condition; use any useful combination or none. Do not trigger for a single field with no modifier lifecycle or stacking requirement.
---

# Unity Stats and Modifiers

Build a stat system from explicit numerical and lifetime semantics. Treat the broker chain as one optional implementation, not the definition of a stat system.

Read [references/unity-stats-modifiers-guide.md](references/unity-stats-modifiers-guide.md) for model comparisons, stacking policies, broker-chain analysis, implementation shapes, failure modes, tests, and the tutorial evidence base.

## Start with a comparative decision

Before choosing an implementation:

1. State the required stat behaviors, expected scale, authoring workflow, read frequency, and lifetime sources.
2. Compare every materially relevant model and available skill. Record each candidate's benefit, drawback or added complexity, prerequisites, overlap or conflict, and rejection condition.
3. Do not impose primary/supporting ranks or a one-skill limit. Use one skill, several complementary skills, a sequence for different phases, or no specialist skill.
4. State the chosen model's concrete benefit, largest cost, and the evidence that would make a simpler model preferable.
5. Re-evaluate after the stacking formula and lifetime rules are known. These facts often change the correct data structure and integration skills.

Reject a broker/event chain when a direct ordered loop is clearer. Reject a generalized stat framework when the feature has only a few fixed values and no meaningful modifier behavior.

## Define semantics before classes

Write down all applicable rules before implementing:

- numeric type and valid range;
- base, current resource, derived, and effective-value meanings;
- phase order for flat, percent, multiplicative, override, min/max, and clamp operations;
- priority and tie-break rules within a phase;
- rounding, overflow, NaN, and infinity policy;
- stacking by source, effect ID, group, or tag;
- replace, refresh duration, add duration, add magnitude, max-stack, and unique policies;
- duration clock, pause behavior, expiry boundary, and permanent-effect representation;
- source ownership and manual removal behavior;
- recompute-on-read, cached-dirty, or mutation-time calculation;
- change notification and persistence requirements.

Never let collection order, event subscription order, or prefab discovery order become accidental gameplay math.

## Compare implementation models

### Direct value or formula

Use direct fields and formulas for fixed local rules. Benefit: minimal code and transparent debugging. Drawback: poor independent extensibility. Reject only when modifiers genuinely vary or have lifetimes.

### Ordered modifier collection

Keep runtime modifier records in one collection and evaluate them through explicit phases and priorities. Benefit: deterministic and easy to inspect. Drawback: each read can be O(modifier count). This is the default baseline to beat.

### Broker-chain or event query

Broadcast a mutable query to registered handlers when late-bound registration is the actual requirement. Benefit: modifiers attach and detach without the stat façade knowing their concrete types. Drawbacks: hidden invocation order, duplicate event/list bookkeeping, synchronous exception behavior, and harder debugging. Define order and failure policy explicitly or use a direct loop.

### Cached effective values

Recompute only when base data or modifiers change. Benefit: cheap repeated reads and UI polling. Drawback: dirty-state invalidation and dependency tracking can become complex. Reject when reads are infrequent or modifiers depend continuously on runtime context.

### ScriptableObject definitions

Use assets for shared authored definitions, icons, tags, magnitudes, or formulas when designer workflow matters. Keep active instances, stacks, sources, remaining time, and owner-specific state outside the shared asset.

## Route by the material concern

- Use this skill for stat math, modifier stacking, source ownership, duration, removal, and effective-value contracts.
- Compare `dev-unity-gameplay-architecture` when feature boundaries, mediator ownership, event topology, or entity lifetime are undecided.
- Compare `dev-unity-strategy-pattern` when modifier operations or formulas are genuinely interchangeable behaviors rather than structured data.
- Compare `dev-unity-csharp-collections-queries` when storage, iteration, allocation, lookup, or ZLinq mechanics materially affect the design.
- Compare `dev-unity-player-loop-systems` when many timed modifiers need centralized ticking or custom loop ownership.
- Compare `dev-unity-async-coroutines-unitask` when duration, cancellation, or server operations are genuinely asynchronous.
- Compare `dev-unity-save-load-persistence` when active effects, remaining durations, stable IDs, or offline progression must survive sessions.
- Compare `dev-unity-object-pooling` only when profiling or scale justifies reusing modifier or presentation instances.
- Compare `dev-unity-vcontainer` when composition and lifetime registration materially determine how services are supplied.
- Compare `dev-unity-performance-profiling` before replacing a clear model for a claimed performance problem.
- Compare UI, audio, Feel, DOTween, or pickup-related skills only when those separate presentation or interaction concerns are in acceptance.

Do not add Visitor, Strategy, Builder, DI, pooling, events, or PlayerLoop integration merely because the tutorial or another pattern uses them.

## Make evaluation deterministic

1. Give each modifier an explicit phase and priority, or aggregate each operation type separately.
2. Use a stable tie-breaker such as insertion sequence or stable effect ID.
3. Document whether percentages apply to base value, subtotal, or current effective value.
4. Apply final bounds and rounding exactly once unless the game design says otherwise.
5. Use the same evaluator for gameplay, UI previews, tests, and server-authoritative calculations where applicable.
6. Do not encode meaningful operation semantics only inside anonymous delegates if modifiers must serialize, persist, compare, or display explanations.

## Own lifetime explicitly

- Let registration return a stable handle or token that removes that exact active instance.
- Make removal and `Dispose` idempotent; repeated calls must not fire cleanup twice.
- Store source/effect identity so unequipping one item removes only its own modifier.
- Defer collection mutation while evaluating or ticking unless the chosen iteration explicitly supports safe removal.
- Unsubscribe the exact delegate that was registered.
- Decide whether expiry happens before or after evaluation at the boundary frame.
- Pass an explicit clock or delta into pure runtime logic when tests, pause modes, or server time matter.
- Represent permanence explicitly; avoid unexplained magic durations such as `-1` when an enum or nullable duration is clearer.

## Keep Unity data safe

- Treat ScriptableObject base stats and modifier definitions as shared authored configuration.
- Create per-entity runtime state rather than mutating shared assets in Play Mode.
- Keep modifier evaluation on the owning thread; Unity object access belongs on the main thread unless a proven job-safe data path exists.
- Publish stat-change notifications after a coherent mutation, not once per internal arithmetic step.
- Separate gameplay modifier state from buff icons, audio, particles, and pickup destruction.
- Do not serialize delegates, transient handles, linked-list nodes, or direct scene-object references as durable save data.

## Implement incrementally

1. Preserve the current numerical result with characterization tests.
2. Implement a pure evaluator for one stat and one modifier phase.
3. Add explicit ordering and one stacking policy.
4. Add exact-source registration and idempotent removal.
5. Add duration only if the feature requires it.
6. Add asset authoring, caching, notifications, persistence, or specialized collections only when separately justified.
7. Re-evaluate the selected skills and implementation after the first complete path works.

## Verify

- Compile the actual Unity project and audit relevant Console output.
- Test each operation phase, priority, tie-break, rounding, clamp, and overflow rule.
- Test every stack policy and duplicate-source case.
- Test expiry at zero, large delta, pause, refresh, manual removal, and repeated removal.
- Test mixed add/multiply order with values that produce visibly different results when reordered.
- Test multiple entities sharing one ScriptableObject definition for state leakage.
- Test event unsubscription, exception policy, reentrancy, and mutation during evaluation when events are used.
- Test save/load restoration only when persistence is required.
- Profile representative modifier counts and read/tick frequency before claiming an optimization.

## Report the decision

Summarize the semantics, models and skills considered, selected combination or reason for using none, benefits and drawbacks, rejection/rollback condition, ownership and lifetime rules, numerical order, and verification performed or pending.
