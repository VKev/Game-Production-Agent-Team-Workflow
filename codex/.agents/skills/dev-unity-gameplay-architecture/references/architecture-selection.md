# Architecture Selection

## Table of contents

1. Selection principle
2. Information to collect
3. Decision tree
4. Comparison matrix
5. Folder structure selection
6. Combining approaches
7. Decision record

## 1. Selection principle

Start with the simplest arrangement that makes ownership, dependencies, lifecycle, and file placement correct. Add structure only when the task demonstrates a cost that the structure resolves.

Architecture selection is not a contest to choose the most scalable pattern or deepest folder tree. Select for the current feature, current project, known GDD direction, team workflow, and measured constraints.

## 2. Information to collect

Before choosing, answer:

- What exact behavior must exist now?
- Which future variants are explicitly supported by the GDD?
- What code and conventions already solve similar problems?
- Which project-owned folder currently owns similar features?
- What folder roots, namespaces, `.asmdef` boundaries, and `AGENTS.md` conventions already exist?
- Who owns the feature and each object it creates?
- Which data is authoring configuration, runtime state, or persistent save data?
- Which code requires Unity callbacks, scene objects, assets, or Inspector references?
- Is communication one-to-one, one-to-many, request/response, broadcast, or asynchronous?
- How many states, variants, creators, listeners, or platform implementations exist now?
- What is the expected update frequency and object count?
- What must be unit tested without entering Play Mode?
- What must designers be able to configure or debug in the Inspector?
- What project version, packages, assembly boundaries, and frameworks are already present?
- Will the task create or move files, and how will `.meta` files and GUIDs be preserved?

Do not use hypothetical scale as a substitute for evidence.

## 3. Decision tree

Follow in order. Multiple answers may combine into one feature architecture.

### A. Does the project already have a suitable convention?

- **Yes:** extend its architecture and folder structure unless they create a concrete correctness, maintainability, testability, navigation, or performance problem.
- **No:** continue.

### B. Is the behavior small, local, and owned by one GameObject or prefab?

- **Yes:** use direct component composition and serialized references.
- Keep the feature folder flat unless a distinct current responsibility needs separation.
- Avoid global services, events, or architecture-layer folders.

### C. Are the rules meaningful without Unity scene objects?

- **Yes:** use a thin MonoBehaviour adapter/shell plus plain C# rules or simulation.
- Keep transforms, physics callbacks, coroutines, and object lifetime in Unity-facing code.
- Separate `Core` and `Unity` folders only when the code boundary actually exists.

### D. Does the feature contain several cooperating responsibilities with a stable public surface?

- **Yes:** organize by feature/module.
- Expose a narrow facade or public contract only when callers need it.
- Add subfolders by responsibility, not by arbitrary class suffix.
- Consider an assembly definition only if the boundary is stable and useful.

### E. Must designers share and edit configuration across instances?

- **Yes:** consider ScriptableObject configuration or catalogs.
- Keep mutable per-instance runtime state separate unless shared runtime state is explicitly intended.
- Separate definition classes/assets from runtime state according to project convention.

### F. Is communication local and one-to-one?

- **Yes:** use a direct reference or narrow interface.
- Keep collaborators in the owning feature.
- Do not use a broadcast system merely to remove a visible reference.

### G. Must one publisher notify multiple independent listeners?

- **Yes:** consider C# events/Observer.
- Use UnityEvent when Inspector wiring is a real requirement.
- Use ScriptableObject event channels only when asset-based, scene-independent wiring is beneficial.
- Place event contracts with the owning feature instead of a global event dumping ground.

### H. Is behavior controlled by mutually exclusive runtime states?

- **Few stable states with small behavior:** enum/switch may be enough.
- **Growing or independently complex states/transitions:** use State objects or a dedicated state machine.
- Create a `States` folder only when multiple state files exist now.

### I. Must one algorithm be exchanged without changing its consumer?

- **Yes:** use Strategy.
- Place strategies under the capability they implement.
- Do not introduce it for one stable implementation with no test or variation boundary.

### J. Does object creation vary or require centralized setup?

- **Yes:** consider Factory or a dedicated spawner.
- Keep creation code under the owning feature's creation/spawning area.
- If creation is trivial and stable, call the constructor or `Instantiate` directly.

### K. Must actions be queued, delayed, replayed, recorded, undone, or scheduled?

- **Yes:** use Command.
- Keep commands with the feature that owns or executes them.

### L. Is the feature primarily nontrivial UI presentation?

- **Yes:** consider MVP: View exposes UI input/output, Model owns state/rules, Presenter coordinates.
- Group by feature or screen before creating one folder for each MVP role.
- For a tiny panel with direct behavior, keep it simple.

### M. Is there a shared capability with application/scene lifetime?

- **Yes:** use an explicit service with a composition root and declared lifetime.
- Prefer constructor/setup injection or serialized composition over hidden service lookup.
- Place feature-local services with the feature and true application/platform services under an explicit infrastructure boundary.

### N. Must domain rules remain independent from multiple replaceable external systems?

- **Yes:** consider layered/Clean/ports-and-adapters boundaries.
- Keep this for domains with meaningful rules and adapters, not simple gameplay components.
- Create only layers that contain current responsibilities; do not scaffold empty layers.

### O. Is there a large, homogeneous, data-parallel workload proven to be a bottleneck?

- **Yes:** profile, then consider Jobs/Burst or ECS/DOTS if packages and team expertise support it.
- Keep the data-oriented implementation inside the owning feature and make the managed/Unity bridge visible.
- Do not migrate ordinary object-oriented gameplay solely for theoretical performance.

### P. Does the selected architecture require a new folder boundary?

- **No:** place files in the existing owning folder and keep the feature flat.
- **Yes:** read `folder-structures.md`, create the minimum current folders, record their purpose, and refresh affected managed maps through `dev-unity-project-context`.
- Do not create a folder simply because an architecture diagram contains a named layer.

## 4. Comparison matrix

| Candidate | Best fit | Main benefit | Main cost | Typical folder shape | Reject when |
|---|---|---|---|---|---|
| Direct component composition | Small local feature | Lowest indirection | Can grow monolithic | Flat owning feature folder | Responsibilities already span systems |
| MonoBehaviour shell + plain C# | Testable rules/simulation | Separates engine from rules | Adapter code | `Core/` + `Unity/` only when real | Logic is only trivial Unity plumbing |
| Feature-oriented module | Multi-class cohesive feature | Locality and clear boundary | Boundary design | `Features/<Feature>/...` | Feature is too small |
| ScriptableObject data-driven | Shared designer configuration | Reuse and Inspector authoring | Asset/runtime-state confusion | `Definitions/` or `Config/` + runtime | Data is private transient state |
| Event-driven/Observer | One-to-many notification | Loose publisher/listener knowledge | Hidden control flow/lifetime bugs | Event contract near owning feature | Owned one-to-one call is clearer |
| MVP | Nontrivial UI | Separates view and logic | More classes/wiring | Feature/screen `Presentation/` as needed | UI is simple and stable |
| State | Growing state-specific behavior | Localizes states/transitions | Class count and transition design | Capability-local `States/` | Few tiny stable states |
| Strategy | Interchangeable algorithms | Replaceable behavior | Contract/indirection | Under varied capability, e.g. `Targeting/` | No real variation |
| Factory | Variable/complex creation | Centralized construction | Extra layer | Feature-local `Spawning/` or creation area | Creation is trivial |
| Command | Queue/replay/undo actions | Action objects and scheduling | Allocation/state complexity | Feature-local `Commands/` | Immediate call is sufficient |
| Service + composition root | Shared long-lived capability | Explicit lifetime/access | Global coupling risk | `Bootstrap/` + bounded infrastructure area | Feature-local dependency |
| Layered/Clean/ports-adapters | Rich domain + replaceable adapters | Domain independence/testability | Boilerplate and mapping | Real `Domain/Application/Infrastructure/Presentation` layers | Thin gameplay logic |
| Jobs/Burst/ECS | Measured data-parallel scale | Throughput and cache behavior | High complexity and constraints | Feature-local `Jobs/`, native data, or ECS areas | No measured bottleneck |

## 5. Folder structure selection

After choosing the architecture, select the smallest folder structure that communicates its real boundaries.

Use these rules:

1. Preserve the existing project-owned root and naming convention.
2. Prefer one owning feature folder over project-wide folders grouped only by class type.
3. Keep a small feature flat.
4. Add a subfolder only when it groups multiple current files by a meaningful responsibility, lifetime, Unity boundary, test boundary, or assembly boundary.
5. Keep pattern implementations inside the owning feature.
6. Separate runtime, Editor, tests, configuration, and infrastructure only where those categories exist now.
7. Do not create empty future folders.
8. Preserve `.meta` files and GUIDs when moving files.
9. Refresh relevant managed maps with `dev-unity-project-context`; never edit generated rows manually.
10. Verify namespace, assembly, serialized-reference, prefab, and scene compatibility after moves.

Read `folder-structures.md` for architecture-specific layouts and migration rules.

## 6. Combining approaches

Combine approaches by responsibility, not fashion. Examples:

- Feature module + MonoBehaviour shell + plain C# domain rules.
- ScriptableObject configuration + Strategy runtime behavior.
- MVP UI + direct service interface + C# events for model changes.
- State machine + Strategy for one state's interchangeable targeting algorithm.
- Factory + object pool for variable creation and reuse.
- Service composition root + ports/adapters for platform storage.

Reflect each distinct boundary in folders only when doing so improves navigation or enforces dependency direction. A feature may combine several patterns while remaining in one compact folder.

Avoid redundant combinations. A global message bus plus ScriptableObject event channels plus C# events for the same communication path makes behavior difficult to trace. Likewise, duplicating the same feature across global `Controllers`, `Models`, `Services`, and `Managers` folders can hide ownership.

## 7. Decision record

Use a concise record:

```text
Problem:
Current project convention:
Selected architecture/patterns:
Why this is the simplest sufficient option:
Responsibilities and ownership:
Dependency direction:
Data categories:
Communication mechanism:
Lifetimes and initialization:
Selected folder strategy:
Target folders and purpose:
Files created or moved:
Assembly and namespace impact:
Managed context refresh required:
Rejected alternatives and reasons:
GDD-supported extension seams:
Verification plan:
```
