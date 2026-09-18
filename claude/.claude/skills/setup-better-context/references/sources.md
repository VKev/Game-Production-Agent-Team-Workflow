# Sources

- Better Context repository and usage: https://github.com/VKev/Better-Context
- Package metadata and CLI entry point: https://raw.githubusercontent.com/VKev/Better-Context/main/pyproject.toml
- Project ignore implementation: https://github.com/VKev/Better-Context/blob/main/src/better_context/ignore.py
- Roslyn helper project: https://github.com/VKev/Better-Context/tree/main/src/better_context/roslyn_helper
- Unity runtime analyzer and query contract: https://github.com/VKev/Better-Context/blob/main/README.md#generated-agentsmd-intelligence
- Unity Editor command-line arguments and static `-executeMethod`: https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html
- Unity Git package syntax and `?path=`: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-git.html
- AssetDatabase main and hidden subassets: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AssetDatabase.LoadAllAssetsAtPath.html
- Texture importer facts: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/TextureImporter.html
- uv tool installation guide, including Git sources: https://docs.astral.sh/uv/guides/tools/
- uv CLI reference for `tool install`, `--force`, `--refresh`, `tool list`, and `tool dir`: https://docs.astral.sh/uv/reference/cli/
- Official uv standalone installer: https://docs.astral.sh/uv/getting-started/installation/

The approved persistent installation is:

```text
uv tool install "git+https://github.com/VKev/Better-Context.git@main"
```

Use `--force --refresh` only to repair an incorrect, broken, old, or capability-stale installation. Better Context is a local CLI; it does not add an MCP server or require a Codex restart. Version `1.6.0` adds the `com.vkev.better-context.editor` companion package, exact Editor-backed importer/subasset/component evidence, texture/Sprite/atlas/audio/video/static asset queries, and direct `AssetDatabase` dependencies while retaining zero-dependency offline YAML/FBX coverage. It requires a .NET 8+ SDK for Roslyn analysis. Install the companion package from the same repository with `?path=/unity-package/com.vkev.better-context.editor` and pin an accepted release tag or exact commit. Continue using exact registered vendor roots rather than excluding all of `Assets/Plugins`.

Approved commit `b81b4ea595ecc8053f8bdefb9482b7b8227d05c8` has `unity_editor.py` SHA-256 `7D6D3B69FFD896B5EEE0E3FF2EFFD7C7A4F1C7887E25B557AB02EC6954BC01C6`. Its Windows open-Editor probe uses `os.kill(pid, 0)`, which can reject a live Unity process. The bundled fallback is limited to this exact module hash and independently validates `EditorInstance.json` against the live process image before delegating to the package's own snapshot routine.

## Multi-client instruction maps (1.7.0)

Better Context 1.7.0 adds a `map_files` configuration key and a repeatable
`--map-file` flag to the `agents` command. Accepted values are `AGENTS.md` and
`CLAUDE.md`; the default remains `AGENTS.md` alone. One scan writes every
selected file with identical managed content, and each file's child/parent links
point at its own name, so a Codex agent reading `AGENTS.md` and Claude Code
reading `CLAUDE.md` navigate the same verified map.

Both names are always recognized regardless of the selection: neither file is
analysed as project source, both are excluded from staleness hashes, and `clean`
removes the managed block from both. `.ctxignore` therefore excludes
`**/AGENTS.md.meta` and `**/CLAUDE.md.meta`.
