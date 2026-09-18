# Project Settings > AI policy for Codex

Use this policy after the exact `com.unity.ai.assistant` tarball has been verified. Re-check the current package source whenever the pinned version changes; labels and public controls can drift between prereleases.

## Page routing

| Page | What it controls | Codex setup policy |
|---|---|---|
| **Assistant** | A custom-instructions text asset used by Unity's in-Editor Assistant | Preserve it. It does not configure the external Codex MCP client. |
| **Assistant MCP Extensions** | Unity Assistant acting as an MCP **client** of other MCP servers | Preserve it. Do not enable it, edit its server file, PATH, timeout, or server list merely to connect Codex to Unity. |
| **Gateway** | Third-party agents running inside Unity Assistant | Preserve it. Do not install/configure a second Codex, provider credentials, working directory, or default `AGENTS.md` injection here. |
| **UI** | Figma token used by Unity Assistant's UI authoring feature | Preserve it and never inspect or copy the token. It is unrelated to the external Codex MCP connection. |
| **Unity MCP Server** | Unity acting as an MCP **server** for external clients such as Codex | Configure and verify this page. This is the only required AI page for the portable Codex setup. |

The direction matters: **Assistant MCP Extensions** is `Unity Assistant -> external MCP server`; **Unity MCP Server** is `Codex -> Unity Editor`.

## Required Unity MCP Server state

1. If the third-party MCP disclaimer is shown, ask the user to review and accept it. The exact package UI requires a signed-in Unity user to record acceptance. Never accept legal terms, sign in, or handle Unity credentials for the user.
2. Require **Unity Bridge = Running**. If it was explicitly stopped, ask the user to select **Start**. Do not launch or click the Editor through desktop automation.
3. Keep **Validation Level = standard** for a new/default setup. It is the package default and balances syntax checks with Unity guidance. Preserve a deliberate valid value (`basic`, `standard`, `comprehensive`, or `strict`); do not silently downgrade it. `strict` requires the package's Roslyn support and must pass a real `Unity_ManageScript` validation before it is reported healthy.
4. Keep **Show Debug Logs** off during normal operation. Enable it temporarily only for a concrete discovery/bridge problem, capture the needed evidence, then restore it to avoid log noise.
5. Do not use **Auto-approve in Batch Mode** to bypass direct-client approval. It affects batch-mode connections, not the normal user-opened Editor workflow. Preserve the current value unless batch mode is explicitly in scope.
6. Require the intended Codex client to appear under **Connected Clients**. A first direct connection must be approved under **Pending Connections**. Multiple green `codex-mcp-client` PIDs are allowed because the official server supports multiple clients; do not revoke or delete them merely because more than one is visible. Multiple Unity Editor targets remain ambiguous and must be resolved separately.
7. Require every registered tool checkbox to be enabled. Do not hard-code `54`; packages and project custom tools change the count. A heading such as `Tools (54 of 54 enabled)` is a passing example only.
8. Preserve **Other Connections** history. Use **Integrations** only for read-only status/relay location if helpful. Configure Codex with the setup-owned TOML upsert script rather than Unity's generic **Configure** action so unrelated TOML remains protected.

## Full-tool procedure

For the verified `2.17.0-pre.1` source, the settings page exposes per-tool checkboxes and **Reset to Defaults**. It does not expose a public **Enable All** button, even though the package has an internal `MCPSettings.EnableAllTools()` method. Do not compile project code against, reflect into, or rewrite `EditorPrefs` for that internal implementation.

Use the public registry export from `dev-unity-mcp/references/live-registry-export.md` to obtain:

- total registered tools;
- each exact exposed name and `IsEnabled` value;
- the enabled/advertised tool list;
- the Codex-visible `tools/list` surface.

If any tool is disabled, report its exact name and ask the user to enable those checkboxes in **Project Settings > AI > Unity MCP Server > Tools**. Leaving the settings page persists dirty settings in this package version. Resume only after the user confirms, then export again. Pass only when:

```text
disabled_names = []
registered_count = enabled_count = codex_visible_count
registered_names = enabled_names = codex_visible_names
```

Schema equality remains a separate required gate.

Perform this check twice:

1. **Bootstrap check** after Codex connects, so setup has the current tool surface.
2. **Final check** after every UPM resolution, `.unitypackage` import, custom-tool registration, compile, and domain reload. The final check is authoritative because later packages can add disabled-by-default tools.

## Version-specific evidence

The verified `2.17.0-pre.1` package source establishes:

- `Unity.RunCommand` is enabled by default and can perform the read-only registry export.
- tool state falls back to each tool's `EnabledByDefault` value unless an override exists;
- connection and tool settings are stored by the package, not by the portable project config;
- direct and gateway connection caps are unlimited from `2.16.0-pre.1` onward, despite older/stale prose elsewhere in the same documentation set;
- first-use third-party disclaimer acceptance is still a manual user decision.

Never infer paid/free status from the presence of the **Gateway** page. For the exact pinned source, connection entitlement caps are not enforced; setup still must not purchase a seat, sign in, accept terms, or configure Assistant/Gateway credentials for the user.
