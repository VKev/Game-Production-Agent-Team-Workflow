---
name: setup-game-toolchain
description: Check, install, and verify the two command-line prerequisites the browser-game fetch and Cocos port skills depend on — a real `python3` on PATH and the optional `oxipng` image optimizer. Use when preparing a copied agent package for game fetch/port work, when `python3` resolves to a Microsoft Store stub or to Python 2, or when a ship step needs lossless PNG optimization.
---

# Game toolchain setup

`research-browser-game-mirror`, `research-browser-game-batch`, `dev-cocos-port-2x`, `dev-cocos-port-3x`, and `dev-cocos-migrate-2x-to-3x` shell out to two CLI tools this package set does not otherwise install:

| Tool | Required? | Used for |
|---|---|---|
| `python3` | **required** | `serve-local.py` (run a mirrored build locally), `cdp.py` (drive the local run), `triage-scan.py`, `extract-cocos24-assets.py` / `extract-cocos3x-assets.py`, `optimize-images.py` |
| `oxipng` | optional | lossless PNG optimization in the ship step |

Node.js is **not** this skill's job: `setup-video-analyzer` already establishes it. Those skills' `.mjs` scripts need Node **22 or newer**, so verify the installed major version here and report it; do not install or upgrade Node from this skill.

## Workflow

1. Resolve `python3` before invoking it (`Get-Command python3` on Windows, `command -v python3` on POSIX), then run `python3 --version`:
   - Record the version when it starts and reports `3.10` or newer.
   - **On Windows, treat the Microsoft Store alias as missing.** `python3` there is an App Execution Alias that prints "Python was not found; run without arguments to install from the Microsoft Store" and exits non-zero. A `python` that reports `2.x` is also missing for this purpose.
   - A resolvable `python3` that fails to start is `incorrect`: record its path and the error, repair once, and verify again.
2. Install `python3` only when it is missing or incorrect, from the platform's official source, once:
   - Windows: `winget install --id Python.Python.3.13 --exact --source winget --accept-package-agreements --accept-source-agreements`
   - macOS with Homebrew: `brew install python@3.13`
   - Linux: the distribution's own `python3` package through its package manager.
   - On a host with no supported package manager, stop and report `https://www.python.org/downloads/` as the pending prerequisite. Never pipe an unverified third-party installer into a shell.
3. Refresh only the current process PATH from the directory the installer reported, then run `python3 --version` again. Stop and report if the current process still cannot use it.
4. Windows only: when the Store alias still shadows the real interpreter, do not edit the registry or delete system files. Report the exact manual fix — **Settings → Apps → Advanced app settings → App execution aliases**, turn off `python.exe` and `python3.exe` — and treat it as a user checkpoint.
5. `uv` (already established by `setup-serena`) is an acceptable fallback **only** when a real `python3` cannot be installed: `uv python install 3.13` provides an interpreter, but it does not put `python3` on PATH, so every script call becomes `uv run --no-project python <script>`. If you take this route, say so explicitly in the report, because the skills' documented commands will not work verbatim.
6. Resolve `oxipng` and run `oxipng --version`:
   - Present and working: record the version, do not reinstall.
   - Missing: install once — Windows `winget install --id Shssoichiro.Oxipng --exact --source winget --accept-package-agreements --accept-source-agreements`; macOS `brew install oxipng`; Linux the distribution package or `cargo install oxipng` when Rust is already present.
   - Still missing after one attempt: report it as `deferred`. It is optional; the ship step must then skip PNG optimization and say so rather than shipping unoptimized files silently.
7. Verify and report: `python3 --version`, `oxipng --version` (or its deferred state), and the Node major version the game skills need, with the exact commands used.

## Boundaries

- Install only from the platform's official package source or python.org. Never from a mirror, a bundled third-party installer, or a script piped from an unverified URL.
- Never uninstall, replace, or "clean up" an existing Python, and never change the system default interpreter; add what is missing and report conflicts.
- Never edit the Windows registry, delete `WindowsApps` entries, or otherwise work around an App Execution Alias programmatically — that is a user action.
- Never install Node.js, npm, uv, or any other toolchain from this skill; each has its own owner.
- Never treat `oxipng` as required, and never silently skip PNG optimization without saying so.
- Never report success from an installer's exit code alone: the version command must run in the current process.
- Use at most one install attempt and one retry after a relevant repair, with a 60-second diagnostic budget and a 300-second installer budget.
