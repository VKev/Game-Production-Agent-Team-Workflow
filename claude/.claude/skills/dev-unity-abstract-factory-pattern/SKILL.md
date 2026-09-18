---
name: dev-unity-abstract-factory-pattern
description: Design, implement, review, refactor, and test Abstract Factory solutions in Unity C#. Use when one selected theme, platform, faction, accessibility mode, rendering backend, or ruleset must create several mutually compatible product kinds; for factories of related prefab or service families; and when comparing Abstract Factory with Factory Method, a simple factory, ScriptableObject catalogs, prefab variants, Builder, Strategy, or VContainer.
---

# Unity Abstract Factory Pattern

Use Abstract Factory to create a coherent family of related products without exposing their concrete types.

## Compare Before Selecting

State each candidate’s benefit, drawback, prerequisite, rejection condition, and valid combinations. Use any justified set or none; never force primary/supporting ranks.

Compare direct references, one simple factory, Factory Method, Abstract Factory, ScriptableObject family catalogs, prefab variants, Strategy, Builder, and VContainer.

## Prove There Is a Family

1. List product kinds, such as button, dialog, and icon.
2. List families, such as standard, accessibility, and console.
3. State the compatibility invariant that forbids mixing families.
4. Confirm both axes are real and likely to grow.

Benefit: switch a complete compatible family through one abstraction. Drawbacks: many interfaces/classes/assets, broad factory contracts, and edits across every family when a new product kind appears.

Reject it when there is only one product kind, one meaningful family, no compatibility invariant, or a data asset can select direct references more clearly.

## Design the Family Boundary

- Give every product kind a narrow contract.
- Give the family factory one creation method per required product kind.
- Select the family atomically at a clear composition root.
- Prevent clients from mixing concrete products from different families.
- Keep runtime instance state outside family configuration assets.
- Decide whether products are owned, pooled, scene-bound, or externally loaded.

Do not make every product variation a new subclass by reflex. A ScriptableObject family asset containing validated prefab/service references often supplies the same family selection with less code.

## Manage Evolution

Abstract Factory favors adding new families: implement the existing product set once. It makes adding a new product kind expensive because every family must change. Reject the pattern when product kinds change more often than families.

Use Factory Method inside a family only when a product’s construction itself needs polymorphic extension. Use Strategy for interchangeable behavior, Builder for one complex product, and VContainer for dependency/lifetime composition.

## Verify

- Test every family produces every required product kind.
- Assert cross-family products cannot be mixed accidentally.
- Validate all prefab and service references before play.
- Exercise family switching, partial construction failure, teardown, and asset unloading.
- Simulate adding one family and one product kind; compare the change surface.

Read [references/abstract-factory-guide.md](references/abstract-factory-guide.md) for research notes and sources.
