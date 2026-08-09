# Burst compatibility and mathematics

## Table of contents

1. Burst compilation model
2. Make code Burst-compatible
3. Unity.Mathematics and vectorization
4. Floating-point modes
5. Burst Inspector
6. Compilation settings
7. Validation

## 1. Burst compilation model

Burst translates supported IL/.NET bytecode into optimized native CPU code through LLVM.

For Burst 1.8 in Unity 2022.3:

- Editor Play Mode normally uses Burst JIT compilation and can compile asynchronously.
- Player builds use Burst AOT compilation for supported targets.
- `[BurstCompile]` marks jobs or supported methods/function pointers for Burst compilation.
- Burst supplements Mono or IL2CPP; it does not replace the scripting backend.

Verify that Burst compilation is enabled in the Editor and Player settings. A job that runs correctly is not proof that it ran Burst-compiled.

## 2. Make code Burst-compatible

Prefer:

- Unmanaged structs and primitive values.
- `NativeArray` and other Burst-compatible Native Collections.
- `FixedString`/`FixedList` when bounded inline data is required.
- `Unity.Mathematics` types and functions.
- Static readonly scalar constants.
- Direct, simple loops with explicit data access.

Avoid in Burst paths:

- Managed object references and managed arrays/collections as job fields.
- `string` manipulation and ordinary managed logging.
- Managed allocation (`new` reference types, LINQ materialization, delegates/closures).
- Reflection, dynamic dispatch, and unsupported virtual/interface calls.
- Locks and general thread synchronization.
- Exceptions as runtime control flow.
- Calls into general UnityEngine APIs that require managed objects or the main thread.

Use compiler diagnostics as the final authority because Burst's supported C# subset changes by package version. Do not “fix” compiler errors by disabling Burst without reporting the loss.

## 3. Unity.Mathematics and vectorization

Use `float2`, `float3`, `float4`, matrices, quaternions, and `math.*` functions in numeric job code when they improve Burst compatibility and SIMD opportunities.

Vectorization is helped by:

- Contiguous arrays.
- Linear loops.
- Independent iterations.
- Minimal aliasing.
- Predictable branches.
- Operating on multiple numeric values with supported math types.

Vectorization can be blocked by complicated control flow, unknown aliasing, unsupported calls, scattered memory access, or data dependencies between iterations.

Do not rewrite readable scalar code into manual SIMD or intrinsics without inspecting generated code and measuring a target CPU. Burst can already vectorize many simple loops.

## 4. Floating-point modes

Default to standard precision and strict/default float behavior.

`FloatMode.Fast` can permit reordering and specialized lower-precision behavior. It can change:

- Rounding.
- NaN and infinity handling.
- Reproducibility across CPU architectures.
- Simulation determinism.

Use faster or lower-precision modes only when:

- The feature defines an acceptable numeric error.
- Tests cover boundaries and representative data.
- Cross-platform behavior is acceptable.
- The Profiler shows meaningful benefit.

Do not use a “deterministic” enum value without checking whether the installed Burst version actually supports it.

## 5. Burst Inspector

Open Burst Inspector to:

- Confirm a compile target exists.
- Inspect .NET IL, unoptimized and optimized LLVM IR, and generated assembly.
- Compare code with safety checks on/off.
- Inspect branch flow and target architecture.
- Verify expected vector instructions or identify branches/calls that block optimization.

Use Inspector evidence together with runtime profiling. Better-looking assembly is not useful if schedule or data-copy cost dominates the frame.

## 6. Compilation settings

### Asynchronous JIT

In Editor Play Mode, Burst can initially execute the managed version until asynchronous compilation completes. Warm up before timing steady-state code.

### Synchronous compilation

Use synchronous compilation only when first-call behavior must be Burst-compiled immediately or when a controlled benchmark requires it. It can increase Editor wait time.

### Safety checks

Keep safety checks enabled during implementation and tests. Compare performance with production-equivalent settings only after correctness is proven. Global force-on safety settings can override local disable requests depending on Burst version.

### Native debug mode

Use native debug compilation for debugging, not performance conclusions, because it disables optimizations.

## 7. Validation

For each Burst path:

- Confirm compilation target in Burst Inspector.
- Check Console for Burst warnings/errors.
- Compare Burst enabled versus disabled for correctness.
- Test zero, one, typical, maximum, and invalid inputs.
- Test target architecture and IL2CPP Player.
- Compare numeric tolerances and deterministic requirements.
- Profile total frame cost, not only job execution.
- Re-run after changing float mode, precision, safety, or package version.
