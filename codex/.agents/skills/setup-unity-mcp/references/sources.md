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
- Unity project dependency manifest: https://docs.unity3d.com/ja/2022.3/Manual/upm-dependencies.html
- Unity Git dependencies and revisions: https://docs.unity3d.com/ja/2022.3/Manual/upm-git.html

CoplayDev documents this moving-branch Git package URL:

```text
https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
```

For deterministic `setup-agents` preparation, resolve and verify the current `main` commit, then use that immutable commit in the same URL instead of leaving the project on a moving branch. This still installs CoplayDev's latest verified `main` snapshot at setup time while ensuring the package source and dependency spec cannot drift between the hidden resolution pass and the later interactive Editor session.

CoplayDev currently defaults Codex to local streamable HTTP at `http://127.0.0.1:8080/mcp`. Current OpenAI documentation supports `[mcp_servers.<name>]` entries with a `url` directly; no legacy HTTP feature flag is required.

The Optional Dependencies implementation is the dependency source of truth, not this skill's prose. Resolve it from the current verified `main` commit on every setup run. CoplayDev's interactive UI passes its UPM package ids to `Client.AddAndRemove` without versions. The orchestrated setup preserves those exact ids but pre-resolves exact stable, patch-compatible versions before interactive Unity opens, preventing a live Burst/native upgrade from forcing another restart. `RoslynInstaller.cs` deliberately pins its NuGet graph, so use those current upstream pins rather than independently selecting NuGet latest versions.

For this portable package, mirror the repository's public `unity-mcp-skill/` subtree into `<project-root>/.agents/skills/dev-unity-mcp`. OpenAI documents `.agents/skills` as the repository-scoped discovery path and requires the folder name to match the skill name. Verify the raw upstream blobs first, then change only the copied `SKILL.md` frontmatter name from `unity-mcp-orchestrator` to `dev-unity-mcp`. The sync source may contain CoplayDev's cross-client material, but setup must never create a project `.claude` destination.
