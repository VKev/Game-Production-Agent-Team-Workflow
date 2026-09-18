# Custom tools and complete surface verification

## Registration forms

- Typed static method: `[McpTool("Project.Tool", "Description", "Title", annotations)]` on a static method with one parameter object. Decorate fields/properties with `[McpDescription("...", Required = true, EnumType = typeof(...), Default = ...)]`; the registry generates and validates the input schema.
- Dynamic static method: accept `JObject` and provide `[McpSchema("Project.Tool")]` plus `[McpOutputSchema("Project.Tool")]` methods returning complete JSON-schema objects.
- Class tool: implement `IUnityMcpTool<TParams>` for typed parameters, or `IUnityMcpTool` for `JObject` plus custom `GetInputSchema()`/`GetOutputSchema()`. Annotate the class with `[McpTool]`, give it a public parameterless constructor, and remember that one instance is created at discovery and reused across executions.
- Runtime tool: call `McpToolRegistry.RegisterTool(name, instance, description, enabledByDefault, groups)` (or its typed overload) and later `UnregisterTool(name)` when the dynamic lifetime ends.

Example typed declaration:

```csharp
using Unity.AI.MCP.Editor.ToolRegistry;

[McpTool(
    "Project.ValidateSpawn",
    "Validates one spawn definition without mutating it.",
    "Validate spawn",
    Groups = new[] { "project", "validation" },
    EnabledByDefault = true)]
public static object ValidateSpawn(ValidateSpawnParams parameters)
{
    return new { valid = !string.IsNullOrWhiteSpace(parameters.AssetPath) };
}

public sealed class ValidateSpawnParams
{
    [McpDescription("Project-relative prefab path", Required = true)]
    public string AssetPath { get; set; }
}

[McpOutputSchema("Project.ValidateSpawn")]
public static object ValidateSpawnOutputSchema() => new
{
    type = "object",
    properties = new { valid = new { type = "boolean" } },
    required = new[] { "valid" }
};
```

Use the exact attribute constructor/properties from the pinned public API; compile before assuming an example remains valid after a package update.

Provide a specific description, title when supported, annotations, groups, correct default-enabled policy, and complete JSON schemas. Validate required/optional fields, types, enums, defaults, limits, structured/image/resource outputs, cancellation, reload behavior, side effects, and concurrency expectations. Tool names pass through official sanitization; discover the final exposed name instead of assuming it.

Registry changes must result in refresh/tool-change notification. Confirm the tool appears in the unfiltered Unity registry, is enabled, appears in Codex `tools/list`, and has the same canonical schema hashes.

- Assembly/type changes discovered by `TypeCache` require `McpToolRegistry.RefreshTools()` after compilation when automatic refresh has not already fired.
- Runtime registration/unregistration raises `ToolsChanged`; consumers must handle `Added`, `Removed`, `Updated`, and `Refreshed` and then request a fresh `tools/list`.
- `NotifyToolAvailabilityChanged(toolName)` is for a registered tool whose availability changed without replacement. Pass `null` only for a deliberate all-tools availability refresh.

## Enable and export

During Phase B, require every per-tool checkbox to be enabled in the Unity MCP settings UI. The pinned package's `MCPSettings` implementation is internal and its current UI has no public **Enable All** control, so project code must not depend on it. Follow [live-registry-export.md](live-registry-export.md) and export three JSON inputs under `.agent-temp/setup-checkpoints/unity-mcp/`:

1. `official-source.json`: generated from the verified package tarball.
2. `unity-registry.json`: all registry entries with disabled tools included; include name, title, description, input/output schemas, annotations, groups, default/enabled state, and known URI patterns.
3. `codex-tools.json`: the client-visible `tools/list` result plus `initialize` capabilities.

Repeat the registry/client capture after the final package import and domain reload so newly registered tools cannot remain disabled. Run the setup skill's `scripts/build_unity_mcp_catalog.py` with all three final inputs. It canonicalizes schemas and hashes them. Completion requires:

```text
official package tools
+ live Assistant-adapted tools
+ live project custom tools
= complete Unity registry
= tools visible to Codex
```

Compare exact exposed names, input/output schema hashes, groups, enable state, and URI patterns. Preserve handwritten skill files; replace only generated references. If equality fails, write `skill-surface-drift`, refresh registry/client discovery, regenerate, and recheck. Never suppress or hand-wave a mismatch.

## Security

Approval is per client connection. Do not bypass Pending Connections or weaken tool permissions. Ask before broad/deleting operations. Normalize paths inside the project, preserve SHA preconditions, avoid concurrent edits of the same scene/prefab/asset, and never persist secrets in project catalog/checkpoint files.
