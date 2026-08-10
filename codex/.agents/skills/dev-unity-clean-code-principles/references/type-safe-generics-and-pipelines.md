# Type-Safe Generics and Pipelines

Use advanced generics only when compile-time constraints, reusable composition, or API discoverability solve a demonstrated problem.

## Choose the smallest form

| Need | Prefer |
|---|---|
| One short stable calculation | Direct method |
| One interchangeable algorithm | Strategy or delegate |
| Reusable ordered transformations | Simple generic processor chain |
| Only certain operations are valid at each stage | Typed staged builder |
| A base API must fluently return the concrete derived type | Consider a self-typed generic base |

Do not introduce CRTP or a staged builder merely to remove a cast, shorten a switch, or make ordinary virtual methods look more advanced.

## Treat self-typed generics precisely

The common form is:

```csharp
abstract class Base<TSelf> where TSelf : Base<TSelf>
```

This constraint proves that `TSelf` is a compatible `Base<TSelf>`. It does not prove that the immediate derived class passed itself. A mismatched subclass can compile and make `(TSelf)this` fail at runtime.

- Prefer CRTP when the base must return the concrete fluent type or preserve stage-specific APIs.
- Prefer ordinary abstract or virtual methods when the base only invokes lifecycle hooks.
- Do not claim C++-style static dispatch or a performance improvement in C# without generated-code or profiler evidence.
- Keep leaf types sealed when the hierarchy is intended to be closed, but do not treat sealing as proof of a correct self-type pairing.
- Avoid an unchecked `(TSelf)this` cast when a simpler contract removes it.
- Preserve Liskov substitutability; a generic constraint does not repair a broken base-class contract.

## Build simple processor chains first

A processor contract such as `IProcessor<TIn, TOut>` can isolate transformations and make composition testable. A `Combined<A, B, C>` node can pass the first result into the second, and `Then` can return a new `Chain<TIn, TNext>`.

- Build the graph outside the hot path and execute it many times only when reuse exists.
- Keep processors stateless or make captured state and lifetime explicit.
- Separate pure transformations from effects such as logging, rendering, events, or object mutation.
- Define null, error, cancellation, and short-circuit behavior before composing fallible stages.
- Keep Unity object access on the Unity thread and handle destroyed-object semantics.
- Do not use a pipeline when direct readable code already expresses the rule clearly.

## Understand variance

- Mark an input-only interface or delegate parameter `in` only when contravariant conversions are useful.
- Mark an output-only parameter `out` only when covariant conversions are useful.
- Generic variance conversions apply to reference types, not value types such as `float`, `bool`, or `Vector3`.
- A variance annotation can document direction, but do not claim a runtime or performance benefit from the annotation itself.
- Keep a type invariant when it both consumes and produces the same parameter.

## Add staged fluent APIs only for real ordering constraints

Typed stages are valuable when invalid operation order is a recurring defect or stage-specific IntelliSense materially improves authoring.

- Expose only operations valid for the current stage.
- Return the next concrete stage after a valid transition.
- Keep the wrapped processor private or protected, not publicly mutable.
- Make builder methods genuinely immutable when they claim immutability: construct the new processor graph without mutating the prior stage.
- Avoid one class per stage when a simple generic chain or explicit method sequence is already clear.
- Watch for combinatorial type growth when a workflow branches or allows many optional stages.
- Make construction-time actions visibly different from runtime processing actions.

## Describe compilation and cost honestly

Returning `input => processor.Process(input)` creates a reusable delegate; it does not flatten the processor graph or compile it into specialized code.

Evaluate separately:

- Graph-construction allocations.
- Delegate and closure allocations.
- Per-call interface or virtual dispatch.
- Processor-local allocations and Unity API work.
- Branching and cache behavior.
- Mono versus IL2CPP and Editor versus target-device results.

Do not advertise “thousands of calls per frame” without a representative benchmark and profiler capture. Prefer the simpler direct form when the measured difference is negligible or the pipeline is not reused.

Use `dev-unity-performance-profiling` for material performance claims and `dev-unity-csharp-collections-queries` when the stages primarily express collection queries.

## Verification

Test type-valid and intentionally invalid stage order, null processors, dynamic captured values, repeated execution, old-stage immutability, side-effect timing, destroyed Unity objects, error/cancellation propagation, and output equivalence with the direct implementation. Compile under the project's Unity/C# version and profile the actual target when performance motivates the design.

## Sources and example provenance

- Microsoft generic variance overview: https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance
- Microsoft variance in delegates: https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/covariance-contravariance/variance-in-delegates
- Microsoft generic constraints: https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters
- Unity 2022.3 C# compiler baseline: https://docs.unity3d.com/2022.3/Documentation/Manual/CSharpCompiler.html
- Analyzed CRTP tutorial: https://www.youtube.com/watch?v=6sNJ57gnBvg
- CRTP example gist: https://gist.github.com/adammyhre/747371bc14470f3b31fdbb62d758e9bd
- Analyzed generic-pipeline tutorial: https://www.youtube.com/watch?v=DbOKwASHGVA
- Generic-pipeline example gist: https://gist.github.com/adammyhre/2f11617426039304973eda2acedb752b

Treat the tutorial code as example provenance, not a mandatory pattern or proof of performance.
