# Official sources

- [mcp-video-analyzer repository and README](https://github.com/guimatheus92/mcp-video-analyzer): supported sources, prerequisites, MCP configuration, tool catalog, caption behavior, and frame extraction behavior.
- [Current package manifest](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/package.json): npm identity, repository identity, Node.js engine, executable, and bundled dependencies.
- [Current transcript tool source](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/get-transcript.ts): proves that an empty native transcript can download the video and invoke Whisper.
- [Current audio transcriber source](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/processors/audio-transcriber.ts): Whisper/Hugging Face/OpenAI fallback discovery and environment behavior.
- [Current frame-burst source](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/get-frame-burst.ts): frame-only behavior used in the safe allowlist.
- [Node.js downloads](https://nodejs.org/en/download): official supported releases and LTS downloads.
- [WinGet install command](https://learn.microsoft.com/windows/package-manager/winget/install): exact package-ID/source installation and agreement flags on Windows.
- [yt-dlp installation](https://github.com/yt-dlp/yt-dlp/wiki/Installation): official release and package-manager installation choices.
- [uv tool installation](https://docs.astral.sh/uv/guides/tools/): isolated persistent tool installation and executable placement.
- [npm `npx` documentation](https://docs.npmjs.com/cli/v11/commands/npx/): npm package execution behavior.
- [Codex MCP documentation](https://developers.openai.com/codex/mcp): Codex STDIO MCP registration and configuration locations.
- [Codex configuration reference](https://developers.openai.com/codex/config-reference/): `enabled_tools`, `disabled_tools`, startup timeout, and tool timeout semantics.

Use the latest stable npm dist-tag only after registry metadata still points to the official repository. Do not assume a Git `main` commit is a published release. Reinspect current upstream source before expanding the safe tool allowlist because tool internals can change independently of their names.
