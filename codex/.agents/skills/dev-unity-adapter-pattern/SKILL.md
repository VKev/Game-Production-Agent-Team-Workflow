---
name: dev-unity-adapter-pattern
description: Design, implement, review, refactor, and test Adapter pattern solutions in Unity C#. Use when a third-party package, legacy subsystem, platform API, physics/input/audio/save provider, or incompatible interface must satisfy an existing game-facing contract; for object adapters, wrappers, anti-corruption boundaries, unit or coordinate conversion; and when comparing Adapter with Facade, Proxy, Bridge, Strategy, or direct integration.
---

# Unity Adapter Pattern

Use Adapter to translate an existing incompatible interface into the target contract expected by client code.

## Compare Before Selecting

State each option’s benefit, drawback, prerequisite, rejection condition, and valid combinations. Use any justified combination or none; never force primary/supporting ranks.

Compare direct integration, an object adapter, Facade, Proxy, Bridge, Strategy, a provider interface, and an anti-corruption boundary.

## Define Both Sides

1. Write the target contract clients already need.
2. Inventory the adaptee’s operations, data, lifecycle, and failure semantics.
3. Map names, units, coordinate spaces, sync/async behavior, errors, ownership, and threading.
4. Identify capabilities that cannot be represented without weakening the target contract.

Benefit: isolate vendor or legacy incompatibility and preserve stable client code. Drawbacks: translation code, semantic mismatch, lowest-common-denominator APIs, lifecycle bridging, and another test surface.

Reject Adapter when direct use is already clear, the target contract would lie about semantics, or consumers genuinely need the provider’s unique capabilities.

## Prefer Composition

- Wrap the adaptee and implement the target interface.
- Avoid subclassing Unity native components or third-party types merely to rename methods.
- Keep vendor-specific types behind the boundary.
- Translate units and coordinate systems in one place.
- Preserve cancellation, disposal, callbacks, and error information.
- Expose unsupported operations explicitly instead of silently approximating them.
- Keep the adapter thin; domain policy belongs outside unless the boundary intentionally owns it.

## Distinguish Similar Patterns

- Adapter changes an interface to fit clients.
- Facade offers a simpler entry point to a larger subsystem.
- Proxy preserves the subject contract while controlling access.
- Bridge is designed up front so abstraction and implementation vary independently.
- Strategy selects interchangeable behavior behind an already suitable contract.

An Adapter can sit behind a Facade or be selected by a Bridge, but each added layer must solve a distinct problem.

## Verify

- Build contract tests shared by the original and adapted implementations where meaningful.
- Test unit/axis/time conversion boundaries and round trips.
- Test provider errors, cancellation, unavailable capabilities, teardown, and callbacks after disposal.
- Confirm no provider type leaks into client-facing APIs.
- Swap the provider in a representative scene without rewriting consumers.

Read [references/adapter-guide.md](references/adapter-guide.md) for mapping risks, video context, and sources.
