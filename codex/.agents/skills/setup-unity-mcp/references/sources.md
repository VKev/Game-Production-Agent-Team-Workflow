# Official sources

- MCP for Unity repository and quickstart: https://github.com/CoplayDev/unity-mcp
- Installation guide: https://coplaydev.github.io/unity-mcp/getting-started/install
- MCP client guide: https://coplaydev.github.io/unity-mcp/getting-started/clients
- uv and Python guide: https://coplaydev.github.io/unity-mcp/guides/uv-setup
- Codex configurator source: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/Editor/Clients/Configurators/CodexConfigurator.cs
- Codex TOML helper source: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/Editor/Helpers/CodexConfigHelper.cs
- Unity package metadata: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/package.json
- Optional Dependencies implementation: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/Editor/Windows/MCPForUnityEditorWindow.cs
- Official Roslyn installer and pinned NuGet set: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/Editor/Setup/RoslynInstaller.cs
- Official runtime skill subtree: https://github.com/CoplayDev/unity-mcp/tree/main/unity-mcp-skill
- CoplayDev skill sync implementation: https://github.com/CoplayDev/unity-mcp/blob/main/MCPForUnity/Editor/Setup/SkillSyncService.cs
- OpenAI skill locations and discovery: https://learn.chatgpt.com/docs/build-skills
- OpenAI Codex MCP configuration: https://developers.openai.com/codex/mcp
- OpenAI Codex configuration reference: https://developers.openai.com/codex/config-reference
- Official uv installation: https://docs.astral.sh/uv/getting-started/installation/
- Unity Package Manager `Client.AddAndRemove`: https://docs.unity3d.com/2023.1/Documentation/ScriptReference/PackageManager.Client.AddAndRemove.html

Use the stable Git package URL documented by CoplayDev:

```text
https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
```

CoplayDev currently defaults Codex to local streamable HTTP at `http://127.0.0.1:8080/mcp`. Current OpenAI documentation supports `[mcp_servers.<name>]` entries with a `url` directly; no legacy HTTP feature flag is required.

The Optional Dependencies implementation is the dependency source of truth, not this skill's prose. Resolve it from the current verified `main` commit on every setup run. CoplayDev passes its UPM package ids to `Client.AddAndRemove` without versions; Unity documents that this selects the latest compatible released version. `RoslynInstaller.cs` deliberately pins its NuGet graph, so use those current upstream pins rather than independently selecting NuGet latest versions.

For this portable package, mirror the repository's public `unity-mcp-skill/` subtree into `<project-root>/.agents/skills/dev-unity-mcp`. OpenAI documents `.agents/skills` as the repository-scoped discovery path and requires the folder name to match the skill name. Verify the raw upstream blobs first, then change only the copied `SKILL.md` frontmatter name from `unity-mcp-orchestrator` to `dev-unity-mcp`. The sync source may contain CoplayDev's cross-client material, but setup must never create a project `.claude` destination.
