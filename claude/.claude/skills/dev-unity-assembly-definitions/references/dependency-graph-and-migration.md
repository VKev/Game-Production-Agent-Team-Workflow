# Dependency graph and migration

## Contents

- Boundary selection
- Graph rules
- Safe migration order
- Assembly Definition References
- Cycle repair
- Granularity checks

## Boundary selection

An assembly is a compile-time ownership boundary. Create one when it provides at least one concrete benefit:

- a cohesive feature or reusable module needs an enforced public surface;
- runtime, Editor, test, package, platform, or optional-integration code must compile separately;
- stable low-level code should not recompile for unrelated high-level changes;
- a team or package owns a module independently;
- tests need a narrow unit boundary without Unity-facing consumers.

Do not split by script taxonomy such as `Managers`, `Components`, `Models`, or `Utilities`. Those folders describe class shapes, not ownership or dependency direction. If a proposed assembly has no stable responsibility statement, keep the code in its current owner.

## Graph rules

Model a directed edge as `consumer -> dependency`. The dependency should normally be more stable than its consumer.

- Runtime foundation and contracts sit below changing gameplay and presentation.
- Editor tools reference the runtime code they inspect or author.
- Tests reference the exact runtime or Editor module they exercise.
- Features should not reference one another sideways merely for convenience. Use an existing owner, a narrow contract owned below both, or direct orchestration above them.
- Custom assembly references are explicit. If `UI -> Gameplay.Contracts -> Foundation`, UI still needs a direct reference to Foundation when UI source uses Foundation types.
- Unity determines compilation order from this graph; do not try to encode execution order with assembly references.

## Safe migration order

Adding an `.asmdef` removes scripts in its folder tree from their previous assembly. This creates an important legacy constraint:

1. A custom assembly cannot reference a predefined assembly such as `Assembly-CSharp`.
2. Predefined assemblies automatically reference custom assemblies whose `Auto Referenced` property is enabled.
3. Therefore, move a self-contained foundation or other dependency first, keep its predefined consumers working through automatic reference, then migrate consumers upward one boundary at a time.

Suggested sequence:

1. Capture baseline compile, tests, build, and representative iteration timing.
2. Draw the intended acyclic graph and choose the smallest self-contained dependency.
3. Create its `.asmdef` in Unity so the asset and `.meta` are imported normally.
4. Add its direct package, plugin, and custom assembly references.
5. Compile and repair only this step.
6. Move the next consumer into its own assembly and add direct references.
7. Split Editor and test code at the moment its parent runtime boundary changes.
8. Repeat until the intended graph is complete; stop early if the remaining split has no clear value.

Do not disable `Auto Referenced` on a migrated dependency until all predefined consumers have moved or have stopped using it.

## Assembly Definition References

An `.asmref` assigns scripts in its folder and unclaimed descendants to an existing `.asmdef`. Use it when location and compile ownership intentionally differ, for example:

- generated Input System wrappers or settings-adjacent scripts must remain beside their assets;
- distributed Editor folders should join one Editor-only tool assembly;
- a package or feature owns scripts stored in a required non-child location.

Keep the target explicit, prefer a GUID reference when rename resilience matters, and confirm the resulting Assembly Information in the Inspector. Do not use `.asmref` to create overlapping or ambiguous ownership or to avoid repairing an incoherent layout.

## Cycle repair

Given `A -> B -> A`, choose the smallest truthful repair:

1. **Move a contract down:** extract only the interface, message, identifier, or immutable data shape both sides need into a stable lower assembly.
2. **Invert one dependency:** let the higher-level owner define the port and inject an implementation from composition code.
3. **Move orchestration up:** a parent coordinator can depend on both modules and connect them without either module knowing the other.
4. **Merge cohesive code:** if both sides share state, lifecycle, and change reasons, the cycle may reveal one responsibility rather than two.

Reject a broad `Common` assembly that accumulates unrelated types. It hides the cycle instead of clarifying ownership.

## Granularity checks

Keep or merge an assembly when most of these are true:

- its scripts change with another assembly on the same tasks;
- it exposes much of its implementation merely to make the split compile;
- it contains only a handful of inseparable types;
- consumers almost always reference it together with another assembly;
- it adds graph and import overhead without isolating a build, platform, owner, or meaningful edit set.

Split when responsibility, lifetime, platform, packaging, testing, or change frequency supplies a durable boundary. Measure rather than assuming smaller assemblies always produce faster iteration.
