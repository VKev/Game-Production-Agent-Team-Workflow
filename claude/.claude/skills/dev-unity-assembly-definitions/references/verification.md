# Verification

## Contents

- Baseline
- Per-boundary checks
- Final graph checks
- Performance evidence
- Handoff evidence

## Baseline

Before changing assembly ownership, capture:

- exact Unity and relevant package versions;
- clean Editor compile and current Console errors/warnings;
- Edit Mode and Play Mode test results;
- affected Player build result;
- current assembly owner for representative scripts;
- representative edit-to-compile timing for the edit patterns the split is intended to improve.

Do not claim an improvement without a comparable baseline.

## Per-boundary checks

After each `.asmdef`, `.asmref`, property, or reference change:

1. Wait for import and compilation to finish.
2. Fix all new compiler errors before the next graph change.
3. Check a representative script's Assembly Information.
4. Confirm direct custom and precompiled references in the Inspector.
5. Confirm Editor code is Editor-only and runtime code has no Editor dependency.
6. Run the closest affected tests.
7. Preserve the new asset's `.meta` file and confirm GUID references resolve.

Do not batch multiple unverified boundaries merely to reduce reload count; a smaller failure step is easier to reason about and recover.

## Final graph checks

- Assembly names are unique and follow the project convention.
- Every assembly has one clear responsibility and owner.
- All custom references are intentional, direct, and acyclic.
- No custom assembly attempts to reference a predefined assembly.
- No runtime assembly references Editor or test code.
- No required predefined consumer lost access through `Auto Referenced=false`.
- `Override References` lists every actually used precompiled DLL on every supported target.
- Platform filters, define constraints, and version defines have compatible consumers.
- `.asmref` assets target the intended assembly and do not obscure folder ownership.
- Tests are discovered and executed in their intended modes.
- Clean Player builds succeed for the affected target matrix.

## Performance evidence

Assembly Definitions can reduce the assemblies recompiled after a change, but total iteration time can still include source import, compilation startup, assembly reload, domain reload, static initialization, asset refresh, and plugin/package work.

Measure at least two representative edit classes:

- a high-frequency leaf or presentation change that should remain local;
- a stable low-level change expected to rebuild its consumers.

Record which assemblies compiled and the end-to-end time. `UnityEditor.Compilation.CompilationPipeline` exposes compilation-start, assembly-start/finish, and compilation-finish events for diagnostics; do not trigger Player builds or more compilation from those callbacks. Editor logs or an existing project profiler may also supply evidence.

Reject conclusions based on one noisy run. Compare repeated runs under similar Editor state and report domain reload separately when possible. Too many tiny assemblies can add overhead and graph complexity even when each assembly is small.

## Handoff evidence

Report:

- assemblies and scripts whose ownership changed;
- final dependency direction;
- `.asmdef`, `.asmref`, and `.meta` files changed;
- settings decisions, especially Auto Referenced and Override References;
- platforms and package/test versions verified;
- compile, Console, tests, and Player builds observed;
- before/after timing and which assemblies recompiled;
- configurations not exercised and remaining migration risk.
