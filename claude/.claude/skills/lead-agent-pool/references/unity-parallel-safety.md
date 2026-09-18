# Unity Parallel Safety

Codex subagents in one task share a filesystem. Use resource ownership and serialized verification to prevent race conditions.

## Usually safe to parallelize

- Read-only investigation of different subsystems.
- Edits to disjoint C# files behind already-stable interfaces.
- Tests authored in disjoint files when no worker is changing their shared fixture or assembly definition.
- Documentation or Bead analysis that does not touch the same generated map or tracked file.

## Require an explicit lock or serialize

- The same source file, partial class, generated file, or shared fixture.
- `.unity`, `.prefab`, `.asset`, Timeline, Animator Controller, input, lighting, or other Unity-serialized assets.
- `ProjectSettings/**`, `Packages/manifest.json`, package locks, NuGet restore declarations, `.asmdef`, `.asmref`, and scripting defines.
- Shared dependency-injection composition roots, public interfaces, save schemas, event contracts, and scene transition ownership until their contracts are stable.
- Setup tools, indexes, user-level Codex/MCP configuration, package installation, and Unity Editor lifecycle operations.
- Unity MCP mutations, Test Runner, broad compilation/Console audits, builds, and final live Editor verification.

## Dispatch check

Before running two Beads together, prove all of the following:

1. Their owned paths do not overlap.
2. Neither consumes a contract the other is still changing.
3. Their setup, package, generated-output, and Editor resource locks do not overlap.
4. Both can report useful completion independently.
5. Their changes can be integrated without asking one worker to reinterpret the other's unfinished work.

If any point is uncertain, add a dependency or run the Beads sequentially.

## Convergence

After parallel source work:

1. Stop dispatching new Editor-mutating work.
2. Review combined changed paths for ownership violations.
3. Resolve interface or serialization conflicts through a dedicated integration Bead.
4. Wait for Unity compilation and domain reload to settle once.
5. Run one consolidated Console, test, and live behavior verification lane.

Do not treat multiple workers independently reporting clean source edits as proof that the combined Unity project compiles or behaves correctly.
