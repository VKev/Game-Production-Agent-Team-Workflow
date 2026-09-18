---
name: setup-video-analyzer
description: Install or repair the official mcp-video-analyzer prerequisites and register a caption-first, selectively frame-assisted, no-Whisper tool subset for every AI client bundle present in the repository (Codex enabled_tools/disabled_tools, Claude Code permission rules). Use when bootstrapping the copied agent package, when Node.js, yt-dlp, or the video-analyzer MCP entry is missing or stale, when runtime routing must avoid both caption-only visual guesses and unconditional frame extraction, or when transcription-capable video tools must be removed from Codex exposure.
---

# Video Analyzer Setup

Configure the official npm package for metadata and visual-frame inspection without making agents depend on Whisper, an external transcription API, or a GPU. Read [references/sources.md](references/sources.md) before changing installer, package, tool names, or client configuration behavior.

## Required policy

The upstream server falls back to Whisper when native captions are empty. Environment variables cannot reliably disable every fallback because an existing `whisper` executable can still be discovered on `PATH`. Enforce this project's policy at each client's tool boundary. Codex filters the exposed tool list directly:

```toml
[mcp_servers.video-analyzer]
command = "npx"
args = ["-y", "mcp-video-analyzer@latest"]
enabled_tools = ["get_metadata", "get_frames", "get_frame_at", "get_frame_burst"]
disabled_tools = ["analyze_video", "analyze_videos", "get_transcript", "analyze_moment"]
startup_timeout_sec = 60
tool_timeout_sec = 300

[mcp_servers.video-analyzer.env]
TWELVELABS_API_KEY = ""
OPENAI_API_KEY = ""
WHISPER_HF_MODEL = ""
```

Claude Code's `.mcp.json` has no per-server tool filter, so the equivalent boundary is a permission rule in `.claude/settings.json`, where `deny` outranks `ask` and `allow`:

```json
{
  "mcpServers": {
    "video-analyzer": {
      "command": "npx",
      "args": ["-y", "mcp-video-analyzer@latest"],
      "env": { "TWELVELABS_API_KEY": "", "OPENAI_API_KEY": "", "WHISPER_HF_MODEL": "" }
    }
  }
}
```

```json
{
  "enabledMcpjsonServers": ["video-analyzer"],
  "permissions": {
    "allow": [
      "mcp__video-analyzer__get_metadata",
      "mcp__video-analyzer__get_frames",
      "mcp__video-analyzer__get_frame_at",
      "mcp__video-analyzer__get_frame_burst"
    ],
    "deny": [
      "mcp__video-analyzer__analyze_video",
      "mcp__video-analyzer__analyze_videos",
      "mcp__video-analyzer__get_transcript",
      "mcp__video-analyzer__analyze_moment"
    ]
  },
  "env": { "MCP_TIMEOUT": "60000", "MCP_TOOL_TIMEOUT": "300000" }
}
```

The two clients enforce the same policy with different mechanisms, and the difference must be reported rather than glossed over:

- Codex removes the transcript-capable tools from the exposed list; they never reach the model.
- Claude Code still sees them in `tools/list`, but every call is refused by the deny rule. Verification therefore checks the deny rules, not the absence of the tool names.
- `MCP_TIMEOUT` and `MCP_TOOL_TIMEOUT` are process-wide in Claude Code, not per server. Set them only when the user accepts that scope; otherwise omit them and report the timeouts as client-default.

The allowlist is authoritative in both clients. The empty process-local environment overrides prevent inherited API keys from selecting the TwelveLabs adapter or API transcription paths; they do not modify the user's actual environment. Do not expose or allow a new upstream tool in either client until its current source has been inspected and it is proven unable to invoke transcription or a remote video-analysis service.

## Client scope

Configure only the client bundles present in the repository, and configure every one of them: `.codex/agents/setup_agents.toml` present → Codex user-level `config.toml`; `.claude/agents/setup-agents.md` present → project `.mcp.json` plus `.claude/settings.json`. Never run `npx skills add`, a Claude plugin command, or another broad multi-client installer, and never configure a client outside this scope.

## Workflow

1. Resolve the exact project root, active Codex home (`CODEX_HOME`, otherwise `~/.codex`), and active Codex `config.toml`. Record whether `HEAD` exists, its SHA, and the staged-path list. Stop if the index is already non-empty.
2. Record hashes for every client file this skill may touch (`config.toml`, `<project-root>/.mcp.json`, `<project-root>/.claude/settings.json`) plus the user-level Claude files that must stay untouched. This skill must not recursively inspect, configure, or clean a client outside its scope.
3. Verify that the copied runtime skill exists at `<project-root>/.agents/skills/research-video-caption-analysis/SKILL.md`, or at `<project-root>/.claude/skills/research-video-caption-analysis/SKILL.md` in a Claude-only checkout, and that its caption-gate script passes `node --check`. Also require its evidence router to express all three cases: caption-sufficient questions use zero frame calls, visual-dependent questions use the smallest timestamp-targeted frame call, and mixed questions retrieve frames only for unresolved visual claims. If the skill or any rule is missing, or the script is invalid, report the runtime policy as blocked; do not substitute the upstream multi-client skill installer.
4. Resolve `node`, `npm`, and `npx` before use. Treat Node.js as healthy only when its parsed major version is at least 18 and both npm and npx start successfully.
5. When Node.js is missing or below 18, install one supported LTS build once:
   - On Windows, require `winget`, then run `winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements`.
   - On macOS with Homebrew, run `brew install node`.
   - On another host without a supported package manager, stop and report the official Node.js download as the pending prerequisite. Do not pipe an unverified third-party Node installer into a shell.
6. Resolve Node.js again. If installation succeeded but the current process has a stale PATH, add only the installer-reported Node directory to the current process PATH and retry once. Do not reinstall just to refresh PATH.
7. Resolve `yt-dlp` and parse `yt-dlp --version`:
   - If it starts successfully, preserve it. Do not replace or upgrade a working installation automatically.
   - If it is absent, require the healthy `uv` established earlier by `setup-serena`. Inspect `uv tool list` and `uv tool dir --bin` first. Reuse a registered healthy `yt-dlp` executable that was merely missing from the current PATH; otherwise run `uv tool install yt-dlp` once when the tool is not registered.
   - If uv owns a registered `yt-dlp` but its executable is missing or cannot start, make one bounded repair with `uv tool install --reinstall yt-dlp`, then recheck. Do not replace an unknown broken installation owned by another package manager.
   - Stop if `yt-dlp --version` still fails. Do not install Whisper, PyTorch, CUDA, ffmpeg, Chrome, or a transcription SDK as a workaround. The npm package already bundles ffmpeg for its frame tools.
8. Query current registry metadata with `npm view mcp-video-analyzer@latest version repository.url engines.node --json`. Require a valid version, a repository URL that canonicalizes to `https://github.com/guimatheus92/mcp-video-analyzer` after removing only a `git+` prefix, `.git` suffix, and trailing slash, and a Node engine satisfied by the resolved runtime. If identity or metadata is ambiguous, stop.
9. Warm and verify the exact latest published executable with `npx -y mcp-video-analyzer@latest --version`. Give the first download a bounded three-minute budget. Require its reported version to equal the registry `latest` version. Do not clone Git `main`, install globally, add a project `package.json`, or claim that an unpublished commit is a stable release.
10. Inspect every MCP table whose command or arguments reference `mcp-video-analyzer`. Require exactly one canonical `video-analyzer` table after repair:
    - `correct`: command, arguments, both tool lists, timeouts, and the three empty process-local environment overrides exactly match the policy above; preserve it.
    - `missing`: back up the config outside the project and merge only the policy table.
    - `incorrect`: back up the config and make the smallest table-local repair. A single unambiguous alias that launches this exact package may be renamed to `video-analyzer`. Replace only this server's unsafe `env` or `env_vars` values with the exact empty overrides above and remove tool approvals that enable Whisper, TwelveLabs, or another transcription path; preserve unrelated MCP servers and settings.
    - `ambiguous`: stop rather than merging duplicate package entries or replacing structurally invalid entries.
11. Run `scripts/inspect_video_analyzer_state.py --config <config.toml> --expected-version <registry-version> --reported-version <npx-version>` through the already verified Python 3 runtime. Require `status=correct`. This helper owns TOML parsing, exact allow/deny lists, timeouts, empty environment overrides, duplicate package-server detection, and version comparison; do not rebuild the check as an inline PowerShell conditional. Do not install PyYAML or another parser only for this check.
12. Claude Code, when its bundle is present:
    - Merge exactly one `video-analyzer` server into `.mcp.json` with the same command, arguments, and three empty environment overrides as the Codex entry, preserving unrelated servers.
    - Merge the four `allow` and four `deny` permission rules above into `.claude/settings.json`, preserving unrelated permissions, hooks, and settings. The deny rules are mandatory; a Claude registration without them is unsafe and must be repaired before video work.
    - Add `video-analyzer` to `enabledMcpjsonServers`.
    - Set `MCP_TIMEOUT`/`MCP_TOOL_TIMEOUT` only with the user's agreement, because they apply to every MCP server in that Claude Code process.
    - Confirm no user-level Claude file changed; this registration is project-scope only.
13. Verify Node.js, npm, npx, yt-dlp, registry identity, package version, the caption-gate script, each configured client's entry and tool policy, unchanged user-level client hashes, unchanged `HEAD`, and an empty staged-path list. Report the MCP configuration as `restart-ready`; only a new client process can prove live discovery and the effective tool policy.

## Post-restart verification

After Codex restarts, require exactly these four exposed server tools: `get_metadata`, `get_frames`, `get_frame_at`, and `get_frame_burst`. If a transcript-capable tool appears, treat the configuration as unsafe and repair it before video work.

After Claude Code restarts, require the same four tools to be callable and each of `analyze_video`, `analyze_videos`, `get_transcript`, and `analyze_moment` to be refused by the deny rule. A transcript-capable tool merely appearing in `tools/list` is expected for this client; a transcript-capable tool that is *callable* is the unsafe state.

Use `research-video-caption-analysis` for runtime behavior. A YouTube request must pass that skill's native-caption gate before any MCP call. After the gate, caption-sufficient work must make no frame call; visual-dependent work must retrieve the smallest relevant frame set; mixed work must retrieve frames only for its visual claims. Missing or unverifiable captions are a stop condition, not permission to fall back to audio transcription or frame-only analysis.

## Boundaries

- Configure only the client bundles detected in the client scope. Never run `npx skills add`, a Claude plugin command, or another broad multi-client installer.
- Never install or enable Whisper, faster-whisper, whisper-ctranslate2, Transformers speech recognition, PyTorch, CUDA, OpenAI transcription, TwelveLabs, or another speech-to-text fallback.
- Never expose `analyze_video`, `analyze_videos`, `get_transcript`, or `analyze_moment` under this policy: remove them from Codex's exposed list and deny them in Claude Code. Never weaken either mechanism, and never register the server in Claude Code without the deny rules.
- Never turn the four-tool allowlist into an automatic call sequence. It defines what may be called; the runtime evidence router decides whether any frame call is needed.
- Never store cookies, API keys, signed URLs, or secret-derived data in the repository or any client config.
- Never overwrite a full client configuration (`config.toml`, `.mcp.json`, `.claude/settings.json`), modify product code, stage files, commit, push, or rewrite Git history.
- Never report live-ready from package/version/config checks alone.
