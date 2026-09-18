# Assembly Definition and Reference settings

## Contents

- Identity and references
- General options
- Conditional compilation
- Assembly Definition Reference assets
- JSON review rules

## Identity and references

| Property | Exact role | Guardrail |
| --- | --- | --- |
| Name | Unique compiled assembly name, independent from the folder and potentially from the asset filename. | Use a stable reverse-DNS or company-feature convention. Renaming is an API and reference migration, not cosmetic cleanup. |
| Root Namespace | Default namespace applied by supported IDEs when creating new scripts in the assembly. | It does not wrap, rename, or move existing types. Match the existing namespace convention. |
| Assembly Definition References | Direct references to other custom assemblies. | Add only assemblies whose types the source uses; keep the graph acyclic. |
| Use GUIDs | Serializes custom assembly references as asset GUIDs instead of names. | Recommended for rename resilience. The checkbox itself is not stored as a JSON field; Unity infers it from reference values. Preserve `.meta` files. |

Name-based references are stored as assembly names. GUID references are stored as `GUID:<asset-guid>`. Use one form consistently within a `references` list.

## General options

| Property | Exact role | Guardrail |
| --- | --- | --- |
| Allow `unsafe` Code | Passes the compiler option that permits C# `unsafe`. | Enable only for source that actually requires it and verify target/toolchain compatibility. |
| Auto Referenced | Lets Unity's predefined assemblies automatically reference this custom assembly. | Disabling does not exclude the assembly from builds. Predefined assemblies cannot add explicit references, so migrate their consumers first. |
| No Engine References | Omits automatic `UnityEngine` and `UnityEditor` references. | Use for genuinely engine-independent code. Any Unity API use will fail to compile. |
| Override References | Replaces the default set of precompiled plugin DLL references with the explicitly selected DLLs. | It does not replace custom `.asmdef` references or all Unity dependencies. Validate every target because plugin compatibility can differ by platform. |

When `Override References` is enabled, `precompiledReferences` contains DLL filenames including extensions but no path. The list is ignored when the override is disabled.

## Conditional compilation

| Property | Exact role | Guardrail |
| --- | --- | --- |
| Platforms | Includes or excludes the whole assembly for selected targets. | `includePlatforms` and `excludePlatforms` cannot both contain values. Test every supported target and each consumer that might outlive the dependency. |
| Define Constraints | Compiles and references the whole assembly only when its symbol expression is satisfied. | Rows combine with AND; `||` expresses OR within a row; `!SYMBOL` requires absence. A missing assembly can break its consumers. |
| Version Defines | Defines a symbol when a named package or Unity module exists at a matching version. | Use for optional compile-time integrations. Confirm the installed package identifier and expression syntax for the project version. |

Prefer a platform filter when the entire assembly is platform-specific. Prefer a define constraint when the entire assembly depends on a compile symbol. Prefer `#if` around a small implementation detail when excluding the whole assembly would complicate the graph.

## Assembly Definition Reference assets

An `.asmref` has one required JSON field:

```json
{
  "reference": "GUID:<target-asmdef-meta-guid>"
}
```

It makes scripts in that folder and unclaimed descendants compile into the target assembly. It does not create a new assembly or a dependency edge. Verify the target in the Inspector and verify a representative script's Assembly Information after import.

## JSON review rules

- Treat `.asmdef` and `.asmref` as Unity assets: keep valid JSON, preserve `.meta`, and allow the Editor to import them.
- Keep `references` for custom assemblies and `precompiledReferences` for external DLL filenames conceptually separate.
- Never edit generated `.csproj` references as a workaround; Unity regenerates them from asset configuration.
- Avoid copying a full JSON template from a different Unity or package version. Start with the current Editor-generated asset and change only required fields.
- Review name changes, platform changes, define constraints, test marking, and Auto Referenced changes as public compatibility changes for reusable packages.
