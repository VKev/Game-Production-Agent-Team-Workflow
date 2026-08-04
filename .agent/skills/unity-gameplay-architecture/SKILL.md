---
name: unity-gameplay-architecture
description: Select, design, organize, implement, review, and refactor Unity gameplay architecture and folder/module structures without forcing a single pattern. Use for feature boundaries, file placement, dependency direction, ownership and lifetimes, MonoBehaviour versus plain C# decisions, ScriptableObject data architecture, event-driven communication, state machines, Strategy, Factory, Command, MVC/MVP, services, dependency injection, feature modules, assembly definitions, testability, extensibility, and architecture-related performance tradeoffs. Trigger when a Unity task asks how systems or project files should be structured or connected, or when gameplay code is becoming coupled, monolithic, scattered, hard to navigate, hard to test, or difficult to extend.
---

# Unity Gameplay Architecture

Choose the smallest architecture and folder structure that satisfy the current task, fit the existing project, and leave only justified extension seams for future GDD requirements. Treat architectures, patterns, and folder trees as selectable tools, not mandatory layers.

## Required workflow

1. **Inspect the project first.**
   - Read the root and relevant local `AGENTS.md` files.
   - Read the relevant GDD sections and task requirements.
   - Identify the Unity version, packages, render/input stack when relevant, existing project-owned source root, folder and assembly boundaries, namespaces, and established architecture conventions.
   - Reuse a suitable existing architecture and folder convention instead of creating a parallel one.

2. **Define the feature boundary.**
   - State what the feature owns and what it does not own.
   - Identify configuration data, runtime state, save state, gameplay rules, Unity integration, presentation, and external infrastructure.
   - Identify object owners and lifetimes: application, scene, feature, entity, or operation.
   - Identify communication paths, update frequency, serialization needs, designer workflows, test needs, and performance constraints.
   - Decide which existing project folder owns the feature and which runtime, Editor, test, asset, adapter, or assembly boundaries are actually required.

3. **Select an architecture and folder structure deliberately.**
   - Read `references/architecture-selection.md`.
   - Read `references/folder-structures.md` when creating, moving, grouping, or reorganizing scripts, assets, tests, Editor code, or assemblies.
   - Compare only candidates that solve the actual problem.
   - Prefer direct composition, feature ownership, and narrow responsibilities before adding layers, interfaces, buses, factories, services, frameworks, or deep folder trees.
   - Preserve the existing project-owned root and closest suitable feature layout.
   - Combine patterns when their responsibilities are distinct; do not force one pattern or folder hierarchy to organize the entire project.
   - Create only folders required by files implemented now. Do not scaffold empty architecture layers for speculative work.

4. **Record the decision before implementation.**
   Use this compact form unless the user requests a longer design:

   ```text
   Selected approach:
   Responsibilities and ownership:
   Dependency direction:
   Communication:
   Project-owned root and folder structure:
   Assembly boundaries, if any:
   Alternatives rejected:
   Extension seams intentionally left:
   AGENTS.md updates required:
   Verification plan:
   ```

5. **Implement within scope.**
   - Change only the feature and directly required integration points.
   - Place files under the owning feature or existing module according to the selected folder structure.
   - Create a technical subfolder only when it expresses a real responsibility, dependency, Unity, Editor, test, asset, or assembly boundary.
   - Preserve public APIs, serialized data, Unity asset GUIDs, `.meta` files, namespaces, and assembly references when practical.
   - Do not implement speculative future features or create empty placeholder folders.
   - Add an abstraction only when it protects a real variation, dependency, ownership, platform, test, or GDD-supported boundary.
   - Use `unity-project-context` to update affected root and local `AGENTS.md` tables of contents after folder or important-file changes.

6. **Verify and refine.**
   - Read `references/verification.md`.
   - Compile, inspect the Console, run relevant Edit Mode or Play Mode tests, and playtest the exact feature.
   - After file moves, verify namespaces, `.asmdef` references, Editor/runtime separation, serialized references, prefabs, scenes, asset GUIDs, Resources paths, and Addressables entries where applicable.
   - Fix errors, warnings caused by the change, lifecycle defects, documentation drift, and regressions; then retest.
   - After correctness, evaluate meaningful optimization without sacrificing clarity for negligible gains.

## Architecture selection rules

- Prefer **direct component composition** for small, local, stable behavior.
- Prefer a **thin MonoBehaviour shell with plain C# logic** when rules or simulation benefit from isolation and tests.
- Prefer **feature-oriented modules** when a feature has multiple cooperating responsibilities and a clear public boundary.
- Prefer **ScriptableObject-driven data** for shared designer-authored configuration, catalogs, and intentional asset-based communication; do not use it automatically for transient runtime or save state.
- Prefer **events or Observer** for one-to-many notifications; prefer direct calls for owned, local, one-to-one collaboration.
- Prefer **MVP** for nontrivial Unity UI that must be separated from gameplay logic; keep simple UI simple.
- Prefer a small enum or switch for a few stable states; introduce **State** objects when state behavior and transitions are independently complex or expected to grow.
- Prefer **Strategy** for interchangeable algorithms behind one stable contract.
- Prefer **Factory** when creation varies or setup must be centralized; do not wrap trivial constructors or `Instantiate` calls without benefit.
- Prefer **Command** for queued, delayed, replayable, undoable, or schedulable actions.
- Prefer explicit **services and composition roots** only for genuinely shared, long-lived capabilities with clear lifetimes.
- Consider **layered/Clean/ports-and-adapters boundaries** only when domain rules must remain independent from multiple replaceable Unity or platform adapters.
- Consider **Jobs, Burst, or ECS/DOTS** only for suitable data-oriented workloads after project/package checks and profiling evidence.

See `references/pattern-catalog.md` for benefits, costs, use cases, and rejection signals.

## Folder structure rules

Read `references/folder-structures.md` for architecture-specific layouts, examples, `.asmdef` guidance, and safe migration rules.

Always:

- Preserve a suitable existing project root and naming convention.
- Keep small features flat; add subfolders only when they improve ownership, navigation, deployment boundaries, or dependency clarity.
- Prefer feature ownership over generic global buckets such as `Managers`, `Controllers`, `Helpers`, or `Patterns` when the project is large enough to benefit.
- Keep State, Strategy, Factory, Command, event, and presentation types inside the feature that owns them unless they form a genuine shared module.
- Separate Runtime, Editor, tests, authoring data, presentation, and infrastructure only when those boundaries exist in current files.
- Use `Shared`, `Core`, or `Common` only for stable code genuinely owned by multiple features; do not use them as dumping grounds.
- Use `.asmdef` files for useful runtime/Editor, platform, test, reusable-module, or stable dependency boundaries—not for every folder.
- Keep the assembly dependency graph one-way and acyclic.
- Preserve `.meta` files and GUIDs when moving Unity files.
- Avoid broad folder migrations while implementing a narrow feature.

## Unity boundary rules

Read `references/unity-boundaries.md` whenever the design crosses Unity objects, scenes, assets, assemblies, serialization, or lifecycle callbacks.

Always:

- Keep Unity callbacks and GameObject lifetime control in Unity-facing components.
- Keep pure rules independent from Unity objects when that separation creates a real testing or reuse benefit.
- Separate authoring configuration from mutable runtime state and persistent save data.
- Let owners create, initialize, disable, cancel, release, and destroy what they own.
- Make event subscription and unsubscription symmetric and lifetime-safe.
- Keep dependency direction explicit and avoid circular feature references.
- Follow the project Unity version and installed package APIs, not examples from a newer version.

## Anti-overengineering rules

Do not:

- Create an interface solely because SOLID was mentioned.
- Create a base class when composition is simpler and no shared invariant exists.
- Introduce a global event bus, service locator, dependency-injection framework, or singleton as the default solution.
- Split a small feature into Model, View, Presenter, Controller, Service, Repository, Factory, and Manager without independent responsibilities.
- Create every folder from an architecture template when the current implementation does not need those folders.
- Create a folder for every class, pattern role, or imagined future layer.
- Create empty `Domain`, `Application`, `Infrastructure`, `States`, `Strategies`, `Factories`, `Commands`, `Editor`, or `Tests` folders before current files need them.
- Reorganize unrelated project files merely to match a preferred template.
- Replace a working project-wide convention with a preferred personal pattern or layout without a concrete benefit.
- Perform a broad architecture or folder migration while implementing a narrowly scoped feature.

## Architecture quality checks

Before finalizing, confirm:

- Every class has a clear reason to change.
- Data ownership and mutation authority are explicit.
- Lifetimes and initialization order are explicit.
- Dependencies point toward stable responsibilities.
- Communication is traceable and not more indirect than necessary.
- The folder tree reflects feature ownership and real boundaries rather than arbitrary taxonomy.
- Runtime, Editor, test, asset, and assembly boundaries are valid where present.
- Files are easy to locate from the root and local `AGENTS.md` tables of contents.
- The architecture supports the current feature first.
- Future support is an extension path, not preimplemented behavior or empty scaffolding.
- The implementation can be tested and debugged at the appropriate boundary.
- No unnecessary `.asmdef` boundaries, duplicate homes, or catch-all folders were introduced.
- Added complexity has a stated payoff.

## Related skills

Use other repository skills when implementation details leave this skill's scope:

- `unity-project-context` for project navigation, folder documentation, and `AGENTS.md` maintenance.
- `unity-csharp-collections-queries` for collection and query choices.
- `unity-ui-controller-binding` for the specific `UIView`, plain-C# `UIController`, `DataContext`, `IBindable`, and child-context `BindList` screen pattern.
- `unity-object-pooling` for pool lifecycle and reset contracts.
- `unity-async-coroutines-unitask` for asynchronous sequencing and cancellation.
- `unity-assets-addressables` for asset-loading ownership and handles.
- `unity-performance-profiling` for measurement and optimization verification.
- `unity-jobs-burst-native-collections` for parallel/data-oriented execution.

## Reference loading guide

- Read `references/architecture-selection.md` for the decision tree and comparison matrix.
- Read `references/folder-structures.md` for architecture-aligned folder layouts, file placement, `.asmdef` boundaries, tests, Editor code, and safe file moves.
- Read `references/pattern-catalog.md` for detailed architecture and pattern choices.
- Read `references/unity-boundaries.md` for Unity-specific ownership, lifecycle, serialization, scenes, prefabs, and assemblies.
- Read `references/examples.md` when a concrete feature resembles one of the examples.
- Read `references/verification.md` before completing an implementation, folder reorganization, or refactor.
- Read `references/sources.md` when validating the guidance against its primary sources.
